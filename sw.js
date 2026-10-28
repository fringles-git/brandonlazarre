/* Notes — offline support. VERSION and FILES are filled at build time; a new VERSION makes the app offer "Recharger". */
const VERSION = 'notes-20261028184501';
const SHARE_CACHE = 'notes-share';   // files shared to Notes, picked up by the app
const EXTRAS = 'notes-extras';       // vendor/extra: big optional libraries, cached on first use, kept across updates
const FILES = ['./', './manifest.webmanifest', './vendor/pdf.min.js', './vendor/pdf.worker.min.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png']
  .concat(["./assets/figtree-latin-ext-wght-normal-DCwSJGxG.woff2","./assets/figtree-latin-wght-normal-D_ZTVpCC.woff2","./assets/index-CJzXtT6m.css","./assets/index-BXlTp0ry.js","./assets/Changelog-C5yVuwHu.js","./assets/changelog-BbioMW3e.js"]);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)));   // no skipWaiting: the app asks first
});
self.addEventListener('message', event => { if (event.data === 'skip-waiting') self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== SHARE_CACHE && k !== EXTRAS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
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
  // The app shell: network first (always the latest deploy online), cache when offline or slow.
  // A non-2xx response is not a valid shell: keep the cached app usable behind transient
  // proxy/auth errors instead of returning the server's error page to the installed PWA.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await Promise.race([
          fetch(request, { cache: 'no-store' }),
          new Promise((_, no) => setTimeout(() => no(new Error('navigation timeout')), 3000)),
        ]);
        if (fresh.ok) {
          (await caches.open(VERSION)).put('./', fresh.clone()).catch(() => {});
          return fresh;
        }
        const cached = await caches.match('./');
        return cached || fresh;
      } catch {
        return (await caches.match('./')) || fetch(request);
      }
    })());
    return;
  }
  if (url.pathname.includes('/vendor/extra/')) {
    event.respondWith(caches.open(EXTRAS).then(cache => cache.match(request).then(hit => hit || fetch(request).then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    }))));
    return;
  }
  event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list =>
    list.length ? list[0].focus() : self.clients.openWindow('./')));
});
