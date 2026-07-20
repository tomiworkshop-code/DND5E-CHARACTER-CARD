/* 冒險者之書 V2 · Service Worker（統一儀表板） */
const CACHE = 'dnd-v2-v8';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  '../shared/character-schema.js',
  '../shared/store.js',
  '../shared/services/backup.js',
  '../shared/firebase-config.js',
  '../shared/room.js',
  '../shared/familiar-presets.js',
  '../data/races.json',
  '../data/spells.json',
  '../data/items.json',
  '../data/sources.json',
  '../data/classes.json',
  'https://unpkg.com/vue@3/dist/vue.global.prod.js',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(ASSETS.map((u) => c.add(u).catch(() => null)))
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
    // 同源：network-first —— 先抓網路（成功就更新快取），失敗才回快取。
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
            if (e.request.mode === 'navigate') return caches.match('./');
            return Response.error();
          })
        )
    );
    return;
  }

  // 跨源 CDN（Vue / Tailwind）：cache-first，離線必需。
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
