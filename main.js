"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, dialog, ipcMain, session } = require("electron");

const { createServer } = require("./server");
const { createSqliteRepository } = require("./js/sqlite-repository");
const {
  STARTUP_VERIFY_TIMEOUT_MS,
  buildRendererVerificationScript,
  evaluateVerificationResult,
  formatFailedAttemptLog,
  makePreview
} = require("./js/startup-verification");

const APP_ROOT = app.getAppPath();
const APP_ICON_PATH = path.join(APP_ROOT, "logo.svg");
const HOST = "127.0.0.1";
const PORT = 3000;
const BASE_ORIGIN = `http://${HOST}:${PORT}`;
const WINDOW_MIN_WIDTH = 600;
const WINDOW_MIN_HEIGHT = 500;
const DEFAULT_WINDOW_BOUNDS = Object.freeze({
  width: 1280,
  height: 820
});
const DESKTOP_PREFERENCES_PATH = path.join(app.getPath("userData"), "desktop-preferences.json");
const DESKTOP_DATABASE_PATH = path.join(app.getPath("userData"), "karto.db");
const STARTUP_PHASES = Object.freeze({
  IDLE: "idle",
  LAUNCHING: "launching",
  ATTEMPT1: "attempt1",
  ATTEMPT2: "attempt2",
  VERIFIED: "verified",
  FAILED: "failed"
});
const STARTUP_RENDERER_SCRIPT = buildRendererVerificationScript();

let server = null;
let baseUrl = "";
let mainWindow = null;
let appWindow = null;
let isQuitting = false;
let shutdownPromise = null;
let desktopFrontendCacheCleanupPromise = null;
let desktopPreferences = loadDesktopPreferences();
let startupPhase = STARTUP_PHASES.IDLE;
let startupSequencePromise = null;
let startupAttemptPromise = null;
let startupAttemptToken = 0;
let startupMetrics = null;
let startupFailurePromise = null;
let dataRepository = null;

async function clearDesktopFrontendCaches() {
  if (desktopFrontendCacheCleanupPromise) {
    return desktopFrontendCacheCleanupPromise;
  }

  desktopFrontendCacheCleanupPromise = (async () => {
    const targetSession = session.defaultSession;

    if (!targetSession) {
      return;
    }

    try {
      await targetSession.clearCache();
      await targetSession.clearStorageData({
        origin: BASE_ORIGIN,
        storages: ["serviceworkers", "cachestorage"]
      });
    } catch (error) {
      console.error("[karto] Failed to clear desktop frontend caches:", error);
    }
  })();

  return desktopFrontendCacheCleanupPromise;
}

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

function getDataRepository() {
  if (!dataRepository) {
    dataRepository = createSqliteRepository({
      dbPath: DESKTOP_DATABASE_PATH
    });
  }

  return dataRepository;
}

function closeDataRepository() {
  if (!dataRepository) {
    return;
  }

  dataRepository.close();
  dataRepository = null;
}

function registerSyncIpc(channel, handler) {
  ipcMain.on(channel, (event, ...args) => {
    try {
      event.returnValue = {
        ok: true,
        value: handler(...args)
      };
    } catch (error) {
      event.returnValue = {
        ok: false,
        error: formatErrorDetails(error)
      };
    }
  });
}

function createErrorHtml(title, details) {
  const safeTitle = escapeHtml(title);
  const safeDetails = escapeHtml(details).replace(/\r?\n/g, "<br>");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Karto — ошибка запуска</title>
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

function beginStartupMetrics() {
  startupMetrics = {
    startedAt: Date.now(),
    checkpoints: []
  };
}

function recordStartupCheckpoint(name) {
  if (!startupMetrics) {
    return;
  }

  startupMetrics.checkpoints.push({
    name,
    elapsedMs: Date.now() - startupMetrics.startedAt
  });
}

function formatStartupCheckpointSummary() {
  if (!startupMetrics || startupMetrics.checkpoints.length === 0) {
    return "";
  }

  return startupMetrics.checkpoints
    .map((checkpoint) => `${checkpoint.name}:${checkpoint.elapsedMs}`)
    .join(",");
}

function clearStartupMetrics() {
  startupMetrics = null;
}

function getVisibleWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  if (appWindow && !appWindow.isDestroyed()) {
    return appWindow;
  }

  return null;
}

function focusVisibleWindow() {
  const window = getVisibleWindow();
  if (!window || window.isDestroyed()) {
    return;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.focus();
}

function normalizeWindowMode(value) {
  return value === "windowed" ? "windowed" : "fullscreen";
}

function normalizeWindowedBounds(value) {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_WINDOW_BOUNDS };
  }

  const width = Number.isFinite(Number(value.width))
    ? Math.max(Math.round(Number(value.width)), WINDOW_MIN_WIDTH)
    : DEFAULT_WINDOW_BOUNDS.width;
  const height = Number.isFinite(Number(value.height))
    ? Math.max(Math.round(Number(value.height)), WINDOW_MIN_HEIGHT)
    : DEFAULT_WINDOW_BOUNDS.height;

  const bounds = { width, height };

  if (Number.isFinite(Number(value.x))) {
    bounds.x = Math.round(Number(value.x));
  }

  if (Number.isFinite(Number(value.y))) {
    bounds.y = Math.round(Number(value.y));
  }

  return bounds;
}

function normalizeDesktopPreferences(value) {
  return {
    windowMode: normalizeWindowMode(value?.windowMode),
    windowedBounds: normalizeWindowedBounds(value?.windowedBounds)
  };
}

function loadDesktopPreferences() {
  try {
    const raw = fs.readFileSync(DESKTOP_PREFERENCES_PATH, "utf8");
    return normalizeDesktopPreferences(JSON.parse(raw));
  } catch {
    return normalizeDesktopPreferences(null);
  }
}

function saveDesktopPreferences() {
  fs.mkdirSync(path.dirname(DESKTOP_PREFERENCES_PATH), { recursive: true });
  fs.writeFileSync(
    DESKTOP_PREFERENCES_PATH,
    JSON.stringify(desktopPreferences, null, 2),
    "utf8"
  );
}

function updateDesktopPreferences(partialPreferences = {}) {
  desktopPreferences = normalizeDesktopPreferences({
    ...desktopPreferences,
    ...partialPreferences
  });
  saveDesktopPreferences();
  return desktopPreferences;
}

function getWindowPreferencesPayload() {
  return {
    windowMode: desktopPreferences.windowMode
  };
}

function getWindowedBoundsForCreation() {
  return normalizeWindowedBounds(desktopPreferences.windowedBounds);
}

function getCurrentWindowedBounds(window) {
  return normalizeWindowedBounds(window.getBounds());
}

function persistWindowedBounds(window) {
  if (
    !window ||
    window.isDestroyed() ||
    window.isFullScreen() ||
    window.isMaximized() ||
    window.isMinimized()
  ) {
    return;
  }

  updateDesktopPreferences({
    windowedBounds: getCurrentWindowedBounds(window)
  });
}

async function exitFullScreen(window) {
  if (!window || window.isDestroyed() || !window.isFullScreen()) {
    return;
  }

  await new Promise((resolve) => {
    const handleLeave = () => {
      window.off("leave-full-screen", handleLeave);
      resolve();
    };

    window.once("leave-full-screen", handleLeave);
    window.setFullScreen(false);
  });
}

async function applyWindowMode(window, mode) {
  const normalizedMode = normalizeWindowMode(mode);

  if (!window || window.isDestroyed()) {
    return;
  }

  if (normalizedMode === "fullscreen") {
    persistWindowedBounds(window);
    window.setFullScreen(true);
    return;
  }

  await exitFullScreen(window);
  window.setBounds(getWindowedBoundsForCreation());
  persistWindowedBounds(window);
}

async function setMainWindowMode(mode) {
  const normalizedMode = normalizeWindowMode(mode);
  updateDesktopPreferences({ windowMode: normalizedMode });

  const targetWindow =
    (mainWindow && !mainWindow.isDestroyed() && mainWindow) ||
    (appWindow && !appWindow.isDestroyed() && appWindow) ||
    null;

  if (!targetWindow) {
    return getWindowPreferencesPayload();
  }

  await applyWindowMode(targetWindow, normalizedMode);
  focusVisibleWindow();
  return getWindowPreferencesPayload();
}

function createWindowOptions(preloadPath = null) {
  const windowedBounds = getWindowedBoundsForCreation();
  const webPreferences = {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true
  };

  if (preloadPath) {
    webPreferences.preload = preloadPath;
  }

  return {
    ...windowedBounds,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    title: "Karto",
    icon: APP_ICON_PATH,
    show: false,
    backgroundColor: "#0f1319",
    fullscreen: desktopPreferences.windowMode === "fullscreen",
    fullscreenable: true,
    webPreferences
  };
}

function attachWindowLifecycle(window) {
  window.setMenuBarVisibility(false);
  window.webContents.on("page-title-updated", (event) => {
    event.preventDefault();
    window.setTitle("Karto");
  });

  window.on("enter-full-screen", () => {
    updateDesktopPreferences({ windowMode: "fullscreen" });
  });

  window.on("leave-full-screen", () => {
    updateDesktopPreferences({ windowMode: "windowed" });
  });

  let persistBoundsTimer = null;
  const scheduleBoundsPersistence = () => {
    if (persistBoundsTimer !== null) {
      clearTimeout(persistBoundsTimer);
    }

    persistBoundsTimer = setTimeout(() => {
      persistBoundsTimer = null;
      persistWindowedBounds(window);
    }, 160);
  };

  window.on("move", scheduleBoundsPersistence);
  window.on("resize", scheduleBoundsPersistence);
  window.on("close", () => {
    if (persistBoundsTimer !== null) {
      clearTimeout(persistBoundsTimer);
      persistBoundsTimer = null;
    }

    persistWindowedBounds(window);
  });
}

function createAppWindow() {
  if (appWindow && !appWindow.isDestroyed()) {
    return appWindow;
  }

  const window = new BrowserWindow(createWindowOptions(path.join(APP_ROOT, "preload.js")));
  attachWindowLifecycle(window);

  window.on("show", () => {
    if (startupPhase === STARTUP_PHASES.VERIFIED) {
      return;
    }

    console.error("[karto][startup-invariant] reason=unexpected_app_window_show");

    if (!window.isDestroyed()) {
      window.hide();
    }

    void failStartup("Ошибка запуска", new Error("App window was shown before verification completed."));
  });

  window.webContents.on("render-process-gone", (_event, details) => {
    const reason = details?.reason || "unknown";
    const exitCode = typeof details?.exitCode === "number" ? `, код ${details.exitCode}` : "";
    const error = new Error(`Рендер-процесс завершился (${reason}${exitCode})`);

    if (startupPhase === STARTUP_PHASES.VERIFIED && mainWindow === window) {
      void showVerifiedWindowError("Ошибка окна приложения", error);
      return;
    }

    void failStartup("Ошибка окна приложения", error);
  });

  window.on("closed", () => {
    if (appWindow === window) {
      appWindow = null;
    }

    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  appWindow = window;
  return window;
}

async function renderErrorPageInWindow(window, title, error) {
  if (!window || window.isDestroyed()) {
    return false;
  }

  try {
    await window.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(createErrorHtml(title, formatErrorDetails(error)))}`);
    return true;
  } catch {
    return false;
  }
}

function logFinalStartupFailure(title, error) {
  console.error(
    `[karto][startup-failed] title="${escapeLogValue(title)}"` +
      ` checkpoints="${escapeLogValue(formatStartupCheckpointSummary())}"` +
      ` details="${escapeLogValue(makePreview(formatErrorDetails(error)))}"`
  );
}

async function failStartup(title, error) {
  if (startupFailurePromise) {
    return startupFailurePromise;
  }

  startupFailurePromise = (async () => {
    startupPhase = STARTUP_PHASES.FAILED;
    recordStartupCheckpoint("startup_failed");
    logFinalStartupFailure(title, error);

    const targetWindow =
      (appWindow && !appWindow.isDestroyed() && appWindow) ||
      (mainWindow && !mainWindow.isDestroyed() && mainWindow) ||
      null;

    if (targetWindow) {
      const rendered = await renderErrorPageInWindow(targetWindow, title, error);

      if (rendered) {
        if (!targetWindow.isVisible()) {
          targetWindow.show();
        }

        focusVisibleWindow();
        return targetWindow;
      }
    }

    dialog.showErrorBox(`Karto — ${title}`, formatErrorDetails(error));
    return targetWindow;
  })();

  try {
    return await startupFailurePromise;
  } finally {
    startupFailurePromise = null;
  }
}

async function showVerifiedWindowError(title, error) {
  const details = formatErrorDetails(error);
  console.error(`[karto] ${title}\n${details}`);

  if (mainWindow && !mainWindow.isDestroyed()) {
    const rendered = await renderErrorPageInWindow(mainWindow, title, error);

    if (rendered) {
      focusVisibleWindow();
      return mainWindow;
    }
  }

  dialog.showErrorBox(`Karto — ${title}`, details);
  return null;
}

function waitWithinDeadline(promise, deadlineAt) {
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) {
    return Promise.resolve({ timedOut: true });
  }

  let timerId = null;

  return Promise.race([
    Promise.resolve(promise)
      .then((value) => ({ value }))
      .catch((error) => ({ error })),
    new Promise((resolve) => {
      timerId = setTimeout(() => {
        timerId = null;
        resolve({ timedOut: true });
      }, remainingMs);
    })
  ]).finally(() => {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
  });
}

function createMainFrameAttemptWatcher(window, action, attemptLabel) {
  let cleanup = () => {};

  const promise = new Promise((resolve) => {
    let settled = false;

    const finish = (outcome) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(outcome);
    };

    const handleDidFrameFinishLoad = (_event, isMainFrame) => {
      if (!isMainFrame) {
        return;
      }

      recordStartupCheckpoint(`${attemptLabel}_did_finish_load`);
      finish({ kind: "loaded" });
    };

    const handleDidFailLoad = (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) {
        return;
      }

      finish({
        kind: "navigation_error",
        error: new Error(
          `Не удалось загрузить ${validatedURL || baseUrl || "главное окно"} (${errorCode}: ${errorDescription})`
        )
      });
    };

    cleanup = () => {
      window.webContents.removeListener("did-frame-finish-load", handleDidFrameFinishLoad);
      window.webContents.removeListener("did-fail-load", handleDidFailLoad);
    };

    window.webContents.on("did-frame-finish-load", handleDidFrameFinishLoad);
    window.webContents.on("did-fail-load", handleDidFailLoad);

    recordStartupCheckpoint(`${attemptLabel}_load_start`);

    try {
      const actionResult = action();
      if (actionResult && typeof actionResult.then === "function") {
        actionResult.catch((error) => {
          finish({
            kind: "navigation_error",
            error
          });
        });
      }
    } catch (error) {
      finish({
        kind: "navigation_error",
        error
      });
    }
  });

  return {
    cleanup,
    promise
  };
}

async function runVerificationAttempt(window, attemptNumber, action, url) {
  if (startupAttemptPromise) {
    throw new Error("Startup verification attempt is already running.");
  }

  const attemptLabel = `attempt${attemptNumber}`;
  const phase = attemptNumber === 1 ? STARTUP_PHASES.ATTEMPT1 : STARTUP_PHASES.ATTEMPT2;
  const currentAttemptToken = ++startupAttemptToken;
  startupPhase = phase;
  recordStartupCheckpoint(`${attemptLabel}_start`);

  startupAttemptPromise = (async () => {
    const startedAt = Date.now();
    const deadlineAt = startedAt + STARTUP_VERIFY_TIMEOUT_MS;
    const watcher = createMainFrameAttemptWatcher(window, action, attemptLabel);
    let evaluation;

    const navigationOutcome = await waitWithinDeadline(watcher.promise, deadlineAt);

    if (navigationOutcome.timedOut) {
      watcher.cleanup();
      evaluation = evaluateVerificationResult({ timeout: true });
    } else if (navigationOutcome.error) {
      watcher.cleanup();
      evaluation = evaluateVerificationResult({
        navigationError: formatErrorDetails(navigationOutcome.error)
      });
    } else if (navigationOutcome.value.kind === "navigation_error") {
      evaluation = evaluateVerificationResult({
        navigationError: formatErrorDetails(navigationOutcome.value.error)
      });
    } else {
      const rendererOutcome = await waitWithinDeadline(
        window.webContents.executeJavaScript(STARTUP_RENDERER_SCRIPT),
        deadlineAt
      );

      if (rendererOutcome.timedOut) {
        evaluation = evaluateVerificationResult({ timeout: true });
      } else if (rendererOutcome.error) {
        evaluation = evaluateVerificationResult({
          rendererError: formatErrorDetails(rendererOutcome.error)
        });
      } else {
        evaluation = evaluateVerificationResult(rendererOutcome.value);
      }
    }

    recordStartupCheckpoint(`${attemptLabel}_done`);

    if (!evaluation.ok && currentAttemptToken === startupAttemptToken) {
      const failedAttemptLog = formatFailedAttemptLog({
        attempt: attemptNumber,
        elapsedMs: Date.now() - startedAt,
        url,
        evaluation
      });
      const checkpointSummary = formatStartupCheckpointSummary();

      console.error(
        checkpointSummary
          ? `${failedAttemptLog} checkpoints="${escapeLogValue(checkpointSummary)}"`
          : failedAttemptLog
      );
    }

    return evaluation;
  })().finally(() => {
    startupAttemptPromise = null;
  });

  return startupAttemptPromise;
}

function createStartupVerificationError(evaluations, url) {
  const lines = [`Startup verification failed for ${url}.`];

  evaluations.forEach((evaluation, index) => {
    lines.push(
      `Attempt ${index + 1}: ${evaluation.reason || "unknown"} ` +
      `(shell=${evaluation.hasAppShell ? 1 : 0}, ` +
      `main=${evaluation.hasAppMain ? 1 : 0}, ` +
      `raw_bootstrap=${evaluation.hasRawBootstrapText ? 1 : 0}, ` +
      `preview="${evaluation.preview}")`
    );

    if (evaluation.navigationError) {
      lines.push(`navigation_error: ${evaluation.navigationError}`);
    }

    if (evaluation.rendererError) {
      lines.push(`renderer_error: ${evaluation.rendererError}`);
    }
  });

  return new Error(lines.join("\n"));
}

function revealVerifiedAppWindow(window) {
  if (
    startupPhase !== STARTUP_PHASES.VERIFIED ||
    !window ||
    window.isDestroyed() ||
    window !== appWindow
  ) {
    return;
  }

  if (!window.isVisible()) {
    window.show();
  }

  focusVisibleWindow();
}

async function completeStartupSuccess(window) {
  startupPhase = STARTUP_PHASES.VERIFIED;
  mainWindow = window;

  revealVerifiedAppWindow(window);
  return window;
}

async function ensureServerStarted() {
  if (baseUrl) {
    return baseUrl;
  }

  if (!server) {
    server = createServer({
      host: HOST,
      port: PORT,
      staticRoot: APP_ROOT
    });
  }

  try {
    baseUrl = await server.start();
    return baseUrl;
  } catch (error) {
    server = null;
    baseUrl = "";
    throw error;
  }
}

async function openMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    focusVisibleWindow();
    return mainWindow;
  }

  if (startupSequencePromise) {
    focusVisibleWindow();
    return startupSequencePromise;
  }

  if (appWindow && !appWindow.isDestroyed() && startupPhase === STARTUP_PHASES.FAILED) {
    focusVisibleWindow();
    return appWindow;
  }

  startupSequencePromise = (async () => {
    beginStartupMetrics();
    startupPhase = STARTUP_PHASES.LAUNCHING;

    const url = await ensureServerStarted();
    recordStartupCheckpoint("server_ready");

    await clearDesktopFrontendCaches();
    recordStartupCheckpoint("cache_cleared");

    const window = createAppWindow();
    recordStartupCheckpoint("app_window_created");

    const firstAttempt = await runVerificationAttempt(
      window,
      1,
      () => window.loadURL(url),
      url
    );

    if (firstAttempt.ok) {
      return completeStartupSuccess(window);
    }

    recordStartupCheckpoint("retry_start");

    const secondAttempt = await runVerificationAttempt(
      window,
      2,
      () => {
        window.webContents.reloadIgnoringCache();
      },
      url
    );

    if (secondAttempt.ok) {
      return completeStartupSuccess(window);
    }

    return failStartup(
      "Ошибка загрузки интерфейса",
      createStartupVerificationError([firstAttempt, secondAttempt], url)
    );
  })().catch((error) => {
    return failStartup("Ошибка запуска", error);
  }).finally(() => {
    startupSequencePromise = null;
    if (startupPhase !== STARTUP_PHASES.VERIFIED && startupPhase !== STARTUP_PHASES.FAILED) {
      startupPhase = STARTUP_PHASES.IDLE;
    }
    clearStartupMetrics();
  });

  return startupSequencePromise;
}

async function stopEmbeddedServer() {
  if (!server) {
    return;
  }

  const activeServer = server;
  server = null;
  baseUrl = "";

  await activeServer.stop();
}

registerSyncIpc("karto-data:get-bootstrap-settings-sync", () => {
  return getDataRepository().getBootstrapSettings();
});

registerSyncIpc("karto-data:load-app-data-sync", () => {
  return getDataRepository().loadAppData();
});

registerSyncIpc("karto-data:save-decks-snapshot-sync", (payload) => {
  return getDataRepository().saveDecksSnapshot(payload);
});

registerSyncIpc("karto-data:save-setting-sync", (key, value) => {
  return getDataRepository().saveSetting(key, value);
});

registerSyncIpc("karto-data:record-study-answer-sync", (cardId, result) => {
  return getDataRepository().recordStudyAnswer(cardId, result);
});

registerSyncIpc("karto-data:record-study-session-sync", (summary) => {
  return getDataRepository().recordStudySession(summary);
});

registerSyncIpc("karto-data:clear-all-data-sync", (options) => {
  return getDataRepository().clearAllData(options);
});

registerSyncIpc("karto-data:restore-app-state-snapshot-sync", (snapshot) => {
  return getDataRepository().restoreAppStateSnapshot(snapshot);
});

registerSyncIpc("karto-data:import-legacy-localstorage-sync", (payload) => {
  return getDataRepository().importLegacyLocalStorage(payload);
});

ipcMain.handle("karto-desktop:get-window-preferences", () => {
  return getWindowPreferencesPayload();
});

ipcMain.handle("karto-desktop:set-window-mode", (_event, mode) => {
  return setMainWindowMode(mode);
});

ipcMain.handle("karto-desktop:quit", () => {
  if (!isQuitting) {
    app.quit();
  }

  return { requested: true };
});

function shutdownApplication() {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shutdownPromise = stopEmbeddedServer()
    .finally(() => {
      closeDataRepository();
    })
    .catch((error) => {
      console.error("[karto] Failed to stop embedded server:", error);
    })
    .finally(() => {
      shutdownPromise = null;
    });

  return shutdownPromise;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (getVisibleWindow()) {
      focusVisibleWindow();
      return;
    }

    if (app.isReady()) {
      void openMainWindow();
    }
  });

  app.whenReady().then(() => {
    void openMainWindow();
  });

  app.on("activate", () => {
    if (getVisibleWindow()) {
      focusVisibleWindow();
      return;
    }

    if (BrowserWindow.getAllWindows().length === 0) {
      void openMainWindow();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform === "darwin") {
      return;
    }

    if (isQuitting) {
      return;
    }

    isQuitting = true;
    void shutdownApplication().finally(() => {
      app.quit();
    });
  });

  app.on("before-quit", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    isQuitting = true;

    void shutdownApplication().finally(() => {
      app.quit();
    });
  });
}
