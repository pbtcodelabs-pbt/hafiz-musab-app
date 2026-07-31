// ══ Hafiz Musab App — Service Worker ══
// نوٹ: جب بھی index.html میں APP_VERSION بدلیں (مثلاً Hfz056 → Hfz057)،
// نیچے SW_VERSION بھی اسی طرح بدل دیں تاکہ پرانی کیش خودکار صاف ہو جائے۔
const SW_VERSION = 'Hfz056';
const SHELL_CACHE = 'hafiz-musab-shell-' + SW_VERSION;

// ایپ شیل کی فائلیں — یہ آف لائن چلنے کے لیے درکار ہیں۔
// (آڈیو فائلیں یہاں شامل نہیں — وہ 'quran-audio-v2' کیش میں الگ سے،
//  ڈاؤن لوڈ مینیجر کے ذریعے محفوظ ہوتی ہیں)
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-32.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_FILES).catch(() => {
        // اگر کوئی فائل (مثلاً کوئی آئیکن) موجود نہ ہو تو پوری انسٹال ناکام نہ ہو
        return Promise.allSettled(SHELL_FILES.map((f) => cache.add(f)));
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.map((n) => {
          // صرف پرانی 'shell' کیشز صاف کریں — آڈیو کیش (quran-audio-v2) کو ہاتھ نہ لگائیں
          if (n.startsWith('hafiz-musab-shell-') && n !== SHELL_CACHE) {
            return caches.delete(n);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // فونٹس/CDN اور آڈیو یو آر ایلز کو سروس ورکر نہ چھوئے — وہ ایپ خود سنبھالتی ہے
  if (url.origin !== self.location.origin) return;

  // ایپ شیل: پہلے نیٹ ورک، ناکامی پر کیش (تازہ ترین فائل ترجیح، آف لائن پر پرانا ورژن)
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match('./index.html'))
      )
  );
});
