'use strict';
/* Installazione come app e funzionamento offline (service worker) */
const PWA = (() => {
  let deferred = null;
  const listeners = new Set();
  const notify = () => listeners.forEach(f => f());
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function init() {
    const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!('serviceWorker' in navigator) || !secure) return;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            UI.toast('È disponibile una nuova versione dell\'app', { label: 'Aggiorna', run: () => nw.postMessage('skipWaiting') }, { sticky: true });
          }
        });
      });
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    }).catch(() => { /* ignora: l'app funziona comunque online */ });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      location.reload();
    });
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; notify(); });
    window.addEventListener('appinstalled', () => { deferred = null; notify(); UI.toast('App installata'); });
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }
  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch (e) { /* ignora */ }
    deferred = null;
    notify();
  }
  return { init, install, subscribe: f => listeners.add(f), get canInstall() { return !!deferred; }, get standalone() { return standalone(); } };
})();
