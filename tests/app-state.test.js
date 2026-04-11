const assert = require("node:assert/strict");

function createMemoryStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

function withMockedAppStateRuntime(options, run) {
  const previousValues = new Map();
  const keys = [
    "Karto",
    "api",
    "localStorage",
    "createStudyState",
    "createStoragePayload",
    "normalizeStoredDecks",
    "getCurrentLanguage",
    "setLanguage",
    "resolveInitialLanguage",
    "resolveNavigatorLanguage",
    "normalizeLanguage",
    "navigator",
    "addEventListener",
    "clearTimeout",
    "setTimeout"
  ];

  keys.forEach((key) => {
    previousValues.set(key, globalThis[key]);
  });

  globalThis.Karto = {};
  globalThis.api = options.api || null;
  globalThis.localStorage = createMemoryStorage(options.storageValues || {});
  globalThis.createStudyState = () => ({ cards: [] });
  globalThis.createStoragePayload = (value) => ({ decks: value });
  globalThis.normalizeStoredDecks = (value) => {
    if (Array.isArray(value)) {
      return value;
    }

    return Array.isArray(value?.decks) ? value.decks : [];
  };
  globalThis.getCurrentLanguage = () => "ru";
  globalThis.setLanguage = () => {};
  globalThis.resolveInitialLanguage = () => "ru";
  globalThis.resolveNavigatorLanguage = () => "en";
  globalThis.normalizeLanguage = (value) => {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim().toLowerCase().split(/[-_]/)[0];
    return ["ru", "en", "de"].includes(normalized) ? normalized : null;
  };
  globalThis.navigator = { language: "en" };
  globalThis.addEventListener = () => {};
  globalThis.clearTimeout = clearTimeout;
  globalThis.setTimeout = setTimeout;

  const modulePath = require.resolve("../js/app-state.js");
  delete require.cache[modulePath];
  require(modulePath);

  try {
    run({
      createAppState: globalThis.Karto.createAppState,
      STORAGE_KEYS: globalThis.Karto.STORAGE_KEYS,
      storage: globalThis.localStorage
    });
  } finally {
    keys.forEach((key) => {
      if (previousValues.get(key) === undefined) {
        delete globalThis[key];
        return;
      }

      globalThis[key] = previousValues.get(key);
    });
  }
}

function testBrowserHomeGridColumnsPersistToStorage() {
  withMockedAppStateRuntime({ storageValues: {} }, ({ createAppState, STORAGE_KEYS, storage }) => {
    const store = createAppState();

    store.setHomeGridColumns("3");
    assert.equal(store.state.homeGridColumns, "3");
    assert.equal(storage.getItem(STORAGE_KEYS.homeGridColumns), "3");

    store.setHomeGridColumns("banana");
    assert.equal(store.state.homeGridColumns, "auto");
    assert.equal(storage.getItem(STORAGE_KEYS.homeGridColumns), "auto");
  });
}

function testRoundHistoryDropsLegacyEntriesAndLimitsPerDeck() {
  const studySessions = [
    {
      deckId: "deck_a",
      deckName: "A",
      mode: "all",
      reviewed: 12,
      correct: 10,
      wrong: 2,
      unsure: 0,
      percentCorrect: 83,
      finishedAt: "2026-04-01T12:00:00.000Z"
    },
    ...Array.from({ length: 6 }, (_, index) => ({
      deckId: "deck_a",
      deckName: "A",
      completedRounds: index + 1,
      finishedAt: `2026-04-0${index + 1}T12:00:00.000Z`
    })),
    {
      deckId: "deck_b",
      deckName: "B",
      completedRounds: 7,
      finishedAt: "2026-04-02T12:00:00.000Z"
    }
  ];

  withMockedAppStateRuntime({
    storageValues: {
      "karto.studySessions": JSON.stringify(studySessions)
    }
  }, ({ createAppState, STORAGE_KEYS, storage }) => {
    const store = createAppState();
    store.load();

    assert.equal(store.state.studySessions.filter((session) => session.deckId === "deck_a").length, 5);
    assert.equal(store.getCompletedRoundsForDeck("deck_a"), 20);
    assert.equal(store.getCompletedRoundsForDeck("deck_b"), 7);
    assert.equal(JSON.parse(storage.getItem(STORAGE_KEYS.studySessions)).length, 6);

    store.recordStudySession({
      deckId: "deck_a",
      deckName: "A",
      completedRounds: 8,
      finishedAt: "2026-04-07T12:00:00.000Z"
    });

    assert.equal(store.state.studySessions.filter((session) => session.deckId === "deck_a").length, 5);
    assert.equal(store.getCompletedRoundsForDeck("deck_a"), 26);
  });
}

function testDesktopLoadMigratesLegacyStorageAndClearsBrowserKeys() {
  const captured = {
    migrationPayload: null
  };

  const api = {
    importLegacyLocalStorageSync(payload) {
      captured.migrationPayload = payload;
      return {
        clearLegacyStorage: true,
        appData: {
          decks: [{ id: "deck_db", name: "DB Deck", cards: [] }],
          languagePreference: "de",
          themePreference: "dark",
          homeGridColumns: "4",
          studyProgress: {},
          studySessions: []
        }
      };
    },
    loadAppDataSync() {
      throw new Error("loadAppDataSync should not be called when migration returned appData");
    },
    saveDecksSnapshotSync() {},
    saveSettingSync() {},
    recordStudyAnswerSync() {},
    recordStudySessionSync() {
      return [];
    },
    clearAllDataSync() {
      return {
        decks: [],
        languagePreference: "en",
        themePreference: "system",
        homeGridColumns: "auto",
        studyProgress: {},
        studySessions: []
      };
    },
    restoreAppStateSnapshotSync(snapshot) {
      return snapshot;
    }
  };

  withMockedAppStateRuntime({
    api,
    storageValues: {
      decks: JSON.stringify([{ id: "deck_ls", name: "Legacy", cards: [] }]),
      language: "ru",
      "karto.theme": "dark",
      "karto.homeGridColumns": "3",
      "karto.studyProgress": JSON.stringify({}),
      "karto.studySessions": JSON.stringify([])
    }
  }, ({ createAppState, STORAGE_KEYS, storage }) => {
    const store = createAppState();
    store.load();

    assert.deepEqual(captured.migrationPayload.decks, [{ id: "deck_ls", name: "Legacy", cards: [] }]);
    assert.equal(store.state.languagePreference, "de");
    assert.equal(store.state.themePreference, "dark");
    assert.equal(store.state.homeGridColumns, "4");
    assert.deepEqual(store.state.decks, [{ id: "deck_db", name: "DB Deck", cards: [] }]);
    assert.equal(storage.getItem(STORAGE_KEYS.decks), null);
    assert.equal(storage.getItem(STORAGE_KEYS.language), null);
    assert.equal(storage.getItem(STORAGE_KEYS.theme), null);
  });
}

function testDesktopPersistenceDelegatesSnapshotAndLanguageSaves() {
  const captured = {
    snapshot: null,
    settings: []
  };

  const api = {
    importLegacyLocalStorageSync() {
      return {
        clearLegacyStorage: false,
        appData: {
          decks: [{ id: "deck_1", name: "Deck 1", cards: [] }],
          languagePreference: "ru",
          themePreference: "system",
          homeGridColumns: "auto",
          studyProgress: {},
          studySessions: []
        }
      };
    },
    loadAppDataSync() {
      return {
        decks: [],
        languagePreference: "ru",
        themePreference: "system",
        homeGridColumns: "auto",
        studyProgress: {},
        studySessions: []
      };
    },
    saveDecksSnapshotSync(payload) {
      captured.snapshot = payload;
    },
    saveSettingSync(key, value) {
      captured.settings.push([key, value]);
    },
    recordStudyAnswerSync() {},
    recordStudySessionSync() {
      return [];
    },
    clearAllDataSync() {
      return {
        decks: [],
        languagePreference: "en",
        themePreference: "system",
        homeGridColumns: "auto",
        studyProgress: {},
        studySessions: []
      };
    },
    restoreAppStateSnapshotSync(snapshot) {
      return {
        decks: snapshot.decks,
        languagePreference: snapshot.languagePreference,
        themePreference: snapshot.themePreference,
        homeGridColumns: snapshot.homeGridColumns,
        studyProgress: snapshot.studyProgress,
        studySessions: snapshot.studySessions
      };
    }
  };

  withMockedAppStateRuntime({ api }, ({ createAppState }) => {
    const store = createAppState();
    store.load();

    store.state.decks.push({ id: "deck_2", name: "Deck 2", cards: [] });
    store.saveDecksNow();
    store.setLanguagePreference("de");

    assert.deepEqual(captured.snapshot, {
      decks: [
        { id: "deck_1", name: "Deck 1", cards: [] },
        { id: "deck_2", name: "Deck 2", cards: [] }
      ]
    });
    assert.deepEqual(captured.settings, [["language", "de"]]);
  });
}

testBrowserHomeGridColumnsPersistToStorage();
testRoundHistoryDropsLegacyEntriesAndLimitsPerDeck();
testDesktopLoadMigratesLegacyStorageAndClearsBrowserKeys();
testDesktopPersistenceDelegatesSnapshotAndLanguageSaves();

console.log("app-state tests passed");
