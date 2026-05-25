function normalizeCssValue(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

module.exports = {
  normalizeCssValue
};
