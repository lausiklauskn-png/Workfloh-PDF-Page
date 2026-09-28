// Workfloh PDF · Landingpage — Service-Worker.
// Im Vorrat liegt nur die SCHALE. Die Videos (je ~25 MB) kommen immer aus dem
// Netz: der Browser holt sie in Stücken (Range-Anfragen), und drei Videos
// vorab in den Vorrat zu legen hieße, 75 MB auf den ersten Besuch zu laden.
// Wer eine Datei aus CORE ändert, erhöht CACHE_VERSION.
const CACHE_VERSION = 'workfloh-pdf-page-v5';
const CORE = [
  './', 'index.html', 'impressum.html', 'manifest.webmanifest',
  'icons/favicon-32.png?v=1', 'icons/apple-touch-icon.png?v=1', 'icons/w-floh-160.png?v=1',
  'icons/icon-192.png', 'icons/icon-512.png',
  'assets/poster-de.jpg', 'assets/poster-en.jpg', 'assets/poster-ru.jpg',
  'assets/poster-hoch-de.jpg', 'assets/poster-hoch-en.jpg', 'assets/poster-hoch-ru.jpg',
  'assets/poster-hochvoll-de.jpg', 'assets/poster-hochvoll-en.jpg', 'assets/poster-hochvoll-ru.jpg',
  'assets/kapitel-quer.json', 'assets/kapitel-quer-en.json', 'assets/kapitel-quer-ru.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || /\.mp4$/.test(u.pathname)) return;   // Videos: Netz, ohne Worker
  if (e.request.mode === 'navigate') {   // Seite: Netz zuerst, offline aus dem Vorrat
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
