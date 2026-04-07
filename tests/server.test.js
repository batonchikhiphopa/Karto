const assert = require("node:assert/strict");
const path = require("node:path");
const { once } = require("node:events");

const { createApp } = require("../server.js");

async function withServer(options, run) {
  const { app } = createApp({
    staticRoot: path.resolve(__dirname, ".."),
    unsplashAccessKey: "demo-key",
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

  console.log("server tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
