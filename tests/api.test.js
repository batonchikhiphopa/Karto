const assert = require("node:assert/strict");

const { createApiClient } = require("../js/api.js");

function createJsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function createRuntime(url, fetchImpl) {
  const calls = [];

  return {
    calls,
    runtime: {
      location: new URL(url),
      getCurrentLanguage() {
        return "ru";
      },
      async fetch(resource, options = {}) {
        const href = String(resource);
        calls.push({ url: href, options });
        return fetchImpl(href, options, calls.length);
      }
    }
  };
}

async function testSameOriginOnApiServerSkipsFallbacks() {
  const { calls, runtime } = createRuntime("http://127.0.0.1:3000/", async (url) => {
    assert.equal(url, "http://127.0.0.1:3000/api/translate?text=house&targetLang=de&lang=ru");
    return createJsonResponse(200, { translation: "Haus" });
  });

  const client = createApiClient({ root: runtime });
  const response = await client.translateText("house", "de");

  assert.equal(response.ok, true);
  assert.equal(response.data.translation, "Haus");
  assert.equal(calls.length, 1);
}

async function testDefaultRuntimeUsesCapturedGlobalRoot() {
  const previousLocation = globalThis.location;
  const previousFetch = globalThis.fetch;
  const previousGetCurrentLanguage = globalThis.getCurrentLanguage;
  const hadLocation = Object.prototype.hasOwnProperty.call(globalThis, "location");
  const hadFetch = Object.prototype.hasOwnProperty.call(globalThis, "fetch");
  const hadGetCurrentLanguage = Object.prototype.hasOwnProperty.call(globalThis, "getCurrentLanguage");
  const calls = [];

  globalThis.location = new URL("http://127.0.0.1:3000/");
  globalThis.getCurrentLanguage = () => "ru";
  globalThis.fetch = async (resource, options = {}) => {
    calls.push({ url: String(resource), options });
    assert.equal(String(resource), "http://127.0.0.1:3000/api/define?word=cat&dictLang=en&lang=ru");
    return createJsonResponse(200, { definition: "A small cat." });
  };

  try {
    const client = createApiClient();
    const response = await client.fetchDefinition("cat", "en");

    assert.equal(response.ok, true);
    assert.equal(response.data.definition, "A small cat.");
    assert.equal(calls.length, 1);
  } finally {
    if (hadLocation) {
      globalThis.location = previousLocation;
    } else {
      delete globalThis.location;
    }

    if (hadFetch) {
      globalThis.fetch = previousFetch;
    } else {
      delete globalThis.fetch;
    }

    if (hadGetCurrentLanguage) {
      globalThis.getCurrentLanguage = previousGetCurrentLanguage;
    } else {
      delete globalThis.getCurrentLanguage;
    }
  }
}

async function testSameOrigin404DoesNotProbeLocalFallbacks() {
  const { calls, runtime } = createRuntime("http://127.0.0.1:5500/", async (url) => {
    assert.equal(url, "http://127.0.0.1:5500/api/define?word=cat&dictLang=en&lang=ru");
    return createJsonResponse(404, { error: "Not found" });
  });

  const client = createApiClient({ root: runtime });
  const response = await client.fetchDefinition("cat", "en");

  assert.equal(response.ok, false);
  assert.equal(response.status, 404);
  assert.deepEqual(
    calls.map((entry) => entry.url),
    [
      "http://127.0.0.1:5500/api/define?word=cat&dictLang=en&lang=ru"
    ]
  );
}

async function testExplicitApiBasesCanFallbackOn404AndRememberSuccess() {
  const { calls, runtime } = createRuntime("http://localhost:5500/", async (url) => {
    if (url.startsWith("https://primary.example/api/")) {
      return createJsonResponse(404, { error: "Not found" });
    }

    if (url.startsWith("https://backup.example/api/")) {
      return createJsonResponse(200, { images: [] });
    }

    throw new Error(`Unexpected URL: ${url}`);
  });

  const client = createApiClient({
    root: runtime,
    apiBases: [
      "https://primary.example/api",
      "https://backup.example/api"
    ]
  });
  const first = await client.searchImages("cat");
  const second = await client.searchImages("dog");

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(
    calls.map((entry) => entry.url),
    [
      "https://primary.example/api/images?query=cat&lang=ru",
      "https://backup.example/api/images?query=cat&lang=ru",
      "https://backup.example/api/images?query=dog&lang=ru"
    ]
  );
}

async function testDoesNotFallbackOnServerErrors() {
  const { calls, runtime } = createRuntime("http://127.0.0.1:5500/", async (url) => {
    assert.equal(url, "http://127.0.0.1:5500/api/translate?text=house&targetLang=de&lang=ru");
    return createJsonResponse(500, { error: "Boom" });
  });

  const client = createApiClient({ root: runtime });
  const response = await client.translateText("house", "de");

  assert.equal(response.ok, false);
  assert.equal(response.status, 500);
  assert.equal(calls.length, 1);
}

async function testDoesNotFallbackOnRateLimiting() {
  const { calls, runtime } = createRuntime("http://127.0.0.1:5500/", async (url) => {
    assert.equal(url, "http://127.0.0.1:5500/api/images?query=cat&lang=ru");
    return createJsonResponse(429, { error: "Too many requests" });
  });

  const client = createApiClient({ root: runtime });
  const response = await client.searchImages("cat");

  assert.equal(response.ok, false);
  assert.equal(response.status, 429);
  assert.equal(calls.length, 1);
}

(async () => {
  await testSameOriginOnApiServerSkipsFallbacks();
  await testDefaultRuntimeUsesCapturedGlobalRoot();
  await testSameOrigin404DoesNotProbeLocalFallbacks();
  await testExplicitApiBasesCanFallbackOn404AndRememberSuccess();
  await testDoesNotFallbackOnServerErrors();
  await testDoesNotFallbackOnRateLimiting();

  console.log("api tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
