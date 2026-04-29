"use strict";

const path = require("node:path");

const express = require("express");

const {
  APP_SHELL_RESPONSE_HEADERS,
  FALLBACK_LANG,
  SUPPORTED_DICT_LANGS,
  SUPPORTED_TRANSLATE_LANGS,
  USER_AGENT,
  applyLocalDevCors,
  buildUnsplashImageUrl,
  createRateLimiter,
  createTTLCache,
  errorResponse,
  isValidText,
  normalizeLanguage,
  resolveRequestLanguage
} = require("./http-utils");
const {
  getGermanDefinitionLookupWord,
  resolveDefinition
} = require("./definition-service");
const { translateWithDeepL } = require("./translation-service");
const {
  collectEnvCandidatePaths,
  loadEnvironment
} = require("./environment");

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
    const lookupWord = dictLang === "de" ? getGermanDefinitionLookupWord(trimmedWord) : trimmedWord;
    const cacheKey = `${dictLang}:${lookupWord.toLowerCase()}`;
    const cached = definitionCache.get(cacheKey);
    if (cached) {
      return res.status(cached.status).json(cached.payload);
    }

    try {
      const result = await resolveDefinition(fetchImpl, lookupWord, dictLang);

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
          regular: buildUnsplashImageUrl(photo.urls.raw, {
      width: 600,
      quality: 60,
      fit: "max"
    }),
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


module.exports = {
  collectEnvCandidatePaths,
  createApp,
  createRateLimiter,
  createTTLCache,
  errorResponse,
  loadEnvironment,
  normalizeLanguage,
  resolveRequestLanguage
};
