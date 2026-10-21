// Офлайн-работа: всё приложение лежит в кэше телефона. Данные — отдельно, в памяти браузера.
const VERSION = "spr-v1.10.1";
const FILES = [
  "./", "./index.html", "./app.js", "./staff.js", "./vyr.js", "./gsm.js", "./manifest.webmanifest",
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
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== "share-inbox").map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// «Поделиться → Справочник» из Telegram: файл архива приходит POST-запросом на ./share
const SHARE_KEY = "/__spr_shared_archive__";
self.addEventListener("fetch", (e) => {
  if (e.request.method === "POST" && new URL(e.request.url).pathname.endsWith("/share")) {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData();
        const f = fd.getAll("archive").find((x) => x && x.size) || null;
        if (f) {
          const c = await caches.open("share-inbox");
          await c.put(SHARE_KEY, new Response(f, { headers: { "X-Name": encodeURIComponent(f.name || "архив.zip") } }));
        }
      } catch (err) { /* */ }
      return Response.redirect(new URL("./#share", self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).catch(() => caches.match("./index.html")))
  );
});
