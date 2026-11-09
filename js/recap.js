'use strict';
/* Recap intelligente della posta: file recap.json scritto su OneDrive dall'attività pianificata di Claude
   (e aggiornato dalla chat quando Matteo chiede azioni). L'app lo legge, lo controlla e lo mostra;
   ogni testo viene trattato come dato, mai come codice. Schema 1 e 2 supportati. */
const Recap = (() => {
  const LS = 'hs-recap-cache';
  const CATS = ['reply', 'define', 'upcoming', 'info'];
  const PRIO = { alta: 0, media: 1, bassa: 2 };
  const LABELS = ['didattica', 'personale', 'sede', 'appuntamento'];
  let data = null, etag = null, at = 0, busy = false, error = '';
  const listeners = new Set();
  const notify = () => listeners.forEach(f => { try { f(); } catch (e) { console.error('[recap listener]', e); } });
  const CACHE_V = 2; // copia salvata dalle versioni precedenti: si ricontrolla e si riscarica il file
  const save = () => { try { localStorage.setItem(LS, JSON.stringify({ v: CACHE_V, data, etag, at })); } catch (e) { /* ignora */ } };
  const enabled = () => Auth.mode !== 'local' && !!Auth.account;

  const str = (v, max = 400) => (typeof v === 'string' ? v.slice(0, max) : '');
  const isoDate = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const hhmm = v => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : '');
  const tags = v => [...new Set((Array.isArray(v) ? v : []).filter(t => typeof t === 'string')
    .map(t => '#' + t.trim().replace(/^#+/, '').replace(/[^\p{L}\p{N}_&-]/gu, '').slice(0, 30)).filter(t => t.length > 1))].slice(0, 6);
  const people = v => (Array.isArray(v) ? v : []).slice(0, 8).map(p => ({ name: str(p && p.name, 120), email: str(p && p.email, 200) })).filter(p => p.name);
  const task = (x, i, pre) => ({
    id: str(x.id, 300) || `${pre}-${str(x.messageId, 300)}-${i}`,
    title: str(x.title, 200), date: isoDate(x.date) || U.todayISO(), start: hhmm(x.start), end: hhmm(x.end),
    labels: (Array.isArray(x.labels) ? x.labels : []).filter(l => LABELS.includes(l)),
    project: str(x.project, 80), people: people(x.people), notes: str(x.notes, 1500),
    messageId: str(x.messageId, 300), webLink: str(x.webLink, 1000), subject: str(x.subject, 300),
  });

  function clean(j) {
    if (!j || typeof j !== 'object') throw new Error('Formato del recap non valido');
    const items = (Array.isArray(j.items) ? j.items : []).slice(0, 80).map((x, i) => ({
      id: str(x.id, 300) || `r-${str(x.messageId, 300) || i}`,
      category: CATS.includes(x.category) ? x.category : 'info',
      priority: PRIO[x.priority] !== undefined ? x.priority : 'media',
      messageId: str(x.messageId, 300), webLink: str(x.webLink, 1000),
      from: str(x.from, 120), fromAddress: str(x.fromAddress, 200), subject: str(x.subject, 300),
      received: str(x.received, 40), reason: str(x.reason, 500), due: isoDate(x.due),
      suggestedReply: str(x.suggestedReply, 4000), tags: tags(x.tags),
      status: ['open', 'done', 'draft'].includes(x.status) ? x.status : 'open', draftWebLink: str(x.draftWebLink, 1000),
    }));
    const emails = (Array.isArray(j.emails) ? j.emails : []).slice(0, 150).map(x => ({
      messageId: str(x.messageId, 300), webLink: str(x.webLink, 1000), from: str(x.from, 120), fromAddress: str(x.fromAddress, 200),
      subject: str(x.subject, 300), received: str(x.received, 40), tags: tags(x.tags),
      important: x.important === true, why: str(x.why || x.importanceWhy, 300),
      awaitingReply: x.awaitingReply === true, institution: x.institution === true,
    })).filter(x => x.messageId);
    const proposals = (Array.isArray(j.proposals) ? j.proposals : []).slice(0, 30).map((x, i) => task(x, i, 'p')).filter(p => p.title);
    const tasks = (Array.isArray(j.tasks) ? j.tasks : []).slice(0, 40).map((x, i) => task(x, i, 't')).filter(p => p.title);
    return { schema: j.schema === 2 ? 2 : 1, generatedAt: str(j.generatedAt, 40), updatedAt: str(j.updatedAt, 40), summary: str(j.summary, 1500), items, emails, proposals, tasks };
  }

  try {
    const c = JSON.parse(localStorage.getItem(LS) || 'null');
    if (c && c.data) { data = clean(c.data); etag = c.v === CACHE_V ? c.etag : null; at = c.v === CACHE_V ? (c.at || 0) : 0; }
  } catch (e) { data = null; etag = null; at = 0; }

  /* Task chiesti a Claude in chat: entrano in agenda da soli (una volta sola, anche con più dispositivi) */
  function importTasks() {
    if (!data || !Array.isArray(data.tasks) || !data.tasks.length) return 0;
    if (!Sync.sessionSynced) return 0; // prima si allinea con OneDrive, poi si importa
    let n = 0;
    for (const t of data.tasks) {
      if (Store.isHandled(t.id) || Store.task(t.id) || Store.wasDeleted(t.id)) continue;
      const labels = [...t.labels];
      if (t.project) {
        const p = Store.projects().find(x => x.name.toLowerCase() === t.project.toLowerCase()) || Store.addProject(t.project);
        labels.push(p.id);
      }
      const peopleIds = t.people.map(p => Store.ensurePerson(p.name, p.email ? { email: p.email } : {}).id);
      Store.addTask({
        id: t.id, title: t.title, date: t.date, start: t.start, end: t.start ? t.end : '', labels, people: peopleIds, notes: t.notes,
        source: t.messageId ? 'email' : 'chat',
        ...(t.messageId ? { mailRef: { id: t.messageId, subject: t.subject, from: '', webLink: t.webLink } } : {}),
      });
      Store.markHandled(t.id, 'imported');
      n++;
    }
    if (n) UI.toast(n === 1 ? 'Aggiunto 1 task richiesto in chat' : `Aggiunti ${n} task richiesti in chat`);
    return n;
  }

  async function refresh() {
    if (!enabled() || !navigator.onLine || busy) return;
    busy = true; notify();
    try {
      const r = await Graph.call(`/me/drive/special/approot:/${encodeURIComponent(CONFIG.recapFile)}`);
      if (r.status === 404) { data = null; etag = null; }
      else if (!r.ok) throw await Graph.fail(r, 'Recap');
      else {
        const item = await r.json();
        if (!data || item.eTag !== etag) {
          const d = await fetch(item['@microsoft.graph.downloadUrl'], { cache: 'no-store' });
          if (!d.ok) throw new Error(`Download recap: errore ${d.status}`);
          data = clean(JSON.parse(await d.text()));
          etag = item.eTag;
        }
      }
      at = Date.now(); error = '';
      save();
      importTasks();
    } catch (e) {
      error = e.auth ? '' : e.network ? '' : (e instanceof SyntaxError ? 'Il file del recap non è leggibile' : (e.message || 'Errore nel recap'));
    } finally { busy = false; notify(); }
  }

  const open = x => !Store.isHandled(x.id) && x.status !== 'done';
  const byPrio = (a, b) => (PRIO[a.priority] - PRIO[b.priority]) || ((a.due || '9999') < (b.due || '9999') ? -1 : 1) || (a.received < b.received ? 1 : -1);
  const hasTag = (x, tag) => !tag || (x.tags || []).some(t => t.toLowerCase() === tag.toLowerCase());
  const items = (cat, tag) => (data ? data.items.filter(x => x.category === cat && open(x) && hasTag(x, tag)).sort(byPrio) : []);
  const proposals = () => (data ? data.proposals.filter(p => !Store.isHandled(p.id)).sort((a, b) => (a.date < b.date ? -1 : 1)) : []);
  const forMessage = id => (data && id ? data.items.find(x => x.messageId === id) || null : null);
  const emailInfo = id => (data && id ? data.emails.find(x => x.messageId === id) || null : null);
  const tagsFor = id => { const e = emailInfo(id), it = forMessage(id); return [...new Set([...(e ? e.tags : []), ...(it ? it.tags : [])])]; };
  const important = tag => (data ? data.emails.filter(e => e.important && hasTag(e, tag))
    .sort((a, b) => (b.awaitingReply - a.awaitingReply) || (b.institution - a.institution) || (a.received < b.received ? 1 : -1)) : []);
  function allTags() {
    if (!data) return [];
    const count = new Map();
    [...data.items.filter(open), ...data.emails].forEach(x => (x.tags || []).forEach(t => count.set(t, (count.get(t) || 0) + 1)));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ tag: t, n }));
  }
  const findItem = id => (data ? data.items.find(x => x.id === id) || null : null);
  const findProposal = id => (data ? data.proposals.find(x => x.id === id) || null : null);

  function init() {
    if (Auth.mode === 'local') return;
    window.addEventListener('online', () => refresh());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - at > 120000) refresh(); });
    setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 10 * 60 * 1000);
    if (enabled()) setTimeout(refresh, 900);
    Sync.subscribe(() => { if (Sync.sessionSynced && Sync.status === 'ok') importTasks(); });
  }

  return {
    init, refresh, items, proposals, forMessage, emailInfo, tagsFor, important, allTags, findItem, findProposal, clean, importTasks,
    subscribe: f => listeners.add(f),
    get data() { return data; }, get busy() { return busy; }, get error() { return error; }, get at() { return at; },
  };
})();
