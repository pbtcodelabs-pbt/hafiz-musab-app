// Hafiz Musab / Hifz Pro — Service Worker (HFZ310SA007)
// حکمتِ عملی: شیل فائلیں (index، manifest، آئیکن) انسٹال پر الگ الگ کیش؛ صفحہ کھلنے پر پہلے کیش (آف لائن فوری)،
// پس منظر میں نیٹ سے تازہ کاپی؛ آڈیو/بیرونی درخواستیں شیل کیش میں نہیں رکھی جاتیں (ایپ کا اپنا ڈاؤن لوڈ کیش استعمال ہوتا ہے)
const VERSION = 'HFZ310SA007';
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

// ══ 📥 بیک گراؤنڈ ڈاؤن لوڈ — ایپ بند ہونے کے بعد بھی جاری رہتا ہے ══
const AUDIO_CACHE = 'quran-audio-v2';
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('hfz-dl', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function kvGet(k) {
  try {
    const db = await idbOpen();
    return await new Promise((res) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); });
  } catch (e) { return undefined; }
}
async function kvSet(k, v) {
  try {
    const db = await idbOpen();
    return await new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false); });
  } catch (e) { return false; }
}
async function startNextInQueue() {
  const q = await kvGet('dlQueue');
  if (!q || !q.items || !q.items.length) return;
  const cache = await caches.open(AUDIO_CACHE);
  while (q.items.length) {
    const it = q.items[0];
    const urls = [];
    for (const u of it.urls) { if (!(await cache.match(u))) urls.push(u); }
    if (!urls.length) {
      const st = (await kvGet('dlSt')) || {};
      st[it.qk + '_' + it.sn] = { done: true, size: 0 };
      await kvSet('dlSt', st);
      q.items.shift();
      continue;
    }
    try {
      await self.registration.backgroundFetch.fetch('hfz|' + it.qk + '|' + it.sn + '|' + Date.now(), urls,
        { title: it.title, icons: [{ src: './icon-192.png', sizes: '192x192', type: 'image/png' }], downloadTotal: 0 });
    } catch (e) { /* صفحہ دوبارہ کھلنے پر ایپ خود جاری رکھے گی */ }
    break;
  }
  await kvSet('dlQueue', q);
}
async function finishItem(id, ok) {
  const parts = id.split('|');
  const qk = parts[1], sn = parseInt(parts[2], 10);
  const q = (await kvGet('dlQueue')) || { items: [], total: 0 };
  const idx = q.items.findIndex((i) => i.qk === qk && i.sn === sn);
  if (idx >= 0) {
    if (ok) q.items.splice(idx, 1);
    else { q.items[idx].tries = (q.items[idx].tries || 0) + 1; if (q.items[idx].tries >= 2) q.items.splice(idx, 1); }
    await kvSet('dlQueue', q);
  }
  await startNextInQueue();
}
self.addEventListener('backgroundfetchsuccess', (event) => {
  const bf = event.registration;
  event.waitUntil((async () => {
    let ok = true;
    try {
      const cache = await caches.open(AUDIO_CACHE);
      const recs = await bf.matchAll();
      await Promise.all(recs.map(async (r) => {
        try {
          const res = await r.responseReady;
          if (res && res.ok) await cache.put(r.request.url, res); else ok = false;
        } catch (e) { ok = false; }
      }));
      if (ok) {
        const parts = bf.id.split('|');
        const st = (await kvGet('dlSt')) || {};
        st[parts[1] + '_' + parts[2]] = { done: true, size: 0 };
        await kvSet('dlSt', st);
      }
    } catch (e) { ok = false; }
    try { await event.updateUI({ title: ok ? '✅ ڈاؤن لوڈ مکمل' : '❌ ڈاؤن لوڈ ناکام' }); } catch (e) {}
    await finishItem(bf.id, ok);
  })());
});
self.addEventListener('backgroundfetchfail', (event) => {
  event.waitUntil(finishItem(event.registration.id, false));
});
self.addEventListener('backgroundfetchclick', (event) => {
  event.waitUntil(clients.openWindow('./'));
});
