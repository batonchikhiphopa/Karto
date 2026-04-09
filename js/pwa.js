(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function isDesktopEnvironment() {
    return !!root.kartoDesktop?.isDesktop;
  }

  function shouldSkipServiceWorkerRegistration(location) {
    const hostname = String(location?.hostname || "").toLowerCase();
    const port = String(location?.port || "");
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

    return isLocalHost && port !== "3000";
  }

  function unregisterServiceWorkers() {
    if (!("serviceWorker" in navigator)) {
      return Promise.resolve();
    }

    return navigator.serviceWorker.getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      )
      .catch(() => {
        // Ignore cleanup errors in local development.
      });
  }

  function clearServiceWorkerCaches() {
    if (!root.caches || typeof root.caches.keys !== "function") {
      return Promise.resolve();
    }

    return root.caches.keys()
      .then((cacheNames) => Promise.all(cacheNames.map((cacheName) => root.caches.delete(cacheName))))
      .catch(() => {
        // Ignore cache cleanup errors when storage is unavailable.
      });
  }

  function cleanupServiceWorkerState() {
    return Promise.all([
      unregisterServiceWorkers(),
      clearServiceWorkerCaches()
    ]).catch(() => {
      // Ignore cleanup errors during desktop/dev boot.
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    root.addEventListener("load", () => {
      if (isDesktopEnvironment() || shouldSkipServiceWorkerRegistration(root.location)) {
        cleanupServiceWorkerState();
        return;
      }

      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore registration errors in local development without HTTPS support.
      });
    });
  }

  Karto.registerServiceWorker = registerServiceWorker;
  registerServiceWorker();
})(window);
