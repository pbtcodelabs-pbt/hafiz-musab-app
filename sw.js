// ══ Hafiz Musab App — Service Worker ══
// یہ صرف ایپ کے بنیادی خول (index.html, manifest, icons) کو آف لائن کے لیے کیش کرتا ہے۔
// تلاوت (آڈیو) فائلوں کی اپنی الگ کیشنگ ایپ کے اندر 'quran-audio-v2' کیش سے پہلے سے ہو رہی ہے —
// اس سروس ورکر کو اُس کیش سے کوئی سروکار نہیں، لہٰذا آڈیو ڈاؤن لوڈ مینیجر متاثر نہیں ہوگا۔

const SHELL_CACHE = 'qhafiz-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-32.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

// نصب کے وقت بنیادی فائلیں کیش کریں
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return Promise.all(
        SHELL_FILES.map((f) => cache.add(f).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// پرانے ورژن کی کیش صاف کریں (audio cache کو ہاتھ نہ لگائیں)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== SHELL_CACHE && key !== 'quran-audio-v2') {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// fetch حکمتِ عملی:
// - اپنی سائٹ کی بنیادی فائلوں کے لیے: پہلے کیش، ناکامی پر نیٹ ورک (offline-first)
// - باقی سب کے لیے (فونٹس، آڈیو وغیرہ): پہلے نیٹ ورک، ناکامی پر کیش
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isShellFile = url.origin === self.location.origin &&
    (req.mode === 'navigate' ||
     url.pathname.endsWith('index.html') ||
     url.pathname.endsWith('manifest.json') ||
     url.pathname.match(/icon-(32|180|192|512)\.png$/) ||
     url.pathname === '/' );

  if (isShellFile) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req).then((res) => {
          if (res && res.ok) {
            caches.open(SHELL_CACHE).then((c) => c.put(req, res.clone()));
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  } else {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
  }
});
