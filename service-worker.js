const CACHE = "ravito-public-shell-v3";
const base = self.registration.scope;
const shell = ["./", "./index.html", "./manifest.webmanifest", "./ravito-assistant.js", "./qr-ravito.png", "./ravito-public-192.png", "./ravito-public-512.png"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(shell.map((item) => new URL(item, base).href))).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("ravito-public-shell-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => { if (response.ok) caches.open(CACHE).then((cache) => cache.put(new URL("./index.html", base).href, response.clone())); return response; }).catch(async () => (await caches.match(request)) || (await caches.match(new URL("./index.html", base).href)) || Response.error()));
    return;
  }
  if (url.pathname.includes("/ravito-site/") || url.pathname.endsWith(".webmanifest")) {
    event.respondWith(caches.match(request).then((cached) => {
      const fresh = fetch(request).then((response) => { if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone())); return response; });
      return cached || fresh;
    }));
  }
});
