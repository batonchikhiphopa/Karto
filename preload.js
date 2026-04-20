"use strict";

const { contextBridge, ipcRenderer } = require("electron");

function callSync(channel, ...args) {
  const result = ipcRenderer.sendSync(channel, ...args);

  if (result && result.ok) {
    return result.value;
  }

  throw new Error(result?.error || `IPC sync call failed for ${channel}`);
}

contextBridge.exposeInMainWorld("kartoDesktop", {
  isDesktop: true,
  isE2E: process.env.KARTO_E2E === "1",
  startupPrewarmDelayMs: process.env.KARTO_E2E_STARTUP_PREWARM_DELAY_MS || "",
  getWindowPreferences() {
    return ipcRenderer.invoke("karto-desktop:get-window-preferences");
  },
  setWindowMode(mode) {
    return ipcRenderer.invoke("karto-desktop:set-window-mode", mode);
  },
  quit() {
    return ipcRenderer.invoke("karto-desktop:quit");
  }
});

contextBridge.exposeInMainWorld("api", {
  getBootstrapSettingsSync() {
    return callSync("karto-data:get-bootstrap-settings-sync");
  },
  loadAppDataSync() {
    return callSync("karto-data:load-app-data-sync");
  },
  loadAppData() {
    return ipcRenderer.invoke("karto-data:load-app-data");
  },
  loadAppShellData() {
    return ipcRenderer.invoke("karto-data:load-app-shell-data");
  },
  loadDeckCards(deckId, options) {
    return ipcRenderer.invoke("karto-data:load-deck-cards", deckId, options);
  },
  loadCardMedia(cardIds) {
    return ipcRenderer.invoke("karto-data:load-card-media", cardIds);
  },
  saveDecksSnapshotSync(payload) {
    return callSync("karto-data:save-decks-snapshot-sync", payload);
  },
  saveSettingSync(key, value) {
    return callSync("karto-data:save-setting-sync", key, value);
  },
  recordStudyAnswerSync(cardId, result) {
    return callSync("karto-data:record-study-answer-sync", cardId, result);
  },
  recordStudySessionSync(summary) {
    return callSync("karto-data:record-study-session-sync", summary);
  },
  clearAllDataSync(options) {
    return callSync("karto-data:clear-all-data-sync", options);
  },
  restoreAppStateSnapshotSync(snapshot) {
    return callSync("karto-data:restore-app-state-snapshot-sync", snapshot);
  }
});
