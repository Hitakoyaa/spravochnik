// Офлайн-работа: всё приложение лежит в кэше телефона. Данные — отдельно, в памяти браузера.
const VERSION = "spr-v1.6.2";
const FILES = [
  "./", "./index.html", "./app.js", "./staff.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-180.png",
  "./fonts/manrope-cyrillic-400-normal.woff2", "./fonts/manrope-cyrillic-600-normal.woff2",
  "./fonts/manrope-cyrillic-700-normal.woff2", "./fonts/manrope-cyrillic-800-normal.woff2",
  "./fonts/manrope-latin-400-normal.woff2", "./fonts/manrope-latin-600-normal.woff2",
  "./fonts/manrope-latin-700-normal.woff2", "./fonts/manrope-latin-800-normal.woff2"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).catch(() => caches.match("./index.html")))
  );
});
