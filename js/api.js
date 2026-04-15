(function(root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  const Karto = root.Karto || (root.Karto = {});
  Object.assign(Karto, api);
})(typeof window !== "undefined" ? window : globalThis, function(root) {
  function normalizeApiBase(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  function isAbsoluteUrl(value) {
    return /^https?:\/\//i.test(String(value || ""));
  }

  function dedupe(values) {
    const seen = new Set();
    return values.filter((value) => {
      const normalized = normalizeApiBase(value);
      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
  }

  function resolveApiBases(basePath, location, customApiBases) {
    if (Array.isArray(customApiBases) && customApiBases.length > 0) {
      return dedupe(customApiBases);
    }

    const resolvedBasePath = basePath || "/api";
    if (isAbsoluteUrl(resolvedBasePath)) {
      return [normalizeApiBase(resolvedBasePath)];
    }

    return [normalizeApiBase(new URL(resolvedBasePath, location.origin).toString())];
  }

  function createApiClient(options = {}) {
    const runtime = options.root || root;
    const basePath = options.basePath || "/api";
    const controllers = new Map();
    let preferredApiBase = null;

    const apiBases = resolveApiBases(basePath, runtime.location, options.apiBases);

    function getCurrentLanguageSafe() {
      return typeof runtime.getCurrentLanguage === "function"
        ? runtime.getCurrentLanguage()
        : "en";
    }

    function getApiBases() {
      return preferredApiBase
        ? dedupe([preferredApiBase, ...apiBases])
        : apiBases.slice();
    }

    function buildApiUrl(apiBase, path, params = {}) {
      const normalizedPath = String(path || "").replace(/^\/+/, "");
      const url = new URL(normalizedPath, `${normalizeApiBase(apiBase)}/`);
      const searchParams = { ...params, lang: getCurrentLanguageSafe() };

      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, value);
        }
      });

      return url.toString();
    }

    function abortRequest(key) {
      const controller = controllers.get(key);
      if (!controller) return;

      controller.abort();
      controllers.delete(key);
    }

    async function requestJson(path, params, key) {
      abortRequest(key);

      const controller = new AbortController();
      controllers.set(key, controller);

      try {
        const candidates = getApiBases();
        let lastNetworkError = null;

        for (let index = 0; index < candidates.length; index += 1) {
          const apiBase = candidates[index];

          try {
            const response = await runtime.fetch(buildApiUrl(apiBase, path, params), {
              signal: controller.signal
            });
            const data = await response.json().catch(() => ({}));

            if (response.status !== 404) {
              preferredApiBase = apiBase;
            }

            if (response.status === 404 && index < candidates.length - 1) {
              continue;
            }

            return {
              ok: response.ok,
              status: response.status,
              data,
              aborted: false
            };
          } catch (error) {
            if (error?.name === "AbortError") {
              return {
                ok: false,
                status: 0,
                data: null,
                aborted: true
              };
            }

            lastNetworkError = error;
            if (index < candidates.length - 1) {
              continue;
            }
          }
        }

        throw lastNetworkError || new Error("API request failed");
      } finally {
        if (controllers.get(key) === controller) {
          controllers.delete(key);
        }
      }
    }

    return {
      fetchDefinition(word, dictLang) {
        return requestJson("define", { word, dictLang }, "define");
      },
      translateText(text, targetLang) {
        return requestJson("translate", { text, targetLang }, "translate");
      },
      searchImages(query) {
        return requestJson("images", { query }, "images");
      },
      abortAll() {
        Array.from(controllers.keys()).forEach(abortRequest);
      }
    };
  }

  return {
    createApiClient
  };
});
