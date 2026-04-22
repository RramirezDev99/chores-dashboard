// Network-first for HTML/JS/CSS so updates always come through;
// cache is fallback for offline only. API calls are never intercepted.
const CACHE = "chores-dashboard-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./data.js",
  "./manifest.json",
  "./icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  // Never intercept API calls — always live
  if (url.pathname.startsWith("/api/")) return;
  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Network-first: try network, fall back to cache if offline
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("./");
    })
  );
});

self.addEventListener("push", (event) => {
  const data = (() => { try { return event.data.json(); } catch { return { title: "Recordatorio", body: "Revisa tus tareas." }; }})();
  event.waitUntil(
    self.registration.showNotification(data.title || "Recordatorio", {
      body: data.body || "",
      icon: "./icon.svg",
      badge: "./icon.svg",
    })
  );
});
