// ══════════════════════════════════════════════════════════
// Hafiz Musab App — Service Worker
// صرف ایپ شیل (HTML/آئیکنز/مینی فیسٹ/فونٹس) کو آف لائن کیش کرتا ہے۔
// قرآن کی تلاوت والی آڈیو فائلیں اس سروس ورکر کے ذریعے کیش نہیں ہوتیں —
// وہ خود ایپ کے اندر موجود ڈاؤن لوڈ سسٹم (cache 'quran-audio-v2') سنبھالتا ہے،
// اس لیے یہاں انہیں جان بوجھ کر چھوا نہیں گیا تاکہ دونوں سسٹم آپس میں نہ ٹکرائیں۔
// ══════════════════════════════════════════════════════════

const SHELL_CACHE = 'hafiz-musab-shell-v1';

// یہ فائلیں انہی ناموں سے اسی فولڈر میں موجود ہونی چاہئیں (index.html کے ساتھ)
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-32.png',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

// یہ ڈومینز کبھی بھی اس سروس ورکر میں انٹرسیپٹ نہیں ہوں گے —
// قرآن آڈیو + آرٹ ورک امیج۔ انہیں براہ راست نیٹ ورک/براؤزر پر چھوڑ دیا جاتا ہے۔
const AUDIO_HOSTS = [
  'everyayah.com',
  'cdn.islamic.network',
  'download.quranicaudio.com',
  'archive.org',
  'ia803005.us.archive.org',
  'ia601504.us.archive.org',
  'upload.wikimedia.org'
];

// یہ ڈومینز فونٹس کے لیے ہیں — دستیاب ہونے پر کیش، ورنہ خاموشی سے ناکام
// (ایپ خود بخود 'JN' لوکل فونٹ پر واپس چلی جاتی ہے)
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// ── INSTALL: ایپ شیل کو کیش کریں (ہر فائل الگ الگ — ایک فائل غائب ہونے سے باقی سب فیل نہ ہوں) ──
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(
      SHELL_FILES.map(async (url) => {
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (res && res.ok) await cache.put(url, res.clone());
        } catch (e) {
          // اگر کوئی آئیکن/فائل موجود نہیں تو نظرانداز کریں، پوری تنصیب نہ روکیں
        }
      })
    );
    self.skipWaiting();
  })());
});

// ── ACTIVATE: صرف اپنی پرانی shell کیشز صاف کریں، quran-audio کیش کو کبھی نہ چھوئیں ──
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.map((name) => {
        if (name.startsWith('hafiz-musab-shell-') && name !== SHELL_CACHE) {
          return caches.delete(name);
        }
        return Promise.resolve();
      })
    );
    await self.clients.claim();
  })());
});

// ── FETCH ──
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1) قرآن آڈیو / آرٹ ورک — بالکل مداخلت نہیں (ایپ کا اپنا سسٹم سنبھالے گا)
  if (AUDIO_HOSTS.some((h) => url.hostname.endsWith(h))) {
    return; // respondWith کال نہیں کی — براؤزر نارمل نیٹ ورک ریکویسٹ کرے گا
  }

  // 2) صفحہ کھلنے کی درخواست (navigation) — پہلے کیش، پھر نیٹ ورک (آف لائن گارنٹی)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match('./index.html');
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        return cached || Response.error();
      }
    })());
    return;
  }

  // 3) گوگل فونٹس — stale-while-revalidate (کیش فوراً دکھائیں، پس منظر میں اپڈیٹ کریں)
  if (FONT_HOSTS.some((h) => url.hostname.endsWith(h))) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(req);
      const networkFetch = fetch(req)
        .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => null);
      return cached || (await networkFetch) || Response.error();
    })());
    return;
  }

  // 4) باقی سب same-origin فائلیں (CSS/JS/آئیکنز/مینی فیسٹ) — cache-first
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        return cached || Response.error();
      }
    })());
  }
  // باقی کسی بھی نامعلوم third-party ریکویسٹ کو چھیڑا نہیں جاتا — نارمل نیٹ ورک پر جائے گی
});
