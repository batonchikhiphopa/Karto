const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const dotenv = require("dotenv");
const express = require("express");
const cheerio = require("cheerio");

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "127.0.0.1";
const USER_AGENT = "Mozilla/5.0 (compatible; Karto/1.0)";

const SUPPORTED_UI_LANGS = new Set(["ru", "en", "de"]);
const SUPPORTED_DICT_LANGS = new Set(["en", "de", "ru"]);
const SUPPORTED_TRANSLATE_LANGS = new Set(["en", "de", "ru"]);
const FALLBACK_LANG = "en";
const LOCAL_DEV_ORIGIN_PATTERN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;
const APP_SHELL_RESPONSE_HEADERS = Object.freeze({
  "Content-Type": "text/html; charset=UTF-8",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff"
});

let loadedEnvPath = null;

const MESSAGES = {
  en: {
    invalid_word: "Invalid word",
    invalid_text: "Invalid text",
    invalid_query: "Invalid search query",
    invalid_dict_lang: "Unsupported dictionary language",
    invalid_target_lang: "Unsupported translation language",
    word_not_found: "Word not found",
    definition_not_found: "Definition not found",
    rate_limited: "Too many requests. Try again later.",
    translation_not_configured: "DeepL key is not configured on the server",
    unsplash_not_configured: "Unsplash key is not configured on the server",
    upstream_error: "Failed to fetch data from the upstream service"
  },
  ru: {
    invalid_word: "Некорректное слово",
    invalid_text: "Некорректный текст",
    invalid_query: "Некорректный поисковый запрос",
    invalid_dict_lang: "Неподдерживаемый язык словаря",
    invalid_target_lang: "Неподдерживаемый язык перевода",
    word_not_found: "Слово не найдено",
    definition_not_found: "Определение не найдено",
    rate_limited: "Слишком много запросов. Попробуй позже.",
    translation_not_configured: "Ключ DeepL не настроен на сервере",
    unsplash_not_configured: "Ключ Unsplash не настроен на сервере",
    upstream_error: "Не удалось получить данные от внешнего сервиса"
  },
  de: {
    invalid_word: "Ungültiges Wort",
    invalid_text: "Ungültiger Text",
    invalid_query: "Ungültige Suchanfrage",
    invalid_dict_lang: "Nicht unterstützte Wörterbuchsprache",
    invalid_target_lang: "Nicht unterstützte Zielsprache",
    word_not_found: "Wort nicht gefunden",
    definition_not_found: "Definition nicht gefunden",
    rate_limited: "Zu viele Anfragen. Bitte versuche es später erneut.",
    translation_not_configured: "Der DeepL-Schlüssel ist auf dem Server nicht konfiguriert",
    unsplash_not_configured: "Der Unsplash-Schlüssel ist auf dem Server nicht konfiguriert",
    upstream_error: "Daten vom externen Dienst konnten nicht geladen werden"
  }
};

function normalizeLanguage(value, supportedSet = SUPPORTED_UI_LANGS) {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase().split(/[-_]/)[0];
  return supportedSet.has(normalized) ? normalized : null;
}

function resolveRequestLanguage(req) {
  const queryLanguage = normalizeLanguage(req.query.lang);
  if (queryLanguage) return queryLanguage;

  const acceptLanguage = req.headers["accept-language"];
  if (typeof acceptLanguage === "string" && acceptLanguage.trim()) {
    const candidates = acceptLanguage
      .split(",")
      .map((entry) => entry.split(";")[0].trim());

    for (const candidate of candidates) {
      const normalized = normalizeLanguage(candidate);
      if (normalized) return normalized;
    }
  }

  return FALLBACK_LANG;
}

function errorResponse(lang, errorCode) {
  const resolvedLang = SUPPORTED_UI_LANGS.has(lang) ? lang : FALLBACK_LANG;

  return {
    errorCode,
    error: MESSAGES[resolvedLang][errorCode] || MESSAGES[FALLBACK_LANG][errorCode] || errorCode
  };
}

function isValidText(value, maxLength = 80) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function createTTLCache(ttlMs) {
  const entries = new Map();

  function get(key) {
    const entry = entries.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      entries.delete(key);
      return null;
    }

    return entry.value;
  }

  function set(key, value) {
    entries.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  return {
    get,
    set
  };
}

function createRateLimiter({ windowMs, max }) {
  const buckets = new Map();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (bucket.count >= max) {
      return res.status(429).json(errorResponse(resolveRequestLanguage(req), "rate_limited"));
    }

    bucket.count += 1;
    next();
  };
}

function appendVaryHeader(res, value) {
  const current = res.getHeader("Vary");
  if (!current) {
    res.setHeader("Vary", value);
    return;
  }

  const values = String(current)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!values.includes(value)) {
    res.setHeader("Vary", `${values.join(", ")}, ${value}`);
  }
}

function isLocalDevOrigin(origin) {
  return typeof origin === "string" && LOCAL_DEV_ORIGIN_PATTERN.test(origin);
}

function applyLocalDevCors(req, res, next) {
  const origin = req.headers.origin;
  if (isLocalDevOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    appendVaryHeader(res, "Origin");
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
}

function extractDefinitionFromDictionaryApi(data) {
  if (!Array.isArray(data)) return "";

  for (const entry of data) {
    for (const meaning of entry.meanings || []) {
      for (const definition of meaning.definitions || []) {
        if (typeof definition.definition === "string" && definition.definition.trim()) {
          return definition.definition.trim();
        }
      }
    }
  }

  return "";
}

function normalizeDefinitionText(value) {
  return String(value || "")
    .replace(/\[\d+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchDefinitionFromDictionaryApi(fetchImpl, word, dictLang) {
  const response = await fetchImpl(
    `https://api.dictionaryapi.dev/api/v2/entries/${dictLang}/${encodeURIComponent(word)}`
  );

  if (response.status === 404) {
    return { notFound: true };
  }

  if (!response.ok) {
    return { upstreamError: true };
  }

  const data = await response.json();
  const definition = extractDefinitionFromDictionaryApi(data);

  return definition
    ? {
      definition: normalizeDefinitionText(definition),
      dictLang,
      sourceId: "dictionaryapi",
      sourceLabel: "dictionaryapi.dev"
    }
    : { notFound: true };
}

async function fetchDefinitionEnWiktionary(fetchImpl, word) {
  const response = await fetchImpl(`https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`, {
    headers: { "User-Agent": USER_AGENT }
  });

  if (response.status === 404) {
    return { notFound: true };
  }

  if (!response.ok) {
    return { upstreamError: true };
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const definition = normalizeDefinitionText(
    $('.senseid[data-lang="en"]').filter((_, el) => $(el).text().trim()).first().text() ||
    $("#English").parent().nextAll("ol").first().find("li").first().text()
  );

  return definition
    ? {
      definition,
      dictLang: "en",
      sourceId: "wiktionary",
      sourceLabel: "Wiktionary"
    }
    : { notFound: true };
}

function extractGermanArticleFromDwds($) {
  const candidates = [
    $("h1.dwdswb-ft-lemma").first().text().trim(),
    $(".dwdswb-ft-lemma").first().text().trim(),
    $("h1").first().text().trim(),
    $(".dwdswb-lemma").first().text().trim(),
    $(".dwdswb-headword").first().text().trim(),
    $("title").text().trim()
  ];

  for (const text of candidates) {
    if (!text) continue;

    const commaMatch = text.match(/,\s*(der|die|das)\b/i);
    if (commaMatch) {
      return commaMatch[1].toLowerCase();
    }

    const directMatch = text.match(/\b(der|die|das)\b/i);
    if (directMatch) {
      return directMatch[1].toLowerCase();
    }
  }

  return null;
}

async function fetchDefinitionDe(fetchImpl, word) {
  const response = await fetchImpl(`https://www.dwds.de/wb/${encodeURIComponent(word)}`, {
    headers: { "User-Agent": USER_AGENT }
  });

  if (response.status === 404) {
    return { notFound: true };
  }

  if (!response.ok) {
    return { upstreamError: true };
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const definition = normalizeDefinitionText(
    $(".dwdswb-definition").first().text().trim() ||
    $(".dwdswb-paraphrase").first().text().trim() ||
    $(".dwdswb-lesart").first().text().trim()
  );

  const article = extractGermanArticleFromDwds($);

  return definition
    ? {
      definition,
      article,
      dictLang: "de",
      sourceId: "dwds",
      sourceLabel: "DWDS"
    }
    : { notFound: true };
}

async function fetchDefinitionDeWiktionary(fetchImpl, word) {
  const response = await fetchImpl(`https://de.wiktionary.org/wiki/${encodeURIComponent(word)}`, {
    headers: { "User-Agent": USER_AGENT }
  });

  if (response.status === 404) {
    return { notFound: true };
  }

  if (!response.ok) {
    return { upstreamError: true };
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const definition = normalizeDefinitionText(
    $('p[title*="Semantik"]').next("dl").find("dd").first().text() ||
    $(".mw-parser-output p").filter((_, el) => $(el).text().trim() === "Bedeutungen:").first()
      .next("dl")
      .find("dd")
      .first()
      .text()
  );

  return definition
    ? {
      definition,
      dictLang: "de",
      sourceId: "wiktionary",
      sourceLabel: "Wiktionary"
    }
    : { notFound: true };
}

async function fetchDefinitionRu(fetchImpl, word) {
  let wiktionaryFailed = false;

  try {
    const response = await fetchImpl(`https://ru.wiktionary.org/wiki/${encodeURIComponent(word)}`, {
      headers: { "User-Agent": USER_AGENT }
    });

    if (response.ok) {
      const html = await response.text();
      const $ = cheerio.load(html);

      const definition =
        $("#Значение").nextAll("ol").first().find("li").first().text().trim() ||
        $(".mw-parser-output ol li").first().text().trim();

      if (definition) {
        return {
          definition,
          dictLang: "ru",
          sourceId: "wiktionary",
          sourceLabel: "Wiktionary"
        };
      }
    } else if (response.status !== 404) {
      wiktionaryFailed = true;
    }
  } catch {
    wiktionaryFailed = true;
  }

  const direct = await fetchDefinitionFromDictionaryApi(fetchImpl, word, "ru");
  if (direct.definition || direct.notFound) {
    return direct;
  }

  return wiktionaryFailed || direct.upstreamError ? { upstreamError: true } : { notFound: true };
}

async function resolveDefinition(fetchImpl, word, dictLang) {
  if (dictLang === "de") {
    const primary = await fetchDefinitionDe(fetchImpl, word);
    if (primary.definition) {
      return primary;
    }

    const fallback = await fetchDefinitionDeWiktionary(fetchImpl, word);
    if (fallback.definition || (primary.notFound && fallback.notFound)) {
      return fallback.definition ? fallback : { notFound: true };
    }

    return primary.upstreamError || fallback.upstreamError ? { upstreamError: true } : { notFound: true };
  }

  if (dictLang === "ru") {
    return fetchDefinitionRu(fetchImpl, word);
  }

  const primary = await fetchDefinitionFromDictionaryApi(fetchImpl, word, "en");
  if (primary.definition) {
    return primary;
  }

  const fallback = await fetchDefinitionEnWiktionary(fetchImpl, word);
  if (fallback.definition || (primary.notFound && fallback.notFound)) {
    return fallback.definition ? fallback : { notFound: true };
  }

  return primary.upstreamError || fallback.upstreamError ? { upstreamError: true } : { notFound: true };
}

function mapDeepLTargetLang(targetLang) {
  const normalized = normalizeLanguage(targetLang, SUPPORTED_TRANSLATE_LANGS);
  if (!normalized) return null;

  return normalized.toUpperCase();
}

async function translateWithDeepL(fetchImpl, text, targetLang, options = {}) {
  const apiKey = options.apiKey;
  const baseUrl = (options.baseUrl || "https://api-free.deepl.com/v2").replace(/\/$/, "");

  if (!apiKey) {
    return { notConfigured: true };
  }

  const deepLTargetLang = mapDeepLTargetLang(targetLang);
  if (!deepLTargetLang) {
    return { invalidTargetLang: true };
  }

  const body = new URLSearchParams({
    text,
    target_lang: deepLTargetLang
  });

  const response = await fetchImpl(`${baseUrl}/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT
    },
    body
  });

  if (!response.ok) {
    return { upstreamError: true };
  }

  const payload = await response.json();
  const translation = payload?.translations?.[0]?.text?.trim();
  const detectedSourceLanguage = payload?.translations?.[0]?.detected_source_language || "";

  return translation
    ? {
      translation,
      targetLang,
      detectedSourceLanguage,
      providerId: "deepl",
      providerLabel: "DeepL"
    }
    : { upstreamError: true };
}

function collectEnvCandidatePaths(options = {}) {
  const candidates = [
    options.envPath,
    process.env.KARTO_ENV_PATH,
    process.env.PORTABLE_EXECUTABLE_DIR
      ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, ".env")
      : null,
    process.execPath
      ? path.join(path.dirname(process.execPath), ".env")
      : null,
    typeof process.cwd === "function"
      ? path.join(process.cwd(), ".env")
      : null,
    path.join(__dirname, ".env")
  ];

  const uniquePaths = new Set();
  const resolvedPaths = [];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "string") {
      continue;
    }

    const resolvedPath = path.resolve(candidate);
    if (uniquePaths.has(resolvedPath)) {
      continue;
    }

    uniquePaths.add(resolvedPath);
    resolvedPaths.push(resolvedPath);
  }

  return resolvedPaths;
}

function loadEnvironment(options = {}) {
  for (const envPath of collectEnvCandidatePaths(options)) {
    if (!fs.existsSync(envPath)) {
      continue;
    }

    if (loadedEnvPath === envPath) {
      return envPath;
    }

    dotenv.config({
      path: envPath,
      override: false
    });

    loadedEnvPath = envPath;
    return envPath;
  }

  return null;
}

function createApp(options = {}) {
  loadEnvironment(options);

  const fetchImpl = options.fetchImpl || fetch;
  const staticRoot = options.staticRoot || process.env.KARTO_STATIC_ROOT || __dirname;
  const unsplashAccessKey = options.unsplashAccessKey ?? process.env.UNSPLASH_ACCESS_KEY;
  const deepLApiKey = options.deepLApiKey ?? process.env.DEEPL_API_KEY;
  const deepLApiBaseUrl = options.deepLApiBaseUrl ?? process.env.DEEPL_API_BASE_URL;
  const definitionCache = options.definitionCache || createTTLCache(30 * 60 * 1000);
  const defineLimiter = createRateLimiter(options.defineRateLimit || { windowMs: 60 * 1000, max: 20 });
  const translateLimiter = createRateLimiter(options.translateRateLimit || { windowMs: 60 * 1000, max: 20 });
  const imageLimiter = createRateLimiter(options.imageRateLimit || { windowMs: 60 * 1000, max: 12 });

  const app = express();
  app.disable("x-powered-by");
  app.use("/api", applyLocalDevCors);

  function sendAppShell(res) {
    res.set(APP_SHELL_RESPONSE_HEADERS);
    res.sendFile(path.join(staticRoot, "index.html"));
  }

  // Serve the SPA shell explicitly before static middleware so packaged
  // builds never ask serve-static to stat the app.asar root for "/".
  app.get("/", (req, res) => {
    sendAppShell(res);
  });

  app.get("/index.html", (req, res) => {
    sendAppShell(res);
  });

  app.use(express.static(staticRoot, {
    index: false,
    dotfiles: "ignore"
  }));

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      app: "Karto",
      uptimeSeconds: Number(process.uptime().toFixed(2))
    });
  });

  app.get("/api/define", defineLimiter, async (req, res) => {
    const word = req.query.word;
    const requestedDictLang = req.query.dictLang;
    const dictLang = requestedDictLang === undefined
      ? "en"
      : normalizeLanguage(requestedDictLang, SUPPORTED_DICT_LANGS);
    const uiLang = resolveRequestLanguage(req);

    if (!isValidText(word, 100)) {
      return res.status(400).json(errorResponse(uiLang, "invalid_word"));
    }

    if (!dictLang || !SUPPORTED_DICT_LANGS.has(dictLang)) {
      return res.status(400).json(errorResponse(uiLang, "invalid_dict_lang"));
    }

    const trimmedWord = word.trim();
    const cacheKey = `${dictLang}:${trimmedWord.toLowerCase()}`;
    const cached = definitionCache.get(cacheKey);
    if (cached) {
      return res.status(cached.status).json(cached.payload);
    }

    try {
      const result = await resolveDefinition(fetchImpl, trimmedWord, dictLang);

      if (result.definition) {
        const payload = {
          definition: result.definition,
          article: result.article || null,
          dictLang: result.dictLang || dictLang,
          sourceId: result.sourceId || "",
          sourceLabel: result.sourceLabel || ""
        };
        definitionCache.set(cacheKey, { status: 200, payload });
        return res.json(payload);
      }

      if (result.notFound) {
        const payload = errorResponse(uiLang, "word_not_found");
        definitionCache.set(cacheKey, { status: 404, payload });
        return res.status(404).json(payload);
      }

      return res.status(502).json(errorResponse(uiLang, "upstream_error"));
    } catch (error) {
      console.error("Dictionary request failed:", error);
      return res.status(502).json(errorResponse(uiLang, "upstream_error"));
    }
  });

  app.get("/api/translate", translateLimiter, async (req, res) => {
    const text = req.query.text;
    const requestedTargetLang = req.query.targetLang;
    const targetLang = requestedTargetLang === undefined
      ? FALLBACK_LANG
      : normalizeLanguage(requestedTargetLang, SUPPORTED_TRANSLATE_LANGS);
    const uiLang = resolveRequestLanguage(req);

    if (!isValidText(text, 500)) {
      return res.status(400).json(errorResponse(uiLang, "invalid_text"));
    }

    if (!targetLang || !SUPPORTED_TRANSLATE_LANGS.has(targetLang)) {
      return res.status(400).json(errorResponse(uiLang, "invalid_target_lang"));
    }

    try {
      const result = await translateWithDeepL(fetchImpl, text.trim(), targetLang, {
        apiKey: deepLApiKey,
        baseUrl: deepLApiBaseUrl
      });

      if (result.notConfigured) {
        return res.status(500).json(errorResponse(uiLang, "translation_not_configured"));
      }

      if (result.invalidTargetLang) {
        return res.status(400).json(errorResponse(uiLang, "invalid_target_lang"));
      }

      if (result.translation) {
        return res.json(result);
      }

      return res.status(502).json(errorResponse(uiLang, "upstream_error"));
    } catch (error) {
      console.error("Translation request failed:", error);
      return res.status(502).json(errorResponse(uiLang, "upstream_error"));
    }
  });

  app.get("/api/images", imageLimiter, async (req, res) => {
    const query = req.query.query;
    const uiLang = resolveRequestLanguage(req);

    if (!isValidText(query, 60)) {
      return res.status(400).json(errorResponse(uiLang, "invalid_query"));
    }

    if (!unsplashAccessKey) {
      return res.status(500).json(errorResponse(uiLang, "unsplash_not_configured"));
    }

    const trimmedQuery = query.trim();

    try {
      const response = await fetchImpl(
        "https://api.unsplash.com/search/photos" +
          `?query=${encodeURIComponent(trimmedQuery)}` +
          "&per_page=6" +
          `&client_id=${unsplashAccessKey}`,
        {
          headers: { "User-Agent": USER_AGENT }
        }
      );

      const data = await response.json();
      if (!response.ok || !Array.isArray(data.results)) {
        return res.status(502).json(errorResponse(uiLang, "upstream_error"));
      }

      res.json({
        images: data.results.map((photo) => ({
          small: photo.urls.small,
          regular: photo.urls.regular,
          alt: photo.alt_description || trimmedQuery
        }))
      });
    } catch (error) {
      console.error("Image request failed:", error);
      return res.status(502).json(errorResponse(uiLang, "upstream_error"));
    }
  });

  return {
    app,
    definitionCache
  };
}

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
