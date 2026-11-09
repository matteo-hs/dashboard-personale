/* Service worker: tiene in memoria i file dell'app per l'uso offline.
   IMPORTANTE: a ogni nuova versione aggiornare VERSION (e l'elenco ASSETS se cambiano i file). */
const VERSION = 'hs-0.5.1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/config.js',
  './js/utils.js',
  './js/store.js',
  './js/auth.js',
  './js/sync.js',
  './js/pwa.js',
  './js/outlook.js',
  './js/recap.js',
  './js/components.js',
  './js/recap-ui.js',
  './js/view-login.js',
  './js/view-dashboard.js',
  './js/view-mail.js',
  './js/view-agenda.js',
  './js/view-calendar.js',
  './js/view-settings.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('hs-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') e.waitUntil(self.skipWaiting()); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Microsoft e OneDrive: sempre in rete, mai in cache
  if (req.mode === 'navigate') {
    // la pagina (anche al ritorno dal login con ?code=…) viene dalla versione in memoria
    e.respondWith(caches.match('./index.html').then(hit => hit || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});
