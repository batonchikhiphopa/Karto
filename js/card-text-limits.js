(function(root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis, function() {
  const CARD_TEXT_LIMITS = Object.freeze({
    front: Object.freeze({
      hardChars: 120,
      softChars: 80,
      hardLines: 2,
      softLines: 2
    }),
    answer: Object.freeze({
      hardChars: 700,
      softChars: 450,
      hardLines: 6,
      softLines: 5
    }),
    maxExtraSides: 5
  });

  function normalizeLineBreaks(value) {
    return String(value || "").replace(/\r\n?/g, "\n");
  }

  function countWrappedLines(value, options = {}) {
    const text = normalizeLineBreaks(value);
    if (!text) {
      return 0;
    }

    const maxColumns = Number.isFinite(Number(options.maxColumns))
      ? Math.max(1, Math.round(Number(options.maxColumns)))
      : null;

    return text.split("\n").reduce((lineCount, line) => {
      if (!maxColumns) {
        return lineCount + 1;
      }

      return lineCount + Math.max(1, Math.ceil(line.length / maxColumns));
    }, 0);
  }

  function getCardTextLimit(kind) {
    return kind === "front" ? CARD_TEXT_LIMITS.front : CARD_TEXT_LIMITS.answer;
  }

  function createCardTextMetrics(value, kind, options = {}) {
    const text = String(value || "");
    const limit = getCardTextLimit(kind);
    const lineCount = Number.isFinite(Number(options.lineCount))
      ? Math.max(0, Math.round(Number(options.lineCount)))
      : countWrappedLines(text, options);
    const charCount = text.length;

    return {
      kind,
      charCount,
      lineCount,
      maxChars: limit.hardChars,
      maxLines: limit.hardLines,
      isEmpty: text.trim().length === 0,
      isWarning: charCount >= limit.softChars || lineCount >= limit.softLines,
      isError: charCount > limit.hardChars || lineCount > limit.hardLines
    };
  }

  function validateCardTextValue(value, kind, options = {}) {
    const metrics = createCardTextMetrics(value, kind, options);

    return {
      ...metrics,
      isValid: !metrics.isEmpty && !metrics.isError
    };
  }

  function formatCardTextCounter(metrics) {
    return `${metrics.lineCount} / ${metrics.maxLines} lines · ${metrics.charCount} / ${metrics.maxChars} chars`;
  }

  return {
    CARD_TEXT_LIMITS,
    countWrappedLines,
    createCardTextMetrics,
    formatCardTextCounter,
    getCardTextLimit,
    normalizeLineBreaks,
    validateCardTextValue
  };
});
