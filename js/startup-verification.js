"use strict";

const SHELL_MARKERS = Object.freeze({
  shell: ".app-shell",
  main: "#appMain"
});

const STARTUP_VERIFY_TIMEOUT_MS = 3000;
const MIN_NORMALIZED_BODY_LENGTH = 24;
const MAX_LOG_PREVIEW_LENGTH = 120;
const RAW_BOOTSTRAP_SIGNATURES = Object.freeze([
  "document.documentElement.dataset.theme = localStorage.getItem(\"karto.theme\") || \"system\"",
  "Karto (function() {"
]);

function normalizeBodyText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectRawBootstrap(text) {
  const normalized = normalizeBodyText(text);
  return RAW_BOOTSTRAP_SIGNATURES.some((signature) => normalized.includes(signature));
}

function makePreview(text) {
  const normalized = normalizeBodyText(text);

  if (normalized.length <= MAX_LOG_PREVIEW_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_LOG_PREVIEW_LENGTH - 3).trimEnd()}...`;
}

function escapePreviewForLog(preview) {
  const escaped = normalizeBodyText(preview)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/[\u0000-\u001f\u007f]/g, " ");

  if (escaped.length <= MAX_LOG_PREVIEW_LENGTH) {
    return escaped;
  }

  return `${escaped.slice(0, MAX_LOG_PREVIEW_LENGTH - 3).trimEnd()}...`;
}

function evaluateVerificationResult(input = {}) {
  const normalizedBodyText = normalizeBodyText(input.normalizedBodyText || "");
  const hasAppShell = Boolean(input.hasAppShell);
  const hasAppMain = Boolean(input.hasAppMain);
  const timeout = Boolean(input.timeout);
  const navigationError = input.navigationError ? String(input.navigationError) : "";
  const rendererError = input.rendererError ? String(input.rendererError) : "";
  const hasRawBootstrapText = Boolean(input.hasRawBootstrapText) || detectRawBootstrap(normalizedBodyText);
  const bodyTooShort = normalizedBodyText.length < MIN_NORMALIZED_BODY_LENGTH;
  const preview = makePreview(input.preview || normalizedBodyText);

  let reason = null;

  if (timeout) {
    reason = "timeout";
  } else if (navigationError) {
    reason = "navigation_error";
  } else if (rendererError) {
    reason = "renderer_error";
  } else if (hasRawBootstrapText) {
    reason = "raw_bootstrap";
  } else if (bodyTooShort) {
    reason = "body_too_short";
  } else if (!hasAppShell) {
    reason = "missing_shell";
  } else if (!hasAppMain) {
    reason = "missing_main";
  }

  return {
    ok: reason === null,
    reason,
    timeout,
    navigationError,
    rendererError,
    hasAppShell,
    hasAppMain,
    hasRawBootstrapText,
    bodyTooShort,
    normalizedBodyText,
    preview
  };
}

function formatFailedAttemptLog(options = {}) {
  const evaluation = options.evaluation || evaluateVerificationResult(options);
  const attempt = Number.isFinite(Number(options.attempt)) ? Math.max(1, Number(options.attempt)) : 1;
  const elapsedMs = Number.isFinite(Number(options.elapsedMs))
    ? Math.max(0, Math.round(Number(options.elapsedMs)))
    : 0;
  const url = String(options.url || "");
  const preview = escapePreviewForLog(evaluation.preview);

  return `[karto][startup-check] attempt=${attempt} reason=${evaluation.reason || "unknown"}` +
    ` elapsed_ms=${elapsedMs} url=${url}` +
    ` shell=${evaluation.hasAppShell ? 1 : 0}` +
    ` main=${evaluation.hasAppMain ? 1 : 0}` +
    ` raw_bootstrap=${evaluation.hasRawBootstrapText ? 1 : 0}` +
    ` preview="${preview}"`;
}

function buildRendererVerificationScript() {
  return `
(() => {
  const SHELL_MARKERS = ${JSON.stringify(SHELL_MARKERS)};
  const RAW_BOOTSTRAP_SIGNATURES = ${JSON.stringify(RAW_BOOTSTRAP_SIGNATURES)};
  const MAX_LOG_PREVIEW_LENGTH = ${JSON.stringify(MAX_LOG_PREVIEW_LENGTH)};
  const normalizeBodyText = ${normalizeBodyText.toString()};
  const detectRawBootstrap = ${detectRawBootstrap.toString()};
  const makePreview = ${makePreview.toString()};
  const normalizedBodyText = normalizeBodyText(document.body?.innerText || "");

  return {
    hasAppShell: Boolean(document.querySelector(SHELL_MARKERS.shell)),
    hasAppMain: Boolean(document.querySelector(SHELL_MARKERS.main)),
    normalizedBodyText,
    hasRawBootstrapText: detectRawBootstrap(normalizedBodyText),
    preview: makePreview(normalizedBodyText)
  };
})()
  `;
}

module.exports = {
  MAX_LOG_PREVIEW_LENGTH,
  MIN_NORMALIZED_BODY_LENGTH,
  RAW_BOOTSTRAP_SIGNATURES,
  SHELL_MARKERS,
  STARTUP_VERIFY_TIMEOUT_MS,
  buildRendererVerificationScript,
  detectRawBootstrap,
  escapePreviewForLog,
  evaluateVerificationResult,
  formatFailedAttemptLog,
  makePreview,
  normalizeBodyText
};
