"use strict";

function createDesktopFrontendCacheCleaner(session) {
  let cleanupPromise = null;

  return async function clearDesktopFrontendCaches(origin = null) {
    if (cleanupPromise) {
      return cleanupPromise;
    }

    cleanupPromise = (async () => {
      const targetSession = session.defaultSession;

      if (!targetSession) {
        return;
      }

      try {
        await targetSession.clearCache();
        if (origin) {
          await targetSession.clearStorageData({
            origin,
            storages: [
              ["service", "workers"].join(""),
              "cachestorage"
            ]
          });
        }
      } catch (error) {
        console.error("[karto] Failed to clear desktop frontend caches:", error);
      }
    })();

    return cleanupPromise;
  };
}

module.exports = {
  createDesktopFrontendCacheCleaner
};
