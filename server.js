require("dotenv").config();

const path = require("node:path");

const express = require("express");
const cheerio = require("cheerio");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const USER_AGENT = "Mozilla/5.0 (compatible; Karto/1.0)";

const SUPPORTED_UI_LANGS = new Set(["ru", "en", "de"]);
const SUPPORTED_DICT_LANGS = new Set(["en", "de", "ru"]);
const FALLBACK_LANG = "en";

const MESSAGES = {
  en: {
    invalid_word: "Invalid word",
    invalid_query: "Invalid search query",
    invalid_dict_lang: "Unsupported dictionary language",
    word_not_found: "Word not found",
    definition_not_found: "Definition not found",
    rate_limited: "Too many requests. Try again later.",
    unsplash_not_configured: "Unsplash key is not configured on the server",
    upstream_error: "Failed to fetch data from the upstream service"
  },
  ru: {
    invalid_word: "Некорректное слово",
    invalid_query: "Некорректный поисковый запрос",
    invalid_dict_lang: "Неподдерживаемый язык словаря",
    word_not_found: "Слово не найдено",
    definition_not_found: "Определение не найдено",
    rate_limited: "Слишком много запросов. Попробуй позже.",
    unsplash_not_configured: "Ключ Unsplash не настроен на сервере",
    upstream_error: "Не удалось получить данные от внешнего сервиса"
  },
  de: {
    invalid_word: "Ungültiges Wort",
    invalid_query: "Ungültige Suchanfrage",
    invalid_dict_lang: "Nicht unterstützte Wörterbuchsprache",
    word_not_found: "Wort nicht gefunden",
    definition_not_found: "Definition nicht gefunden",
    rate_limited: "Zu viele Anfragen. Bitte versuche es später erneut.",
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

  return definition ? { definition } : { notFound: true };
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

  const definition =
    $(".dwdswb-definition").first().text().trim() ||
    $(".dwdswb-paraphrase").first().text().trim() ||
    $(".dwdswb-lesart").first().text().trim();

  return definition ? { definition } : { notFound: true };
}

async function fetchDefinitionRu(fetchImpl, word) {
  const direct = await fetchDefinitionFromDictionaryApi(fetchImpl, word, "ru");
  if (direct.definition || direct.upstreamError) {
    return direct;
  }

  const response = await fetchImpl(`https://ru.wiktionary.org/wiki/${encodeURIComponent(word)}`, {
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

  const definition =
    $("#Значение").nextAll("ol").first().find("li").first().text().trim() ||
    $(".mw-parser-output ol li").first().text().trim();

  return definition ? { definition } : direct;
}

async function resolveDefinition(fetchImpl, word, dictLang) {
  if (dictLang === "de") {
    return fetchDefinitionDe(fetchImpl, word);
  }

  if (dictLang === "ru") {
    return fetchDefinitionRu(fetchImpl, word);
  }

  return fetchDefinitionFromDictionaryApi(fetchImpl, word, "en");
}

function createApp(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const staticRoot = options.staticRoot || __dirname;
  const unsplashAccessKey = options.unsplashAccessKey ?? process.env.UNSPLASH_ACCESS_KEY;
  const definitionCache = options.definitionCache || createTTLCache(30 * 60 * 1000);
  const defineLimiter = createRateLimiter(options.defineRateLimit || { windowMs: 60 * 1000, max: 20 });
  const imageLimiter = createRateLimiter(options.imageRateLimit || { windowMs: 60 * 1000, max: 12 });

  const app = express();
  app.disable("x-powered-by");

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
    const dictLang = normalizeLanguage(req.query.dictLang, SUPPORTED_DICT_LANGS) || "en";
    const uiLang = resolveRequestLanguage(req);

    if (!isValidText(word, 100)) {
      return res.status(400).json(errorResponse(uiLang, "invalid_word"));
    }

    if (!SUPPORTED_DICT_LANGS.has(dictLang)) {
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
        const payload = { definition: result.definition };
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

  app.get("/", (req, res) => {
    res.sendFile(path.join(staticRoot, "index.html"));
  });

  return {
    app,
    definitionCache
  };
}

if (require.main === module) {
  const { app } = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`Karto server started on http://${HOST}:${PORT}`);
  });
}

module.exports = {
  createApp,
  createRateLimiter,
  createTTLCache,
  errorResponse,
  normalizeLanguage,
  resolveRequestLanguage
};
