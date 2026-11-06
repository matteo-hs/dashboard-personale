'use strict';
/* Recap intelligente della posta: file recap.json scritto su OneDrive dall'attività pianificata di Claude
   (cartella dell'app). L'app lo legge, lo controlla e lo mostra; ogni testo viene trattato come dato, mai come codice. */
const Recap = (() => {
  const LS = 'hs-recap-cache';
  const CATS = ['reply', 'define', 'upcoming', 'info'];
  const PRIO = { alta: 0, media: 1, bassa: 2 };
  let data = null, etag = null, at = 0, busy = false, error = '';
  const listeners = new Set();
  const notify = () => listeners.forEach(f => f());
  try { const c = JSON.parse(localStorage.getItem(LS) || 'null'); if (c) { data = c.data; etag = c.etag; at = c.at || 0; } } catch (e) { /* ignora */ }
  const save = () => { try { localStorage.setItem(LS, JSON.stringify({ data, etag, at })); } catch (e) { /* ignora */ } };
  const enabled = () => Auth.mode !== 'local' && !!Auth.account;

  const str = (v, max = 400) => (typeof v === 'string' ? v.slice(0, max) : '');
  const isoDate = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const hhmm = v => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : '');
  function clean(j) {
    if (!j || typeof j !== 'object') throw new Error('Formato del recap non valido');
    const items = (Array.isArray(j.items) ? j.items : []).slice(0, 80).map((x, i) => ({
      id: str(x.id, 300) || `r-${str(x.messageId, 300) || i}`,
      category: CATS.includes(x.category) ? x.category : 'info',
      priority: PRIO[x.priority] !== undefined ? x.priority : 'media',
      messageId: str(x.messageId, 300), webLink: str(x.webLink, 1000),
      from: str(x.from, 120), fromAddress: str(x.fromAddress, 200), subject: str(x.subject, 300),
      received: str(x.received, 40), reason: str(x.reason, 500), due: isoDate(x.due),
      suggestedReply: str(x.suggestedReply, 4000),
    }));
    const proposals = (Array.isArray(j.proposals) ? j.proposals : []).slice(0, 30).map((x, i) => ({
      id: str(x.id, 300) || `p-${str(x.messageId, 300)}-${i}`,
      title: str(x.title, 200), date: isoDate(x.date) || U.todayISO(), start: hhmm(x.start), end: hhmm(x.end),
      labels: (Array.isArray(x.labels) ? x.labels : []).filter(l => ['didattica', 'personale', 'sede', 'appuntamento'].includes(l)),
      project: str(x.project, 80),
      people: (Array.isArray(x.people) ? x.people : []).slice(0, 8).map(p => ({ name: str(p && p.name, 120), email: str(p && p.email, 200) })).filter(p => p.name),
      notes: str(x.notes, 1500), messageId: str(x.messageId, 300), webLink: str(x.webLink, 1000), subject: str(x.subject, 300),
    })).filter(p => p.title);
    return { schema: 1, generatedAt: str(j.generatedAt, 40), summary: str(j.summary, 1500), items, proposals };
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
    } catch (e) {
      error = e.auth ? '' : e.network ? '' : (e instanceof SyntaxError ? 'Il file del recap non è leggibile' : (e.message || 'Errore nel recap'));
    } finally { busy = false; notify(); }
  }

  const byPrio = (a, b) => (PRIO[a.priority] - PRIO[b.priority]) || ((a.due || '9999') < (b.due || '9999') ? -1 : 1) || (a.received < b.received ? 1 : -1);
  const items = cat => (data ? data.items.filter(x => x.category === cat && !Store.isHandled(x.id)).sort(byPrio) : []);
  const proposals = () => (data ? data.proposals.filter(p => !Store.isHandled(p.id)).sort((a, b) => (a.date < b.date ? -1 : 1)) : []);
  const forMessage = id => (data && id ? data.items.find(x => x.messageId === id) || null : null);
  const findItem = id => (data ? data.items.find(x => x.id === id) || null : null);
  const findProposal = id => (data ? data.proposals.find(x => x.id === id) || null : null);

  function init() {
    if (Auth.mode === 'local') return;
    window.addEventListener('online', () => refresh());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - at > 120000) refresh(); });
    setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 10 * 60 * 1000);
    if (enabled()) setTimeout(refresh, 900);
  }

  return {
    init, refresh, items, proposals, forMessage, findItem, findProposal, clean, subscribe: f => listeners.add(f),
    get data() { return data; }, get busy() { return busy; }, get error() { return error; }, get at() { return at; },
  };
})();
