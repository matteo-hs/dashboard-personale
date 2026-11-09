'use strict';
/* Installazione come app, funzionamento offline (service worker) e aggiornamenti */
const PWA = (() => {
  let deferred = null, reg = null, prompted = false, reloading = false;
  const listeners = new Set();
  const notify = () => listeners.forEach(f => f());
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = () => 'serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname));

  function offerUpdate(worker) {
    if (!worker || prompted) return;
    prompted = true;
    UI.toast('È disponibile una nuova versione dell\'app', { label: 'Aggiorna', run: () => activate(worker) }, { sticky: true });
    notify();
  }
  /* Attiva la versione in attesa; se il browser non la attiva entro pochi secondi, ricarica i file da capo */
  function activate(worker) {
    worker.postMessage('skipWaiting');
    setTimeout(() => { if (!reloading) forceUpdate(); }, 4000);
  }
  function watch(r) {
    // nuova versione già scaricata in precedenza e rimasta in attesa
    if (r.waiting && navigator.serviceWorker.controller) offerUpdate(r.waiting);
    r.addEventListener('updatefound', () => {
      const nw = r.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(nw);
      });
    });
  }

  function init() {
    if (!supported()) return;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('./sw.js').then(r => {
      reg = r;
      watch(r);
      setInterval(() => r.update().catch(() => {}), 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') r.update().catch(() => {}); });
    }).catch(() => { /* l'app funziona comunque online */ });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      location.reload();
    });
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; notify(); });
    window.addEventListener('appinstalled', () => { deferred = null; notify(); UI.toast('App installata'); });
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }

  /* Versione pubblicata online (letta da sw.js, senza cache) */
  async function availableVersion() {
    if (!supported()) return null;
    try {
      const r = await fetch('./sw.js', { cache: 'no-store' });
      const m = (await r.text()).match(/const VERSION = 'hs-([\d.]+)'/);
      return m ? m[1] : null;
    } catch (e) { return null; }
  }

  /* Verifica e, se c'è, applica subito l'aggiornamento */
  async function checkAndUpdate() {
    if (!supported() || !reg) return { state: 'unsupported' };
    try { await reg.update(); } catch (e) { return { state: 'offline' }; }
    let w = reg.waiting || reg.installing;
    if (w && w.state !== 'installed' && w.state !== 'activated') {
      await new Promise(res => {
        const t = setTimeout(res, 15000);
        w.addEventListener('statechange', () => { if (['installed', 'activated', 'redundant'].includes(w.state)) { clearTimeout(t); res(); } });
      });
      w = reg.waiting;
    }
    if (w && navigator.serviceWorker.controller) { activate(w); return { state: 'updating' }; }
    return { state: 'none' };
  }

  /* Ultima risorsa: rimuove la copia offline dei file dell'app e la riscarica (i dati non vengono toccati) */
  async function forceUpdate() {
    reloading = true;
    try {
      const urls = [...document.scripts].map(s => s.src).filter(Boolean)
        .concat([...document.querySelectorAll('link[rel=stylesheet],link[rel=manifest]')].map(l => l.href), new URL('./', location.href).href, new URL('./sw.js', location.href).href);
      if (supported()) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k.startsWith('hs-')).map(k => caches.delete(k)));
      }
      await Promise.all(urls.map(u => fetch(u, { cache: 'reload' }).catch(() => {})));
    } finally {
      location.reload();
    }
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch (e) { /* ignora */ }
    deferred = null;
    notify();
  }
  return {
    init, install, availableVersion, checkAndUpdate, forceUpdate, subscribe: f => listeners.add(f),
    get canInstall() { return !!deferred; }, get standalone() { return standalone(); }, get updateReady() { return prompted; },
  };
})();
