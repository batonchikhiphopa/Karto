(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  function createApiClient(options = {}) {
    const basePath = options.basePath || "/api";
    const controllers = new Map();

    function buildApiUrl(path, params = {}) {
      const url = new URL(path, root.location.origin);
      const searchParams = { ...params, lang: root.getCurrentLanguage() };

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
        const response = await root.fetch(buildApiUrl(path, params), {
          signal: controller.signal
        });
        const data = await response.json().catch(() => ({}));

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

        throw error;
      } finally {
        if (controllers.get(key) === controller) {
          controllers.delete(key);
        }
      }
    }

    return {
      fetchDefinition(word, dictLang) {
        return requestJson(`${basePath}/define`, { word, dictLang }, "define");
      },
      searchImages(query) {
        return requestJson(`${basePath}/images`, { query }, "images");
      },
      abortAll() {
        Array.from(controllers.keys()).forEach(abortRequest);
      }
    };
  }

  Karto.createApiClient = createApiClient;
})(window);
