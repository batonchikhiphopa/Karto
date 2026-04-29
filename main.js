"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, dialog, ipcMain, nativeImage, session, shell } = require("electron");

const { createServer } = require("./server");
const {
  createDataRepositoryManager,
  registerDataIpcHandlers
} = require("./js/main/data-bridge");
const { configureAppSecurity } = require("./js/main/security");
const { createWindowPreferenceStore } = require("./js/main/window-preferences");
const {
  createErrorHtml,
  escapeLogValue,
  formatErrorDetails
} = require("./js/main/error-page");
const { createDesktopFrontendCacheCleaner } = require("./js/main/frontend-cache");
const { createStartupMetricsTracker } = require("./js/main/startup-metrics");
const { createStartupRuntime } = require("./js/main/startup-runtime");
const { createSqliteRepository } = require("./js/sqlite-repository");
const {
  STARTUP_VERIFY_TIMEOUT_MS,
  buildRendererVerificationScript,
  evaluateVerificationResult,
  formatFailedAttemptLog,
  makePreview
} = require("./js/startup-verification");

if (process.env.KARTO_USER_DATA_DIR) {
  app.setPath("userData", path.resolve(process.env.KARTO_USER_DATA_DIR));
}

const APP_ROOT = app.getAppPath();
const APP_ICON_PATH = path.join(APP_ROOT, "logo.svg");
const HOST = "127.0.0.1";
const PORT = 3000;
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
const STARTUP_RENDERER_POLL_INTERVAL_MS = 100;

let server = null;
let baseUrl = "";
let mainWindow = null;
let appWindow = null;
let isQuitting = false;
let shutdownPromise = null;
let startupPhase = STARTUP_PHASES.IDLE;
let startupSequencePromise = null;
let startupAttemptPromise = null;
let startupAttemptToken = 0;
let startupFailurePromise = null;
const dataRepositoryManager = createDataRepositoryManager({
  createRepository: (options) => createSqliteRepository({ ...options, nativeImage }),
  dbPath: DESKTOP_DATABASE_PATH
});
const { getDataRepository, closeDataRepository } = dataRepositoryManager;
const windowPreferences = createWindowPreferenceStore({
  fs,
  path,
  preferencesPath: DESKTOP_PREFERENCES_PATH,
  minWidth: WINDOW_MIN_WIDTH,
  minHeight: WINDOW_MIN_HEIGHT,
  defaultBounds: DEFAULT_WINDOW_BOUNDS
});

configureAppSecurity({
  app,
  session,
  shell,
  getAppBaseUrl: () => baseUrl
});

const clearDesktopFrontendCaches = createDesktopFrontendCacheCleaner(session);
const {
  beginStartupMetrics,
  clearStartupMetrics,
  formatStartupCheckpointSummary,
  recordStartupCheckpoint
} = createStartupMetricsTracker();
const {
  createStartupVerificationError,
  getActiveWebContents,
  runVerificationAttempt,
  stopPendingNavigation
} = createStartupRuntime({
  STARTUP_RENDERER_POLL_INTERVAL_MS,
  STARTUP_RENDERER_SCRIPT,
  STARTUP_VERIFY_TIMEOUT_MS,
  evaluateVerificationResult,
  formatFailedAttemptLog,
  makePreview,
  recordStartupCheckpoint
});

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

async function setMainWindowMode(mode) {
  const normalizedMode = windowPreferences.normalizeWindowMode(mode);
  windowPreferences.updateDesktopPreferences({ windowMode: normalizedMode });

  const targetWindow =
    (mainWindow && !mainWindow.isDestroyed() && mainWindow) ||
    (appWindow && !appWindow.isDestroyed() && appWindow) ||
    null;

  if (!targetWindow) {
    return windowPreferences.getWindowPreferencesPayload();
  }

  await windowPreferences.applyWindowMode(targetWindow, normalizedMode);
  focusVisibleWindow();
  return windowPreferences.getWindowPreferencesPayload();
}

function createWindowOptions(preloadPath = null) {
  const windowedBounds = windowPreferences.getWindowedBoundsForCreation();
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
    fullscreen: windowPreferences.getWindowMode() === "fullscreen",
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
    windowPreferences.updateDesktopPreferences({ windowMode: "fullscreen" });
  });

  window.on("leave-full-screen", () => {
    windowPreferences.updateDesktopPreferences({ windowMode: "windowed" });
  });

  let persistBoundsTimer = null;
  const scheduleBoundsPersistence = () => {
    if (persistBoundsTimer !== null) {
      clearTimeout(persistBoundsTimer);
    }

    persistBoundsTimer = setTimeout(() => {
      persistBoundsTimer = null;
      windowPreferences.persistWindowedBounds(window);
    }, 160);
  };

  window.on("move", scheduleBoundsPersistence);
  window.on("resize", scheduleBoundsPersistence);
  window.on("close", () => {
    if (persistBoundsTimer !== null) {
      clearTimeout(persistBoundsTimer);
      persistBoundsTimer = null;
    }

    windowPreferences.persistWindowedBounds(window);
  });
}

function createAppWindow() {
  if (appWindow && !appWindow.isDestroyed()) {
    return appWindow;
  }

  const window = new BrowserWindow(createWindowOptions(path.join(APP_ROOT, "preload.js")));
  attachWindowLifecycle(window);

  window.on("show", () => {
    if (startupPhase === STARTUP_PHASES.VERIFIED || startupPhase === STARTUP_PHASES.FAILED) {
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
      staticRoot: APP_ROOT,
      fallbackToAvailablePort: true
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

    await clearDesktopFrontendCaches(url);
    recordStartupCheckpoint("cache_cleared");

    let window = createAppWindow();
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

    discardStartupWindow(window);
    window = createAppWindow();
    recordStartupCheckpoint("retry_window_created");

    const secondAttempt = await runVerificationAttempt(
      window,
      2,
      () => window.loadURL(url),
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

registerDataIpcHandlers({
  ipcMain,
  getDataRepository,
  formatErrorDetails
});

ipcMain.handle("karto-desktop:get-window-preferences", () => {
  return windowPreferences.getWindowPreferencesPayload();
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
