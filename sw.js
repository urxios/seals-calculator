const CACHE_NAME = "dmowiki-seals-static-v7";
const FILES = [
  "./",
  "./index.html",
  "./assets/styles.css",
  "./assets/solid-theme.css",
  "./assets/planner.js",
  "./assets/catalog.js",
  "./assets/local-api.js",
  "./assets/csrf.js",
  "./assets/theme.js",
  "./assets/core.js",
  "./assets/seal-card-date.js",
  "./assets/seals-pdf.js",
  "./assets/seals.js",
  "./assets/Seal_Opener_Icon.png",
  "./assets/Currency_Bit.png",
  "./assets/Currency_Mega.png",
  "./assets/Currency_Tera.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("dmowiki-seals-static-") && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
