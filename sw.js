const CACHE_NAME = "karto-v3";
const APP_SHELL_PATHS = [
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
const APP_SHELL_SET = new Set(APP_SHELL_PATHS);

function shouldHandleRequest(requestUrl) {
  return requestUrl.origin === self.location.origin && !requestUrl.pathname.startsWith("/api/");
}

async function addAppShellToCache() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL_PATHS);
}

async function readCachedResponse(request, fallbackPath = "") {
  const directMatch = await caches.match(request);
  if (directMatch) {
    return directMatch;
  }

  if (!fallbackPath) {
    return Response.error();
  }

  const fallbackMatch = await caches.match(fallbackPath);
  return fallbackMatch || Response.error();
}

async function updateCache(request, response) {
  if (!response || !response.ok) {
    return response;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, fallbackPath = "") {
  try {
    const response = await fetch(request);
    return updateCache(request, response);
  } catch {
    return readCachedResponse(request, fallbackPath);
  }
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  return updateCache(request, response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(addAppShellToCache());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((key) => (key === CACHE_NAME ? Promise.resolve() : caches.delete(key)))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (!shouldHandleRequest(requestUrl)) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, "/index.html"));
    return;
  }

  if (APP_SHELL_SET.has(requestUrl.pathname)) {
    event.respondWith(networkFirst(event.request, requestUrl.pathname));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
