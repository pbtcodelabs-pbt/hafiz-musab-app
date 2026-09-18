//  — Service Worker
// ---------- 🐞 مالک کی ہدایت (HFZ18SEPFR): اصل خرابی — پہلے install کے وقت SHELL_FILES کیش کرنے کی کوشش
// ایک Promise.all چین میں تھی، اور کسی ایک فائل (خاص طور پر index.html، جو سب سے اہم ہے) کے fetch میں
// ناکامی خاموشی سے نگل لی جاتی تھی، بغیر کسی دوبارہ کوشش کے — نتیجہ یہ کہ index.html کبھی کیش ہی نہ ہو پاتا
// اور آف لائن میں ایپ کھلتی ہی نہ تھی۔ اب ہر شیل فائل کو الگ الگ await کے ساتھ کیش کیا جاتا ہے، اور "صفحہ کھولنے"
// (navigation) کی درخواست کو ہمیشہ پہلے کیش سے جواب دیا جاتا ہے (فوری + بھروسہ مند آف لائن آغاز)، پس منظر میں
// نیٹ سے تازہ کاپی بھی لے لی جاتی ہے تاکہ اگلی بار اپڈیٹ شدہ نظر آئے ---------- -->
const CACHE_NAME = 'hafiz-musab-shell-HFZ189FR0553PM';
const SHELL_FILES = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(SHELL_FILES.map(async (f) => {
        try {
          const res = await fetch(f, { cache: 'reload' });
          if (res && res.ok) await cache.put(f, res.clone());
        } catch (e) { /* یہ فائل ابھی کیش نہ ہو سکی — عام استعمال کے دوران fetch ہینڈلر خود بخود کیش کر لے گا */ }
      }));
    })()
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

  // ---------- 🧭 صفحہ کھولنے کی درخواست ہمیشہ پہلے کیش سے دیں — آف لائن میں فوری، بھروسہ مند لوڈ کے لیے،
  // پس منظر میں نیٹ سے تازہ کاپی بھی اپڈیٹ کر لیں ---------- -->
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cached = await caches.match('./index.html');
        const networkUpdate = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              caches.open(CACHE_NAME).then((c) => c.put('./index.html', res.clone()));
            }
            return res;
          })
          .catch(() => null);
        return cached || (await networkUpdate) || caches.match(req) ||
          new Response('', { status: 408, statusText: 'Offline' });
      })()
    );
    return;
  }

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
          return new Response('', { status: 408, statusText: 'Offline' });
        })
      )
  );
});
