const CACHE_NAME = "karto-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/logo.svg",
  "/manifest.webmanifest",
  "/i18n.js",
  "/app.js",
  "/js/data-model.js",
  "/js/dom-utils.js",
  "/js/study-engine.js",
  "/js/app-state.js",
  "/js/router.js",
  "/js/api.js",
  "/js/pwa.js",
  "/js/ui/sidebar.js",
  "/js/ui/toast.js",
  "/js/views/home-view.js",
  "/js/views/library-view.js",
  "/js/views/deck-editor-view.js",
  "/js/views/card-form-view.js",
  "/js/views/study-view.js",
  "/js/views/settings-view.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }

          return Promise.resolve();
        })
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      });
    })
  );
});
