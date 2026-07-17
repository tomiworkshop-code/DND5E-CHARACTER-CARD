/* 冒險者之書 V1 已停用：此 Service Worker 改為「自我卸載」版本。
   任何仍註冊舊 SW 的裝置，在更新時會執行以下邏輯：清除所有快取並卸載自己，
   讓使用者乾淨地轉往 V2，不再被舊快取困住。 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (err) {}
    try { await self.registration.unregister(); } catch (err) {}
    try {
      const clients = await self.clients.matchAll();
      clients.forEach((c) => c.navigate(c.url));
    } catch (err) {}
  })());
});

// 不攔截任何請求，一律走網路。
self.addEventListener('fetch', () => {});
