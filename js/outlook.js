'use strict';
/* Outlook (sola lettura): posta in arrivo/inviata e calendario, con copia locale per l'uso offline.
   - elenchi email ed eventi: localStorage (piccoli);
   - testo completo delle email aperte: IndexedDB (ultime 80). */

const IDB = (() => {
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open('hs-dashboard', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  const op = (mode, fn) => db().then(d => new Promise((res, rej) => {
    const st = d.transaction('kv', mode).objectStore('kv');
    const rq = fn(st);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  }));
  return {
    get: k => op('readonly', s => s.get(k)).catch(() => undefined),
    set: (k, v) => op('readwrite', s => s.put(v, k)).catch(() => {}),
    del: k => op('readwrite', s => s.delete(k)).catch(() => {}),
  };
})();

const Prefs = (() => {
  const KEY = 'hs-prefs';
  let p = { outlookAgenda: true, outlookCal: true };
  try { p = { ...p, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { /* ignora */ }
  return {
    get: k => p[k],
    set(k, v) { p[k] = v; try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* ignora */ } },
  };
})();

const Outlook = (() => {
  const LS_MAIL = 'hs-mail-cache', LS_CAL = 'hs-cal-cache', LS_BODIES = 'hs-mail-bodies';
  const MAX_LIST = 200, MAX_BODIES = 80, CAL_TTL = 10 * 60 * 1000;
  const MSG_SEL = 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,bodyPreview,isRead,importance,flag,hasAttachments,conversationId,webLink';
  const EV_SEL = 'id,subject,start,end,isAllDay,location,organizer,isCancelled,webLink,isOnlineMeeting,onlineMeeting,showAs,responseStatus,bodyPreview,attendees,isOrganizer';
  let mail = { inbox: [], sent: [], next: { inbox: null, sent: null }, at: 0 };
  let cal = { months: {} };
  let busy = { mail: false, cal: {} };
  let error = '';
  const listeners = new Set();
  const notify = () => listeners.forEach(f => f());

  try { mail = { ...mail, ...JSON.parse(localStorage.getItem(LS_MAIL) || '{}') }; } catch (e) { /* ignora */ }
  try { cal = { ...cal, ...JSON.parse(localStorage.getItem(LS_CAL) || '{}') }; } catch (e) { /* ignora */ }
  const saveMail = () => { try { localStorage.setItem(LS_MAIL, JSON.stringify(mail)); } catch (e) { /* ignora */ } };
  const saveCal = () => { try { localStorage.setItem(LS_CAL, JSON.stringify(cal)); } catch (e) { /* ignora */ } };

  const enabled = () => Auth.mode !== 'local' && !!Auth.account;
  const addr = r => r && r.emailAddress ? { name: r.emailAddress.name || r.emailAddress.address || '', address: (r.emailAddress.address || '').toLowerCase() } : { name: '', address: '' };
  const slimMsg = m => ({
    id: m.id, subject: m.subject || '(senza oggetto)', from: addr(m.from),
    to: (m.toRecipients || []).map(addr), cc: (m.ccRecipients || []).map(addr),
    received: m.receivedDateTime, sent: m.sentDateTime, preview: (m.bodyPreview || '').slice(0, 260),
    isRead: !!m.isRead, importance: m.importance || 'normal', flagged: !!(m.flag && m.flag.flagStatus === 'flagged'),
    hasAttachments: !!m.hasAttachments, conv: m.conversationId, webLink: m.webLink,
  });
  const slimEv = e => ({
    id: e.id, subject: e.subject || '(senza titolo)',
    start: (e.start && e.start.dateTime || '').slice(0, 16), end: (e.end && e.end.dateTime || '').slice(0, 16),
    allDay: !!e.isAllDay, location: (e.location && e.location.displayName) || '',
    organizer: (e.organizer && e.organizer.emailAddress && e.organizer.emailAddress.name) || '',
    isOrganizer: !!e.isOrganizer, cancelled: !!e.isCancelled, webLink: e.webLink,
    online: !!e.isOnlineMeeting, joinUrl: (e.onlineMeeting && e.onlineMeeting.joinUrl) || '',
    showAs: e.showAs || '', response: (e.responseStatus && e.responseStatus.response) || '',
    attendees: (e.attendees || []).length, preview: (e.bodyPreview || '').slice(0, 200),
  });

  function handleErr(e) {
    if (e.auth) error = 'Accesso scaduto: riconnettiti per aggiornare posta e calendario.';
    else if (e.network) error = '';
    else if (e.status === 403) error = 'Permesso mancante per leggere posta o calendario.';
    else error = e.message || 'Errore nel collegamento con Outlook';
  }
  async function getJSON(path, headers) {
    const r = await Graph.call(path, { headers });
    if (!r.ok) throw await Graph.fail(r, 'Outlook');
    return r.json();
  }

  /* ---------- Posta ---------- */
  async function refreshMail({ folder = 'inbox', more = false } = {}) {
    if (!enabled() || !navigator.onLine || busy.mail) return;
    busy.mail = true; notify();
    try {
      const order = folder === 'sent' ? 'sentDateTime' : 'receivedDateTime';
      const path = more && mail.next[folder]
        ? mail.next[folder].replace(CONFIG.graph, '')
        : `/me/mailFolders/${folder === 'sent' ? 'sentitems' : 'inbox'}/messages?$top=40&$select=${MSG_SEL}&$orderby=${order}%20desc`;
      const j = await getJSON(path);
      const items = (j.value || []).map(slimMsg);
      if (more) {
        const ids = new Set(mail[folder].map(m => m.id));
        mail[folder] = [...mail[folder], ...items.filter(m => !ids.has(m.id))].slice(0, MAX_LIST);
      } else {
        // conserva i messaggi più vecchi già caricati con «Carica altre»
        const ids = new Set(items.map(m => m.id));
        const older = mail[folder].filter(m => !ids.has(m.id) && (m[folder === 'sent' ? 'sent' : 'received'] || '') < ((items[items.length - 1] || {})[folder === 'sent' ? 'sent' : 'received'] || ''));
        mail[folder] = [...items, ...older].slice(0, MAX_LIST);
      }
      mail.next[folder] = j['@odata.nextLink'] || null;
      mail.at = Date.now();
      error = '';
      saveMail();
    } catch (e) { handleErr(e); }
    finally { busy.mail = false; notify(); }
  }
  const messages = folder => mail[folder] || [];
  const message = id => mail.inbox.find(m => m.id === id) || mail.sent.find(m => m.id === id) || null;

  async function body(id) {
    const cached = await IDB.get('body:' + id);
    if (cached) return cached;
    if (!enabled() || !navigator.onLine) return null;
    const j = await getJSON(`/me/messages/${encodeURIComponent(id)}?$select=body,toRecipients,ccRecipients,hasAttachments`, { Prefer: 'outlook.body-content-type="html"' });
    const out = { html: (j.body && j.body.content) || '', type: (j.body && j.body.contentType) || 'html', ts: Date.now() };
    if (j.hasAttachments) {
      try {
        const a = await getJSON(`/me/messages/${encodeURIComponent(id)}/attachments?$select=name,size,contentType,isInline`);
        out.attachments = (a.value || []).filter(x => !x.isInline).map(x => ({ name: x.name, size: x.size }));
      } catch (e) { /* allegati non essenziali */ }
    }
    await IDB.set('body:' + id, out);
    let list = [];
    try { list = JSON.parse(localStorage.getItem(LS_BODIES) || '[]'); } catch (e) { /* ignora */ }
    list = [id, ...list.filter(x => x !== id)];
    list.slice(MAX_BODIES).forEach(x => IDB.del('body:' + x));
    try { localStorage.setItem(LS_BODIES, JSON.stringify(list.slice(0, MAX_BODIES))); } catch (e) { /* ignora */ }
    return out;
  }

  /* ---------- Calendario ---------- */
  const monthOf = iso => iso.slice(0, 7);
  const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`; };
  async function ensureMonth(ym, { force = false } = {}) {
    if (!enabled() || !navigator.onLine || busy.cal[ym]) return;
    const c = cal.months[ym];
    if (!force && c && Date.now() - c.at < CAL_TTL) return;
    busy.cal[ym] = true;
    try {
      const withOffset = iso => { // mezzanotte locale con fuso orario esplicito (es. +01:00)
        const off = -U.fromISO(iso).getTimezoneOffset();
        const sign = off >= 0 ? '+' : '-';
        return encodeURIComponent(`${iso}T00:00:00${sign}${U.pad(Math.floor(Math.abs(off) / 60))}:${U.pad(Math.abs(off) % 60)}`);
      };
      const startDT = withOffset(`${ym}-01`), endDT = withOffset(`${shiftMonth(ym, 1)}-01`);
      let path = `/me/calendarView?startDateTime=${startDT}&endDateTime=${endDT}&$top=200&$select=${EV_SEL}&$orderby=start/dateTime`;
      const events = [];
      for (let guard = 0; path && guard < 10; guard++) {
        const j = await getJSON(path, { Prefer: 'outlook.timezone="Europe/Rome"' });
        (j.value || []).forEach(e => events.push(slimEv(e)));
        path = j['@odata.nextLink'] ? j['@odata.nextLink'].replace(CONFIG.graph, '') : null;
      }
      cal.months[ym] = { at: Date.now(), events };
      const keep = new Set([-3, -2, -1, 0, 1, 2, 3, 4].map(n => shiftMonth(U.todayISO().slice(0, 7), n)));
      Object.keys(cal.months).forEach(k => { if (!keep.has(k) && k !== ym) delete cal.months[k]; });
      error = '';
      saveCal();
    } catch (e) { handleErr(e); }
    finally { delete busy.cal[ym]; notify(); }
  }
  function eventsOn(iso) {
    const seen = new Set(), out = [];
    [monthOf(iso), shiftMonth(monthOf(iso), -1)].forEach(ym => {
      ((cal.months[ym] || {}).events || []).forEach(e => {
        if (seen.has(e.id)) return;
        const sd = e.start.slice(0, 10), ed = e.end.slice(0, 10);
        const on = e.allDay ? (sd <= iso && iso < (ed || sd) ) || (sd === iso) : sd === iso;
        if (on) { seen.add(e.id); out.push(e); }
      });
    });
    return out.sort((a, b) => (a.allDay === b.allDay ? (a.start < b.start ? -1 : 1) : (a.allDay ? -1 : 1)));
  }
  function findEvent(id) {
    for (const m of Object.values(cal.months)) { const e = (m.events || []).find(x => x.id === id); if (e) return e; }
    return null;
  }
  const evTime = e => (e.allDay ? '' : e.start.slice(11, 16));
  const evEnd = e => (e.allDay ? '' : (e.end.slice(0, 10) === e.start.slice(0, 10) ? e.end.slice(11, 16) : ''));

  /* ---------- Aggiornamento automatico ---------- */
  function refreshAll({ force = false } = {}) {
    if (!enabled()) return;
    refreshMail({ folder: 'inbox' });
    refreshMail({ folder: 'sent' });
    const cur = U.todayISO().slice(0, 7);
    [-1, 0, 1].forEach(n => ensureMonth(shiftMonth(cur, n), { force }));
  }
  function init() {
    if (Auth.mode === 'local') return;
    window.addEventListener('online', () => refreshAll());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - mail.at > 60000) refreshAll(); });
    setInterval(() => { if (document.visibilityState === 'visible') refreshAll(); }, 5 * 60 * 1000);
    if (enabled()) setTimeout(() => refreshAll(), 600);
  }

  return {
    init, refreshAll, refreshMail, ensureMonth, messages, message, body, eventsOn, findEvent, evTime, evEnd,
    subscribe: f => listeners.add(f),
    get enabled() { return enabled(); }, get busy() { return busy.mail || Object.keys(busy.cal).length > 0; },
    get mailAt() { return mail.at; }, get error() { return error; }, hasMore: f => !!mail.next[f],
  };
})();
