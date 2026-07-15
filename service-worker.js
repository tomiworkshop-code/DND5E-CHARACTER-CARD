/* 羊皮卷 PWA Service Worker */
const CACHE = 'parchment-dnd5e-v8-netfirst';
const ASSETS = [
  './',
  './manifest.json',
  './shared/character-schema.js',
  './data/races.json',
  './data/spells.json',
  './data/items.json',
  './data/sources.json',
  './data/classes.json',
  './data/SCHEMA.md',
  'https://unpkg.com/vue@3/dist/vue.global.prod.js',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(
        ASSETS.map((u) => c.add(u).catch(() => null))
      )
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    // 同源（navigation、index、data/*.json、manifest、sources、SCHEMA 等）：
    // network-first → 先 fetch，成功就更新快取 + 回傳網路版；網路失敗才回快取。
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(e.request).then((hit) => {
            if (hit) return hit;
            // navigate 失敗最終退回 index.html
            if (e.request.mode === 'navigate') return caches.match('./');
            return Response.error();
          })
        )
    );
    return;
  }

  // 跨源 CDN（unpkg Vue、cdn.tailwindcss）：cache-first（穩定且離線必需），
  // 找不到再 network 並順手快取。
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => Response.error());
    })
  );
});
