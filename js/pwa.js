(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    root.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore registration errors in local development without HTTPS support.
      });
    });
  }

  Karto.registerServiceWorker = registerServiceWorker;
  registerServiceWorker();
})(window);
