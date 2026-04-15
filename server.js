"use strict";

const http = require("node:http");

const {
  collectEnvCandidatePaths,
  createApp,
  createRateLimiter,
  createTTLCache,
  errorResponse,
  loadEnvironment,
  normalizeLanguage,
  resolveRequestLanguage
} = require("./js/server/app-factory");

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "127.0.0.1";

function createServer(options = {}) {
  loadEnvironment(options);

  const host = options.host || process.env.HOST || DEFAULT_HOST;
  const requestedPort = options.port ?? process.env.PORT ?? DEFAULT_PORT;
  const port = Number.isFinite(Number(requestedPort)) ? Number(requestedPort) : DEFAULT_PORT;
  const fallbackToAvailablePort = options.fallbackToAvailablePort === true;
  const { app, definitionCache } = createApp(options);

  let httpServer = null;
  let startPromise = null;
  let stopPromise = null;
  let resolvedUrl = "";

  function getUrl() {
    return resolvedUrl || `http://${host}:${port}`;
  }

  async function start() {
    if (stopPromise) {
      await stopPromise;
    }

    if (httpServer?.listening) {
      return getUrl();
    }

    if (startPromise) {
      return startPromise;
    }

    const listen = (listenPort) => {
      const serverInstance = http.createServer(app);
      httpServer = serverInstance;

      return new Promise((resolve, reject) => {
        const handleError = (error) => {
          serverInstance.off("listening", handleListening);

          if (httpServer === serverInstance) {
            httpServer = null;
          }

          reject(error);
        };

        const handleListening = () => {
          serverInstance.off("error", handleError);

          const address = serverInstance.address();
          const activePort =
            typeof address === "object" && address && typeof address.port === "number"
              ? address.port
              : listenPort;

          resolvedUrl = `http://${host}:${activePort}`;
          resolve(resolvedUrl);
        };

        serverInstance.once("error", handleError);
        serverInstance.once("listening", handleListening);
        serverInstance.listen(listenPort, host);
      });
    };

    startPromise = listen(port)
      .catch((error) => {
        if (!fallbackToAvailablePort || error?.code !== "EADDRINUSE" || port === 0) {
          throw error;
        }

        return listen(0);
      })
      .catch((error) => {
        if (httpServer?.listening === false || httpServer === null) {
          httpServer = null;
        }

        resolvedUrl = "";
        throw error;
      })
      .finally(() => {
        startPromise = null;
      });

    return startPromise;
  }

  async function stop() {
    if (stopPromise) {
      return stopPromise;
    }

    if (startPromise && httpServer && !httpServer.listening) {
      try {
        await startPromise;
      } catch {
        return;
      }
    }

    if (!httpServer || !httpServer.listening) {
      httpServer = null;
      resolvedUrl = "";
      return;
    }

    const serverInstance = httpServer;

    stopPromise = new Promise((resolve, reject) => {
      serverInstance.close((error) => {
        if (httpServer === serverInstance) {
          httpServer = null;
        }

        resolvedUrl = "";
        stopPromise = null;

        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    return stopPromise;
  }

  return {
    app,
    definitionCache,
    getUrl,
    start,
    stop
  };
}

if (require.main === module) {
  const server = createServer();

  server.start()
    .then((url) => {
      console.log(`Karto server started on ${url}`);
    })
    .catch((error) => {
      console.error("Failed to start Karto server:", error);
      process.exitCode = 1;
    });

  const shutdown = async () => {
    try {
      await server.stop();
    } catch (error) {
      console.error("Failed to stop Karto server:", error);
      process.exitCode = 1;
    } finally {
      process.exit();
    }
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });
}

module.exports = {
  collectEnvCandidatePaths,
  createApp,
  createRateLimiter,
  createServer,
  createTTLCache,
  errorResponse,
  loadEnvironment,
  normalizeLanguage,
  resolveRequestLanguage
};
