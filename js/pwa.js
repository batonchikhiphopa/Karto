(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function shouldSkipServiceWorkerRegistration(location) {
    const hostname = String(location?.hostname || "").toLowerCase();
    const port = String(location?.port || "");
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

    return isLocalHost && port !== "3000";
  }

  function unregisterServiceWorkers() {
    return navigator.serviceWorker.getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      )
      .catch(() => {
        // Ignore cleanup errors in local development.
      });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    root.addEventListener("load", () => {
      if (shouldSkipServiceWorkerRegistration(root.location)) {
        unregisterServiceWorkers();
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
