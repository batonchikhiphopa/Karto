const assert = require("node:assert/strict");

const {
  MAX_LOG_PREVIEW_LENGTH,
  detectRawBootstrap,
  escapePreviewForLog,
  evaluateVerificationResult,
  formatFailedAttemptLog,
  makePreview,
  normalizeBodyText
} = require("../js/startup-verification.js");

function testNormalizeBodyText() {
  assert.equal(
    normalizeBodyText("  Karto \n\t launch   ready  "),
    "Karto launch ready"
  );
}

function testDetectRawBootstrapSignatures() {
  assert.equal(
    detectRawBootstrap("document.documentElement.dataset.theme = localStorage.getItem(\"karto.theme\") || \"system\""),
    true
  );
  assert.equal(detectRawBootstrap("Karto (function() { try { boot(); } })();"), true);
  assert.equal(detectRawBootstrap("Karto finished loading normally."), false);
}

function testHealthyEvaluation() {
  const evaluation = evaluateVerificationResult({
    hasAppShell: true,
    hasAppMain: true,
    normalizedBodyText: "Karto desktop workspace is ready for use right now.",
    hasRawBootstrapText: false
  });

  assert.equal(evaluation.ok, true);
  assert.equal(evaluation.reason, null);
}

function testBodyTooShortEvaluation() {
  const evaluation = evaluateVerificationResult({
    hasAppShell: true,
    hasAppMain: true,
    normalizedBodyText: "too short",
    hasRawBootstrapText: false
  });

  assert.equal(evaluation.ok, false);
  assert.equal(evaluation.reason, "body_too_short");
}

function testReasonPriority() {
  const evaluation = evaluateVerificationResult({
    timeout: true,
    navigationError: "navigation failed",
    rendererError: "renderer failed",
    hasAppShell: false,
    hasAppMain: false,
    normalizedBodyText: "Karto (function() { try { boot(); } })();"
  });

  assert.equal(evaluation.reason, "timeout");
}

function testRendererResultInterpretation() {
  const evaluation = evaluateVerificationResult({
    hasAppShell: true,
    hasAppMain: false,
    normalizedBodyText: "This renderer result is long enough to validate body length safely.",
    hasRawBootstrapText: false,
    preview: "This renderer result is long enough to validate body length safely."
  });

  assert.equal(evaluation.ok, false);
  assert.equal(evaluation.reason, "missing_main");
  assert.equal(evaluation.preview.includes("renderer result"), true);
}

function testPreviewTruncation() {
  const preview = makePreview("a".repeat(MAX_LOG_PREVIEW_LENGTH + 25));

  assert.equal(preview.length <= MAX_LOG_PREVIEW_LENGTH, true);
  assert.equal(preview.endsWith("..."), true);
}

function testPreviewEscaping() {
  const escaped = escapePreviewForLog("line 1\n\"quoted\" \\ path");

  assert.equal(escaped.includes("\n"), false);
  assert.equal(escaped.includes("\\\"quoted\\\""), true);
  assert.equal(escaped.includes("\\\\ path"), true);
}

function testFailedAttemptLogFormat() {
  const evaluation = evaluateVerificationResult({
    hasAppShell: true,
    hasAppMain: true,
    normalizedBodyText: "Karto (function() { try { boot(); } })();",
    hasRawBootstrapText: true
  });
  const logLine = formatFailedAttemptLog({
    attempt: 1,
    elapsedMs: 142,
    url: "http://127.0.0.1:3000/",
    evaluation
  });

  assert.match(logLine, /^\[karto\]\[startup-check\] attempt=1 reason=raw_bootstrap /);
  assert.equal(logLine.includes("\n"), false);
  assert.equal(logLine.includes("raw_bootstrap=1"), true);
}

testNormalizeBodyText();
testDetectRawBootstrapSignatures();
testHealthyEvaluation();
testBodyTooShortEvaluation();
testReasonPriority();
testRendererResultInterpretation();
testPreviewTruncation();
testPreviewEscaping();
testFailedAttemptLogFormat();

console.log("startup verification tests passed");
