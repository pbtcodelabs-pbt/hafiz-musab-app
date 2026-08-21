// 1508sa0831pm — Service Worker
const CACHE_NAME = 'hafiz-musab-shell-1508sa0831pm';
const SHELL_FILES = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // ہر فائل الگ الگ کیش کریں — ایک فائل ناکام ہونے سے باقی سب کا کیشنگ ناکام نہ ہو
      Promise.all(SHELL_FILES.map((f) => cache.add(f).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n.startsWith('hafiz-musab-shell-') && n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          // آف لائن اور کیش میں بھی نہیں — نیویگیشن کی صورت میں کم از کم index.html دکھائیں
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 408, statusText: 'Offline' });
        })
      )
  );
});
