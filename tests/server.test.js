const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const cheerio = require("cheerio");

const { collectEnvCandidatePaths, createApp } = require("../server.js");
const { SHELL_MARKERS } = require("../js/startup-verification.js");

async function withServer(options, run) {
  const { app } = createApp({
    staticRoot: path.resolve(__dirname, ".."),
    ...options
  });

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await run(baseUrl);
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function testHealthEndpoint() {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.status, "ok");
    assert.equal(payload.app, "Karto");
  });
}

async function testLocalDevCorsHeaders() {
  await withServer({}, async (baseUrl) => {
    const localIpOrigin = "http://127.0.0.1:5500";
    const localhostOrigin = "http://localhost:5500";

    const ipResponse = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: localIpOrigin }
    });
    const localhostResponse = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: localhostOrigin }
    });

    assert.equal(ipResponse.headers.get("access-control-allow-origin"), localIpOrigin);
    assert.match(ipResponse.headers.get("vary") || "", /Origin/i);
    assert.equal(localhostResponse.headers.get("access-control-allow-origin"), localhostOrigin);
  });
}

async function testDisallowedOriginDoesNotGetCorsHeaders() {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: "https://example.com" }
    });

    assert.equal(response.headers.get("access-control-allow-origin"), null);
  });
}

async function testOptionsPreflightForApiRoutes() {
  await withServer({}, async (baseUrl) => {
    const origin = "http://127.0.0.1:5500";
    const response = await fetch(`${baseUrl}/api/translate`, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "GET"
      }
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("access-control-allow-methods"), "GET,OPTIONS");
  });
}

async function testDictionaryCaching() {
  let calls = 0;

  await withServer({
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify([
        {
          meanings: [
            {
              definitions: [
                { definition: "A domesticated animal." }
              ]
            }
          ]
        }
      ]), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  }, async (baseUrl) => {
    const first = await fetch(`${baseUrl}/api/define?word=cat&dictLang=en&lang=en`);
    const second = await fetch(`${baseUrl}/api/define?word=cat&dictLang=en&lang=en`);
    const firstPayload = await first.json();
    const secondPayload = await second.json();

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(calls, 1);
    assert.equal(firstPayload.sourceLabel, "dictionaryapi.dev");
    assert.equal(secondPayload.sourceId, "dictionaryapi");
  });
}

async function testGermanDictionaryRoute() {
  await withServer({
    fetchImpl: async (url) => {
      if (String(url).includes("dwds.de")) {
        return new Response("<div class=\"dwdswb-definition\">Ein Gebäude zum Wohnen.</div>", {
          status: 200,
          headers: { "Content-Type": "text/html" }
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    }
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/define?word=Haus&dictLang=de&lang=de`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.definition, "Ein Gebäude zum Wohnen.");
    assert.equal(payload.sourceLabel, "DWDS");
  });
}

async function testRussianWiktionaryRoute() {
  await withServer({
    fetchImpl: async (url) => {
      if (String(url).includes("ru.wiktionary.org")) {
        return new Response(`
          <div class="mw-parser-output">
            <ol>
              <li>Русское определение.</li>
            </ol>
          </div>
        `, {
          status: 200,
          headers: { "Content-Type": "text/html" }
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    }
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/define?word=дом&dictLang=ru&lang=ru`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.definition, "Русское определение.");
    assert.equal(payload.sourceLabel, "Wiktionary");
    assert.equal(payload.dictLang, "ru");
  });
}

async function testTranslateRoute() {
  await withServer({
    deepLApiKey: "demo-deepl-key",
    fetchImpl: async (url, options = {}) => {
      assert.equal(String(url), "https://api-free.deepl.com/v2/translate");
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, "DeepL-Auth-Key demo-deepl-key");
      assert.equal(options.body.get("target_lang"), "DE");
      assert.equal(options.body.get("text"), "house");

      return new Response(JSON.stringify({
        translations: [
          {
            text: "Haus",
            detected_source_language: "EN"
          }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/translate?text=house&targetLang=de&lang=en`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.translation, "Haus");
    assert.equal(payload.providerLabel, "DeepL");
    assert.equal(payload.targetLang, "de");
    assert.equal(payload.detectedSourceLanguage, "EN");
  });
}

async function testTranslateRequiresConfig() {
  let called = false;

  await withServer({
    deepLApiKey: "",
    fetchImpl: async () => {
      called = true;
      throw new Error("fetchImpl should not be called without DeepL config");
    }
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/translate?text=house&targetLang=de&lang=de`);
    const payload = await response.json();

    assert.equal(response.status, 500);
    assert.equal(payload.errorCode, "translation_not_configured");
    assert.equal(called, false);
  });
}

async function testAppShellHeaders() {
  await withServer({}, async (baseUrl) => {
    for (const pathname of ["/", "/index.html"]) {
      const response = await fetch(`${baseUrl}${pathname}`);

      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") || "", /^text\/html/i);
      assert.match(response.headers.get("cache-control") || "", /no-store/i);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("pragma"), "no-cache");
      assert.equal(response.headers.get("expires"), "0");
    }
  });
}

async function testAppShellContract() {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();
    const $ = cheerio.load(html);

    assert.equal($(SHELL_MARKERS.shell).length > 0, true);
    assert.equal($(SHELL_MARKERS.main).length > 0, true);
  });
}

function withClearedApiEnv(run) {
  const originalDeepLApiKey = process.env.DEEPL_API_KEY;
  const originalUnsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
  const originalDeepLApiBaseUrl = process.env.DEEPL_API_BASE_URL;

  delete process.env.DEEPL_API_KEY;
  delete process.env.UNSPLASH_ACCESS_KEY;
  delete process.env.DEEPL_API_BASE_URL;

  return Promise.resolve()
    .then(run)
    .finally(() => {
      if (originalDeepLApiKey === undefined) {
        delete process.env.DEEPL_API_KEY;
      } else {
        process.env.DEEPL_API_KEY = originalDeepLApiKey;
      }

      if (originalUnsplashAccessKey === undefined) {
        delete process.env.UNSPLASH_ACCESS_KEY;
      } else {
        process.env.UNSPLASH_ACCESS_KEY = originalUnsplashAccessKey;
      }

      if (originalDeepLApiBaseUrl === undefined) {
        delete process.env.DEEPL_API_BASE_URL;
      } else {
        process.env.DEEPL_API_BASE_URL = originalDeepLApiBaseUrl;
      }
    });
}

async function testEnvPathLoadsApiKeys() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "karto-env-"));
  const envPath = path.join(tempDir, ".env");

  fs.writeFileSync(envPath, [
    "DEEPL_API_KEY=env-deepl-key",
    "UNSPLASH_ACCESS_KEY=env-unsplash-key"
  ].join("\n"));

  try {
    await withClearedApiEnv(async () => {
      await withServer({
        envPath,
        fetchImpl: async (url, options = {}) => {
          if (String(url) === "https://api-free.deepl.com/v2/translate") {
            assert.equal(options.headers.Authorization, "DeepL-Auth-Key env-deepl-key");

            return new Response(JSON.stringify({
              translations: [
                {
                  text: "Haus",
                  detected_source_language: "EN"
                }
              ]
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }

          if (String(url).startsWith("https://api.unsplash.com/search/photos")) {
            assert.match(String(url), /client_id=env-unsplash-key/);

            return new Response(JSON.stringify({
              results: [
                {
                  alt_description: "cat",
                  urls: {
                    small: "https://images.test/cat-small.jpg",
                    regular: "https://images.test/cat-regular.jpg"
                  }
                }
              ]
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }

          throw new Error(`Unexpected URL: ${url}`);
        }
      }, async (baseUrl) => {
        const translateResponse = await fetch(`${baseUrl}/api/translate?text=house&targetLang=de&lang=en`);
        const translatePayload = await translateResponse.json();
        const imagesResponse = await fetch(`${baseUrl}/api/images?query=cat&lang=en`);
        const imagesPayload = await imagesResponse.json();

        assert.equal(translateResponse.status, 200);
        assert.equal(translatePayload.providerLabel, "DeepL");
        assert.equal(imagesResponse.status, 200);
        assert.equal(imagesPayload.images.length, 1);
      });
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function testExplicitOptionsOverrideEnvFile() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "karto-env-"));
  const envPath = path.join(tempDir, ".env");

  fs.writeFileSync(envPath, [
    "DEEPL_API_KEY=env-deepl-key",
    "UNSPLASH_ACCESS_KEY=env-unsplash-key"
  ].join("\n"));

  try {
    await withClearedApiEnv(async () => {
      await withServer({
        envPath,
        deepLApiKey: "options-deepl-key",
        unsplashAccessKey: "options-unsplash-key",
        fetchImpl: async (url, options = {}) => {
          if (String(url) === "https://api-free.deepl.com/v2/translate") {
            assert.equal(options.headers.Authorization, "DeepL-Auth-Key options-deepl-key");

            return new Response(JSON.stringify({
              translations: [
                {
                  text: "Haus",
                  detected_source_language: "EN"
                }
              ]
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }

          if (String(url).startsWith("https://api.unsplash.com/search/photos")) {
            assert.match(String(url), /client_id=options-unsplash-key/);

            return new Response(JSON.stringify({
              results: []
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }

          throw new Error(`Unexpected URL: ${url}`);
        }
      }, async (baseUrl) => {
        const translateResponse = await fetch(`${baseUrl}/api/translate?text=house&targetLang=de&lang=en`);
        const imagesResponse = await fetch(`${baseUrl}/api/images?query=cat&lang=en`);

        assert.equal(translateResponse.status, 200);
        assert.equal(imagesResponse.status, 200);
      });
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testEnvCandidatePriority() {
  const originalEnvPath = process.env.KARTO_ENV_PATH;
  const originalPortableDir = process.env.PORTABLE_EXECUTABLE_DIR;

  process.env.KARTO_ENV_PATH = "C:\\env-from-var\\.env";
  process.env.PORTABLE_EXECUTABLE_DIR = "C:\\portable-root";

  try {
    const candidates = collectEnvCandidatePaths({
      envPath: "C:\\explicit\\.env"
    });

    assert.equal(candidates[0], path.resolve("C:\\explicit\\.env"));
    assert.equal(candidates[1], path.resolve("C:\\env-from-var\\.env"));
    assert.equal(candidates[2], path.resolve("C:\\portable-root\\.env"));
  } finally {
    if (originalEnvPath === undefined) {
      delete process.env.KARTO_ENV_PATH;
    } else {
      process.env.KARTO_ENV_PATH = originalEnvPath;
    }

    if (originalPortableDir === undefined) {
      delete process.env.PORTABLE_EXECUTABLE_DIR;
    } else {
      process.env.PORTABLE_EXECUTABLE_DIR = originalPortableDir;
    }
  }
}

async function testRateLimiting() {
  await withServer({
    defineRateLimit: { windowMs: 60_000, max: 2 },
    fetchImpl: async () => new Response(JSON.stringify([
      {
        meanings: [
          {
            definitions: [
              { definition: "Meaning" }
            ]
          }
        ]
      }
    ]), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  }, async (baseUrl) => {
    const first = await fetch(`${baseUrl}/api/define?word=one&dictLang=en&lang=en`);
    const second = await fetch(`${baseUrl}/api/define?word=two&dictLang=en&lang=en`);
    const third = await fetch(`${baseUrl}/api/define?word=three&dictLang=en&lang=en`);
    const payload = await third.json();

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(third.status, 429);
    assert.equal(payload.errorCode, "rate_limited");
  });
}

(async () => {
  await testAppShellHeaders();
  await testAppShellContract();
  await testHealthEndpoint();
  await testLocalDevCorsHeaders();
  await testDisallowedOriginDoesNotGetCorsHeaders();
  await testOptionsPreflightForApiRoutes();
  await testDictionaryCaching();
  await testGermanDictionaryRoute();
  await testRussianWiktionaryRoute();
  await testTranslateRoute();
  await testTranslateRequiresConfig();
  await testRateLimiting();
  await testEnvPathLoadsApiKeys();
  await testExplicitOptionsOverrideEnvFile();
  testEnvCandidatePriority();

  console.log("server tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
