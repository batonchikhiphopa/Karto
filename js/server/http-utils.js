"use strict";

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

function buildUnsplashImageUrl(source, options = {}) {
  if (typeof source !== "string" || !source.trim()) {
    return "";
  }

  try {
    const url = new URL(source);
    if (options.width) {
      url.searchParams.set("w", String(options.width));
    }
    if (options.quality) {
      url.searchParams.set("q", String(options.quality));
    }
    if (options.fit) {
      url.searchParams.set("fit", String(options.fit));
    }
    return url.toString();
  } catch {
    return source.trim();
  }
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

module.exports = {
  APP_SHELL_RESPONSE_HEADERS,
  DEFAULT_HOST,
  DEFAULT_PORT,
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
};
