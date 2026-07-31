// ══ Hafiz Musab App — Service Worker ══
// نوٹ: کیش کا نام ہر نئے ورژن پر بدلیں (CACHE_NAME میں ورژن نمبر)، بالکل
// index.html کے اندر موجود APP_VERSION کی طرح — تاکہ forceRefresh() اور
// activate والا حصہ پرانی کیش خودکار صاف کر دے اور فون پر ہمیشہ تازہ ترین
// فائل ہی چلے۔
const CACHE_NAME = 'hafiz-musab-shell-Hfz055';

// صرف "شیل" — یعنی خود ایپ کی بنیادی فائلیں — کیش ہوتی ہیں۔
// آڈیو/تلاوت اور قرآن اے پی آئی جیسی بڑی/متغیر چیزیں یہاں کیش نہیں ہوتیں
// تاکہ فون کی سٹوریج نہ بھرے۔
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-32.png',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL).catch(() => {
        // اگر کوئی فائل موجود نہ ہو (مثلاً آئیکن نام مختلف ہو) تو انسٹال فیل نہ ہو
      })
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n.startsWith('hafiz-musab-shell-') && n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // صرف اپنی ایپ کی فائلیں (اسی origin سے) کیش کے ساتھ سنبھالیں —
  // باہر کی چیزیں (قاری کی آڈیو، قرآن اے پی آئی، فونٹس وغیرہ) براہ راست نیٹ ورک سے
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      // آف لائن ہونے پر فوراً کیش سے دکھائیں، ورنہ نیٹ ورک کا انتظار کریں
      return cached || network;
    })
  );
});
