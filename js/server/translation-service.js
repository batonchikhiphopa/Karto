"use strict";

const {
  SUPPORTED_TRANSLATE_LANGS,
  USER_AGENT,
  normalizeLanguage
} = require("./http-utils");

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

module.exports = {
  translateWithDeepL
};
