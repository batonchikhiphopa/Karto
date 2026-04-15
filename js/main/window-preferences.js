"use strict";

function createWindowPreferenceStore({
  fs,
  path,
  preferencesPath,
  minWidth,
  minHeight,
  defaultBounds
}) {
  function normalizeWindowMode(value) {
    return value === "windowed" ? "windowed" : "fullscreen";
  }

  function normalizeWindowedBounds(value) {
    if (!value || typeof value !== "object") {
      return { ...defaultBounds };
    }

    const width = Number.isFinite(Number(value.width))
      ? Math.max(Math.round(Number(value.width)), minWidth)
      : defaultBounds.width;
    const height = Number.isFinite(Number(value.height))
      ? Math.max(Math.round(Number(value.height)), minHeight)
      : defaultBounds.height;

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
      const raw = fs.readFileSync(preferencesPath, "utf8");
      return normalizeDesktopPreferences(JSON.parse(raw));
    } catch {
      return normalizeDesktopPreferences(null);
    }
  }

  let desktopPreferences = loadDesktopPreferences();

  function saveDesktopPreferences() {
    fs.mkdirSync(path.dirname(preferencesPath), { recursive: true });
    fs.writeFileSync(
      preferencesPath,
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

  function getWindowMode() {
    return desktopPreferences.windowMode;
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

  return {
    applyWindowMode,
    getWindowMode,
    getWindowPreferencesPayload,
    getWindowedBoundsForCreation,
    normalizeWindowMode,
    persistWindowedBounds,
    updateDesktopPreferences
  };
}

module.exports = {
  createWindowPreferenceStore
};
