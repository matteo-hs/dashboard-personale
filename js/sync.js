'use strict';
/* Sincronizzazione con OneDrive (cartella privata dell'app: Apps/Dashboard Personale/dashboard-data.json).
   Si lavora sempre sulla copia locale; quando c'è rete: scarica → unisce → ricarica se serve.
   Il caricamento usa l'eTag: se un altro dispositivo ha scritto nel frattempo, si riparte dall'unione. */
const Graph = (() => {
  async function call(path, opts = {}, retry = true) {
    const token = await Auth.getToken();
    let r;
    try {
      r = await fetch(CONFIG.graph + path, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
    } catch (e) { throw Object.assign(new Error('Rete non disponibile'), { network: true }); }
    if (r.status === 401 && retry && Auth.mode === 'ms') { Auth.invalidateAccess(); return call(path, opts, false); }
    return r;
  }
  const fail = async (r, what) => {
    let msg = `${what}: errore ${r.status}`;
    try { const j = await r.json(); if (j.error && j.error.message) msg += ` – ${j.error.message}`; } catch (e) { /* ignora */ }
    return Object.assign(new Error(msg), { status: r.status });
  };
  return { call, fail };
})();

const Sync = (() => {
  const META_KEY = 'hs-sync-meta';
  const FILE = encodeURIComponent(CONFIG.syncFile);
  let meta = { etag: null, last: 0, dirty: false };
  let status = 'idle'; // idle | syncing | ok | offline | error | auth | local
  let message = '';
  let timer = null, running = null, again = false, folderReady = false, sessionSynced = false;
  const listeners = new Set();

  try { meta = { ...meta, ...JSON.parse(localStorage.getItem(META_KEY) || '{}') }; } catch (e) { /* ignora */ }
  const saveMeta = () => { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* ignora */ } };
  function set(s, msg = '') {
    status = s; message = msg;
    // un errore nella visualizzazione non deve far risultare fallita la sincronizzazione
    listeners.forEach(f => { try { f(); } catch (e) { console.error('[sync listener]', e); } });
  }
  const enabled = () => Auth.mode !== 'local' && !!Auth.account;

  async function download() {
    if (!folderReady) {
      const f = await Graph.call('/me/drive/special/approot'); // crea la cartella dell'app al primo accesso
      if (!f.ok) throw await Graph.fail(f, 'Cartella OneDrive');
      folderReady = true;
    }
    const r = await Graph.call(`/me/drive/special/approot:/${FILE}`);
    if (r.status === 404) return null;
    if (!r.ok) throw await Graph.fail(r, 'Lettura dati');
    const item = await r.json();
    const url = item['@microsoft.graph.downloadUrl'];
    let d;
    try { d = await fetch(url, { cache: 'no-store' }); } catch (e) { throw Object.assign(new Error('Rete non disponibile'), { network: true }); }
    if (!d.ok) throw new Error(`Download dati: errore ${d.status}`);
    const text = await d.text();
    let data = null;
    try { data = text.trim() ? JSON.parse(text) : null; } catch (e) { throw new Error('Il file dati su OneDrive non è leggibile'); }
    return { data, etag: item.eTag };
  }

  async function upload(data, etag) {
    const headers = { 'Content-Type': 'application/json' };
    if (etag) headers['If-Match'] = etag;
    const r = await Graph.call(`/me/drive/special/approot:/${FILE}:/content`, { method: 'PUT', headers, body: JSON.stringify(data) });
    if (r.status === 412 || r.status === 409) throw Object.assign(new Error('Conflitto'), { conflict: true });
    if (!r.ok) throw await Graph.fail(r, 'Salvataggio dati');
    const item = await r.json();
    return item.eTag;
  }

  async function cycle(attempt = 0) {
    const remote = await download();
    const res = Store.mergeIn(remote && remote.data);
    if (res.remoteChanged || meta.dirty || !remote) {
      const v = Store.version;
      try {
        meta.etag = await upload(Store.snapshot(), remote ? remote.etag : null);
      } catch (e) {
        if (e.conflict && attempt < 3) return cycle(attempt + 1);
        throw e;
      }
      meta.dirty = Store.version !== v;
    } else {
      meta.etag = remote.etag;
    }
    meta.last = Date.now();
    saveMeta();
  }

  function syncNow() {
    if (!enabled()) return Promise.resolve();
    if (!navigator.onLine) { set('offline'); return Promise.resolve(); }
    if (running) { again = true; return running; }
    set('syncing');
    running = (async () => {
      try {
        await cycle();
        sessionSynced = true;
        set('ok');
      } catch (e) {
        console.error('[sync]', e);
        if (e.auth) set('auth', 'Accesso scaduto');
        else if (e.network) set('offline');
        else set('error', e.message || 'Errore di sincronizzazione');
      } finally {
        running = null;
        if (again || meta.dirty) { again = false; if (status === 'ok') schedule(1500); }
      }
    })();
    return running;
  }
  function schedule(ms = 2000) { clearTimeout(timer); timer = setTimeout(syncNow, ms); }

  function init() {
    if (Auth.mode === 'local') { set('local'); return; }
    Store.subscribe(source => {
      if (source === 'remote') return;
      meta.dirty = true; saveMeta();
      schedule(2500);
    });
    window.addEventListener('online', () => schedule(400));
    window.addEventListener('offline', () => set('offline'));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(300); });
    setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 120000);
    if (enabled()) schedule(200);
  }

  function describe() {
    const at = meta.last ? new Date(meta.last) : null;
    const hhmm = at ? `${U.pad(at.getHours())}:${U.pad(at.getMinutes())}` : '';
    switch (status) {
      case 'local': return { tone: 'muted', text: 'Versione locale: dati solo in questo browser' };
      case 'syncing': return { tone: 'busy', text: 'Sincronizzazione in corso…' };
      case 'ok': return { tone: 'ok', text: meta.dirty ? 'Modifiche in invio…' : `Sincronizzato alle ${hhmm}` };
      case 'offline': return { tone: 'warn', text: meta.dirty ? 'Offline · modifiche salvate sul dispositivo, verranno inviate' : 'Offline · stai lavorando sulla copia locale' };
      case 'auth': return { tone: 'warn', text: 'Accesso scaduto · riconnettiti per sincronizzare' };
      case 'error': return { tone: 'err', text: message || 'Errore di sincronizzazione' };
      default: return { tone: 'muted', text: meta.last ? `Ultima sincronizzazione ${hhmm}` : 'In attesa della prima sincronizzazione' };
    }
  }

  return {
    init, syncNow, schedule, describe, subscribe: f => listeners.add(f),
    get status() { return status; }, get sessionSynced() { return sessionSynced; }, get dirty() { return meta.dirty; }, get last() { return meta.last; },
    reset() { meta = { etag: null, last: 0, dirty: false }; saveMeta(); folderReady = false; },
  };
})();
