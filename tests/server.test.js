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

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(calls, 1);
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
  await testDictionaryCaching();
  await testGermanDictionaryRoute();
  await testRateLimiting();

  console.log("server tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
