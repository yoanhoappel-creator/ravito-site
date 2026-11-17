const CACHE = "ravito-shell-v2";
// Dossier de l'application : "/" sur le serveur Render, "/ravito-site/app/" quand l'application client est hébergée à part (GitHub Pages).
const BASE = new URL(self.registration.scope).pathname;
const at = (path) => BASE + String(path).replace(/^\//, "");
const SHELL = [
  BASE,
  at("index.html"),
  at("manifest.webmanifest"),
  at("icons/ravito-public-192.png"),
  at("icons/ravito-public-512.png"),
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("ravito-shell-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(at("index.html"), response.clone()));
      return response;
    }).catch(async () => (await caches.match(at("index.html"))) || Response.error()));
    return;
  }
  if (url.pathname.startsWith(at("assets/")) || url.pathname.startsWith(at("icons/")) || url.pathname.startsWith(at("fonts/")) || url.pathname.endsWith(".webmanifest")) {
    event.respondWith(caches.match(request).then((cached) => {
      const fresh = fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
        return response;
      });
      return cached || fresh;
    }));
  }
});

// Notifications push (alertes commandes) — le contenu est chiffré de bout en bout et ne contient aucune donnée personnelle de client.
// "url" (chemin interne seulement) : "/" pour les clients abonnés, "/equipe/" par défaut pour l'équipe.
const safePath = (value) => (typeof value === "string" && /^\/(?!\/)[\w\-./]{0,100}$/.test(value) ? value : "/equipe/");
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = String(data.title || "RAVITO").slice(0, 80);
  const url = safePath(data.url);
  const icon = url === "/" ? at("icons/ravito-public-192.png") : at("icons/ravito-staff-192.png");
  const options = {
    silent: false,
    body: String(data.body || "Ouvre l'application pour voir les détails.").slice(0, 200),
    icon, badge: icon,
    data: { url },
  };
  if (data.tag) { options.tag = String(data.tag).slice(0, 60); options.renotify = true; }
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safePath(event.notification.data && event.notification.data.url);
  const target = url === "/" ? BASE : url;          // pour les clients : la page d'accueil de l'application, où qu'elle soit hébergée
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    for (const client of windows) {
      const path = new URL(client.url).pathname;
      if ((url === "/" ? path === BASE : path.startsWith("/equipe")) && "focus" in client) return client.focus();
    }
    return self.clients.openWindow(target);
  }));
});
