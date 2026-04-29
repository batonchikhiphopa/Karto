"use strict";

const cheerio = require("cheerio");
const { USER_AGENT } = require("./http-utils");

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

function getGermanDefinitionLookupWord(word) {
  const trimmedWord = String(word || "").trim();
  const tokens = trimmedWord.split(/\s+/);

  if (tokens.length > 1 && /^(der|die|das)$/i.test(tokens[0])) {
    return tokens[tokens.length - 1];
  }

  return trimmedWord;
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

module.exports = {
  getGermanDefinitionLookupWord,
  resolveDefinition
};
