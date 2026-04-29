"use strict";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeLogValue(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatErrorDetails(error) {
  if (!error) return "Unknown error";
  if (error.stack) return error.stack;
  if (error.message) return error.message;
  return String(error);
}

function createErrorHtml(title, details) {
  const safeTitle = escapeHtml(title);
  const safeDetails = escapeHtml(details).replace(/\r?\n/g, "<br>");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Karto - ошибка запуска</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: #14171c;
      color: #f5f7fb;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at top, rgba(81, 135, 255, 0.24), transparent 45%),
        linear-gradient(180deg, #171b22 0%, #0f1217 100%);
    }
    main {
      width: min(720px, calc(100vw - 48px));
      padding: 28px 30px;
      border-radius: 20px;
      background: rgba(19, 24, 32, 0.92);
      box-shadow: 0 24px 72px rgba(0, 0, 0, 0.38);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    h1 {
      margin: 0 0 12px;
      font-size: 28px;
      line-height: 1.2;
    }
    p {
      margin: 0 0 20px;
      color: rgba(245, 247, 251, 0.75);
      font-size: 15px;
      line-height: 1.6;
    }
    pre {
      margin: 0;
      padding: 18px;
      border-radius: 14px;
      background: rgba(7, 10, 14, 0.72);
      color: #d6def0;
      font-size: 13px;
      line-height: 1.5;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      border: 1px solid rgba(255, 255, 255, 0.06);
    }
  </style>
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    <p>Karto не смог открыть встроенный интерфейс. Подробности ошибки ниже.</p>
    <pre>${safeDetails}</pre>
  </main>
</body>
</html>`;
}

module.exports = {
  createErrorHtml,
  escapeLogValue,
  formatErrorDetails
};
