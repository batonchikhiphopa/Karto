const assert = require("node:assert/strict");

const {
  countWrappedLines,
  createCardTextMetrics,
  validateCardTextValue
} = require("../js/card-text-limits.js");

function testWrappedLineCounterCountsManualAndVisualLines() {
  assert.equal(countWrappedLines("alpha", { maxColumns: 10 }), 1);
  assert.equal(countWrappedLines("alpha\nbeta", { maxColumns: 10 }), 2);
  assert.equal(countWrappedLines("alpha\n\nbeta", { maxColumns: 10 }), 3);
  assert.equal(countWrappedLines("abcdefghijkl", { maxColumns: 5 }), 3);
  assert.equal(countWrappedLines("abc\ndefghijk", { maxColumns: 4 }), 3);
}

function testTextMetricsUseConfiguredLimits() {
  const frontMetrics = createCardTextMetrics("a".repeat(121), "front", { lineCount: 1 });
  const answerMetrics = createCardTextMetrics("line 1\nline 2", "answer", { maxColumns: 80 });

  assert.equal(frontMetrics.maxLines, 2);
  assert.equal(frontMetrics.maxChars, 120);
  assert.equal(frontMetrics.isError, true);
  assert.equal(answerMetrics.lineCount, 2);
  assert.equal(answerMetrics.maxLines, 6);
}

function testValidationBlocksEmptyAndOverLimitText() {
  assert.equal(validateCardTextValue("", "answer").isValid, false);
  assert.equal(validateCardTextValue("ok", "answer", { lineCount: 1 }).isValid, true);
  assert.equal(validateCardTextValue("too many lines", "answer", { lineCount: 7 }).isValid, false);
  assert.equal(validateCardTextValue("front", "front", { lineCount: 3 }).isValid, false);
}

testWrappedLineCounterCountsManualAndVisualLines();
testTextMetricsUseConfiguredLimits();
testValidationBlocksEmptyAndOverLimitText();

console.log("card text limit tests passed");
