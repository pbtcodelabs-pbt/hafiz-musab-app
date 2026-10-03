// Hafiz Musab / Hifz Pro — Service Worker (HFZ310SA006)
// حکمتِ عملی: شیل فائلیں (index، manifest، آئیکن) انسٹال پر الگ الگ کیش؛ صفحہ کھلنے پر پہلے کیش (آف لائن فوری)،
// پس منظر میں نیٹ سے تازہ کاپی؛ آڈیو/بیرونی درخواستیں شیل کیش میں نہیں رکھی جاتیں (ایپ کا اپنا ڈاؤن لوڈ کیش استعمال ہوتا ہے)
const VERSION = 'HFZ310SA006';
const CACHE_NAME = 'hafiz-musab-shell-' + VERSION;
const SHELL_FILES = ['./', './index.html', './manifest.json', './icon-32.png', './icon-180.png', './icon-192.png', './icon-512.png'];

async function warmShellCache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(SHELL_FILES.map(async (f) => {
    try {
      const res = await fetch(f, { cache: 'reload' });
      if (res && res.ok) await cache.put(f, res.clone());
    } catch (e) { /* آف لائن — بعد میں کوشش ہو گی */ }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(warmShellCache());
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data === 'REWARM_SHELL_CACHE') event.waitUntil(warmShellCache());
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((n) => n.startsWith('hafiz-musab-shell-') && n !== CACHE_NAME)
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // اپڈیٹ چیک والی درخواست (?chk=) سروس ورکر سے براہ راست نیٹ پر جائے، کیش میں نہ جمع ہو
  if (url.origin === self.location.origin && url.searchParams.has('chk')) return;

  // صفحہ کھولنا: پہلے کیش، پھر پس منظر میں تازہ کاپی
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = (await cache.match('./index.html')) ||
                     (await cache.match('./index.html', { ignoreSearch: true })) ||
                     (await cache.match('./', { ignoreSearch: true }));
      const refresh = fetch('./index.html', { cache: 'no-cache' }).then(async (res) => {
        if (res && res.ok) await cache.put('./index.html', res.clone());
        return res;
      });
      if (cached) {
        event.waitUntil(refresh.catch(() => {}));
        return cached;
      }
      try { return await refresh; }
      catch (e) { return new Response('آف لائن — پہلی بار آن لائن کھولیں', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
    })());
    return;
  }

  // بیرونی سائٹ (آڈیو، ترجمہ API وغیرہ): نیٹ پہلے، ناکامی پر کسی بھی محفوظ کیش (ڈاؤن لوڈ شدہ آڈیو) سے
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(req)) || new Response('', { status: 408, statusText: 'Offline' }))
    );
    return;
  }

  // اپنی سائٹ کی باقی فائلیں: نیٹ پہلے (صرف مکمل 200 جواب کیش)، آف لائن میں کیش
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {}));
      }
      return res;
    } catch (e) {
      return (await caches.match(req, { ignoreSearch: true })) || new Response('', { status: 408, statusText: 'Offline' });
    }
  })());
});
