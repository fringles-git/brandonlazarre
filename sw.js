/* Notes — offline support. Bump VERSION on every release: the app then offers "Recharger". */
const VERSION = 'notes-20261009122437';
const SHARE_CACHE = 'notes-share';   // files shared to Notes, picked up by the app
const FILES = ['./', './index.html', './manifest.webmanifest', './vendor/pdf.min.js', './vendor/pdf.worker.min.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)));   // no skipWaiting: the app asks first
});
self.addEventListener('message', event => { if (event.data === 'skip-waiting') self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== SHARE_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  // Share target: keep the shared files, then open the app, which turns them into a note
  if (request.method === 'POST' && url.searchParams.get('share') === 'receive') {
    event.respondWith((async () => {
      const data = await request.formData(), cache = await caches.open(SHARE_CACHE);
      const files = data.getAll('files').filter(f => f && f.size);
      await Promise.all(files.map((f, i) => cache.put('shared/' + Date.now() + '-' + i,
        new Response(f, { headers: { 'Content-Type': f.type, 'X-File-Name': encodeURIComponent(f.name) } }))));
      const back = new URL('./', url);
      back.searchParams.set('share-files', '1');
      ['title', 'text', 'url'].forEach(k => { const v = data.get(k); if (v) back.searchParams.set(k, v); });
      return Response.redirect(back.href, 303);
    })());
    return;
  }
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  // The app itself (any navigation, whatever its ?query): cache first, so it opens offline
  if (request.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then(hit => hit || fetch(request)));
    return;
  }
  event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
});

// A reminder notification opens (or focuses) the app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list =>
    list.length ? list[0].focus() : self.clients.openWindow('./')));
});
