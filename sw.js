// Hafiz Musab / Hifz Pro — Service Worker (HFZ810TH020)
// ══ آف لائن حکمتِ عملی ══
// 1) شیل (index، manifest، آئیکن): انسٹال پر کیش؛ صفحہ کھلنے پر پہلے کیش (فوری، آف لائن)، پس منظر میں تازہ کاپی
// 2) فونٹس (نوری نستعلیق، امیری، نسخ): پہلی بار آن لائن ملتے ہی مستقل کیش — آف لائن بھی خوبصورت اردو/عربی
// 3) پاروں کا رکوع ڈیٹا (alquran.cloud/juz): نیٹ پہلے (6 سیکنڈ حد)، ناکامی پر کیش
// 4) ڈاؤن لوڈ شدہ تلاوت (quran-audio-v2): کیش پہلے — نیٹ کا ایک بائٹ بھی خرچ نہیں، Range (آگے پیچھے) سپورٹ
// 5) welcome.txt وغیرہ: ?t= کے بغیر ایک ہی کاپی محفوظ (کیش پھولتی نہیں)
const VERSION = 'HFZ810TH020';
const CACHE_NAME = 'hafiz-musab-shell-' + VERSION;
const FONT_CACHE = 'hfz-fonts-v1';
const API_CACHE = 'hfz-api-v1';
const AUDIO_CACHE = 'quran-audio-v2';
const SHELL_FILES = ['./', './index.html', './manifest.json', './icon-32.png', './icon-180.png', './icon-192.png', './icon-512.png', './hifz-pro-poster.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

// ری ڈائریکٹ شدہ جواب کو صاف کاپی میں بدلنا — ورنہ صفحہ کھولتے وقت براؤزر غلطی دیتا ہے
async function cleanResponse(res) {
  if (!res || !res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

// full=true: انسٹال پر سب تازہ؛ full=false: صرف وہ فائلیں جو کیش میں نہیں (ہر بار 3MB ڈاؤن لوڈ نہیں)
async function warmShellCache(full) {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(SHELL_FILES.map(async (f) => {
    try {
      if (!full && (await cache.match(f))) return;
      const res = await fetch(f, { cache: full ? 'reload' : 'no-cache' });
      if (res && res.ok) await cache.put(f, await cleanResponse(res));
    } catch (e) { /* آف لائن — بعد میں کوشش ہو گی */ }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(warmShellCache(true));
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data === 'REWARM_SHELL_CACHE') event.waitUntil(warmShellCache(false));
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  // ایپ پیچھے گئی/بند ہوئی — باقی ڈاؤن لوڈ Background Fetch سے جاری (HFZ810TH020)
  if (event.data === 'BG_QUEUE') event.waitUntil(startNextInQueue());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // پچھلے ورژن کا index.html نئی کیش میں منتقل (اگر نئی ابھی خالی ہو) تاکہ آف لائن کبھی خالی اسکرین نہ آئے
    const names = await caches.keys();
    const cur = await caches.open(CACHE_NAME);
    if (!(await cur.match('./index.html'))) {
      for (const n of names) {
        if (n.startsWith('hafiz-musab-shell-') && n !== CACHE_NAME) {
          const old = await (await caches.open(n)).match('./index.html');
          if (old) { await cur.put('./index.html', old); break; }
        }
      }
    }
    await Promise.all(names
      .filter((n) => n.startsWith('hafiz-musab-shell-') && n !== CACHE_NAME)
      .map((n) => caches.delete(n)));
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.disable(); } catch (e) {} }
    await self.clients.claim();
  })());
});

function offlinePage() {
  const html = '<!doctype html><html lang="ur" dir="rtl"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Hifz Pro — آف لائن</title>' +
    '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:linear-gradient(160deg,#064e3b,#022c22);color:#fef3c7;font-family:serif;text-align:center;padding:24px;box-sizing:border-box}' +
    'h1{font-size:28px;margin:0 0 12px}p{font-size:18px;line-height:2}button{margin-top:16px;padding:12px 28px;font-size:18px;' +
    'border:0;border-radius:14px;background:#16a34a;color:#fff}</style></head><body><div>' +
    '<h1>📖 Hifz Pro</h1><p>آپ آف لائن ہیں۔<br>ایپ پہلی بار انٹرنیٹ کے ساتھ ایک دفعہ کھولیں،<br>اس کے بعد ان شاء اللہ بغیر نیٹ کے بھی چلے گی۔</p>' +
    '<button onclick="location.reload()">دوبارہ کوشش کریں</button></div></body></html>';
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

// ڈاؤن لوڈ شدہ آڈیو کو Range درخواست کے مطابق 206 جواب بنانا (آڈیو آگے/پیچھے کرنے کے لیے)
async function rangeResponse(req, cached) {
  const range = req.headers.get('range');
  if (!range) return cached;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) return cached;
  const blob = await cached.blob();
  const size = blob.size;
  let start = m[1] === '' ? NaN : parseInt(m[1], 10);
  let end = m[2] === '' ? size - 1 : parseInt(m[2], 10);
  if (isNaN(start)) { start = Math.max(0, size - end); end = size - 1; }
  end = Math.min(end, size - 1);
  if (start >= size || start > end) {
    return new Response('', { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  }
  const part = blob.slice(start, end + 1);
  return new Response(part, {
    status: 206, statusText: 'Partial Content',
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
      'Content-Length': String(part.size),
      'Accept-Ranges': 'bytes'
    }
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  // اپڈیٹ چیک والی درخواست (?chk=) سروس ورکر سے براہ راست نیٹ پر جائے، کیش میں نہ جمع ہو
  if (url.origin === self.location.origin && url.searchParams.has('chk')) return;

  // ── صفحہ کھولنا: پہلے کیش (فوری)، پس منظر میں تازہ کاپی ──
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = (await cache.match('./index.html')) ||
                     (await cache.match('./index.html', { ignoreSearch: true })) ||
                     (await cache.match('./', { ignoreSearch: true }));
      const refresh = fetch('./index.html', { cache: 'no-cache' }).then(async (res) => {
        if (res && res.ok) {
          const clean = await cleanResponse(res);
          await cache.put('./index.html', clean.clone());
          return clean;
        }
        return res;
      });
      if (cached) {
        event.waitUntil(refresh.catch(() => {}));
        return cached;
      }
      try {
        const res = await refresh;
        if (res && res.ok) return res;
        throw new Error('bad');
      } catch (e) {
        try { return await fetch(req); } catch (e2) { return offlinePage(); }
      }
    })());
    return;
  }

  // ── فونٹس: کیش پہلے (نہ ہو تو نیٹ سے لا کر محفوظ) ──
  if (FONT_HOSTS.includes(url.hostname) &&
      (url.hostname !== 'cdn.jsdelivr.net' || /urdu-fonts|\.(woff2?|ttf|otf|css)(\?|$)/i.test(url.pathname))) {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const cached = await cache.match(req, { ignoreVary: true });
      const net = fetch(req).then(async (res) => {
        if (res && (res.ok || res.type === 'opaque')) await cache.put(req, res.clone());
        return res;
      });
      if (cached) {
        // CSS فائلیں پس منظر میں تازہ ہوں؛ فونٹ فائلیں کبھی نہیں بدلتیں
        if (/\.css|css2?$/i.test(url.pathname) || url.hostname === 'fonts.googleapis.com') event.waitUntil(net.catch(() => {}));
        return cached;
      }
      try { return await net; }
      catch (e) { return new Response('', { status: 408, statusText: 'Offline' }); }
    })());
    return;
  }

  // ── رکوع ڈیٹا (پارہ): نیٹ پہلے (6 سیکنڈ)، ناکامی پر کیش ──
  if (url.hostname === 'api.alquran.cloud' && url.pathname.startsWith('/v1/juz/')) {
    event.respondWith((async () => {
      const cache = await caches.open(API_CACHE);
      try {
        const res = await withTimeout(fetch(req), 6000);
        if (res && res.ok) event.waitUntil(cache.put(req, res.clone()).catch(() => {}));
        return res;
      } catch (e) {
        return (await cache.match(req)) || new Response('{"code":503}', { status: 503, headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // ── باقی بیرونی (آڈیو، ترجمہ API): ڈاؤن لوڈ شدہ آڈیو ہو تو کیش پہلے، ورنہ نیٹ ──
  if (url.origin !== self.location.origin) {
    event.respondWith((async () => {
      try {
        const ac = await caches.open(AUDIO_CACHE);
        const hit = await ac.match(req.url);
        if (hit) return await rangeResponse(req, hit);
      } catch (e) {}
      try { return await fetch(req); }
      catch (e) {
        const any = await caches.match(req.url, { ignoreVary: true });
        return any ? rangeResponse(req, any) : new Response('', { status: 408, statusText: 'Offline' });
      }
    })());
    return;
  }

  // ── اپنی سائٹ کی باقی فائلیں (welcome.txt، video-link.txt، آئیکن): نیٹ پہلے، آف لائن میں کیش ──
  // کیش کی کنجی ?t= کے بغیر — ہر بار نئی کاپی جمع نہیں ہوتی
  const key = url.origin + url.pathname;
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = await cleanResponse(res.clone());
        event.waitUntil(caches.open(CACHE_NAME).then((c) => c.put(key, copy)).catch(() => {}));
      }
      return res;
    } catch (e) {
      return (await caches.match(key, { ignoreSearch: true })) ||
             (await caches.match(req, { ignoreSearch: true })) ||
             new Response('', { status: 408, statusText: 'Offline' });
    }
  })());
});

// ══ 📥 بیک گراؤنڈ ڈاؤن لوڈ — ایپ بند ہونے کے بعد بھی جاری رہتا ہے ══
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
async function startNextInQueue(curId) {
  // ایپ سامنے کھلی ہو تو ایپ خود تیز ڈاؤن لوڈ کرتی ہے؛ پہلے سے کوئی پس منظر ڈاؤن لوڈ چل رہا ہو تو دوسرا نہیں
  try {
    const cl = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (cl.some((c) => c.visibilityState === 'visible')) return;
    const ids = await self.registration.backgroundFetch.getIds();
    if (ids.some((i) => i.startsWith('hfz|') && i !== curId)) return;
  } catch (e) {}
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
  await startNextInQueue(id);
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
