"use strict";

function createDataRepositoryManager({ createRepository, dbPath }) {
  let dataRepository = null;

  function getDataRepository() {
    if (!dataRepository) {
      dataRepository = createRepository({ dbPath });
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

  return {
    getDataRepository,
    closeDataRepository
  };
}

function registerSyncIpc(ipcMain, channel, handler, formatErrorDetails) {
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

function registerDataIpcHandlers({ ipcMain, getDataRepository, formatErrorDetails }) {
  const register = (channel, handler) => {
    registerSyncIpc(ipcMain, channel, handler, formatErrorDetails);
  };
  const registerAsync = (channel, handler) => {
    ipcMain.handle(channel, (_event, ...args) => {
      return handler(...args);
    });
  };

  register("karto-data:get-bootstrap-settings-sync", () => {
    return getDataRepository().getBootstrapSettings();
  });

  register("karto-data:load-app-data-sync", () => {
    return getDataRepository().loadAppData();
  });

  registerAsync("karto-data:load-app-shell-data", () => {
    return getDataRepository().loadAppShellData();
  });

  registerAsync("karto-data:load-deck-cards", (deckId, options) => {
    return getDataRepository().loadDeckCards(deckId, options);
  });

  registerAsync("karto-data:load-card-media", (cardIds) => {
    return getDataRepository().loadCardMedia(cardIds);
  });

  register("karto-data:save-decks-snapshot-sync", (payload) => {
    return getDataRepository().saveDecksSnapshot(payload);
  });

  register("karto-data:save-setting-sync", (key, value) => {
    return getDataRepository().saveSetting(key, value);
  });

  register("karto-data:record-study-answer-sync", (cardId, result) => {
    return getDataRepository().recordStudyAnswer(cardId, result);
  });

  register("karto-data:record-study-session-sync", (summary) => {
    return getDataRepository().recordStudySession(summary);
  });

  register("karto-data:clear-all-data-sync", (options) => {
    return getDataRepository().clearAllData(options);
  });

  register("karto-data:restore-app-state-snapshot-sync", (snapshot) => {
    return getDataRepository().restoreAppStateSnapshot(snapshot);
  });
}

module.exports = {
  createDataRepositoryManager,
  registerDataIpcHandlers,
  registerSyncIpc
};
