const assert = require("node:assert/strict");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createAppData(overrides = {}) {
  return {
    decks: [],
    languagePreference: "en",
    themePreference: "system",
    homeGridColumns: "auto",
    autoGermanArticle: true,
    homeMediaCache: {},
    studyProgress: {},
    studySessions: [],
    ...clone(overrides)
  };
}

function createDesktopApi(initialData = {}) {
  let appData = createAppData(initialData);
  const calls = {
    answers: [],
    savedDecks: [],
    sessions: [],
    settings: [],
    snapshots: []
  };

  const api = {
    loadAppDataSync() {
      return clone(appData);
    },
    loadAppShellData() {
      return Promise.resolve(clone(appData));
    },
    loadDeckCards(deckId) {
      return clone(appData.decks.find((deck) => deck.id === deckId) || null);
    },
    loadCardMedia(cardIds) {
      const requestedIds = new Set(Array.isArray(cardIds) ? cardIds : []);
      return Promise.resolve(
        appData.decks
          .flatMap((deck) => deck.cards || [])
          .filter((card) => requestedIds.has(card.id))
          .map(clone)
      );
    },
    saveDecksSnapshotSync(payload) {
      calls.savedDecks.push(clone(payload));
      appData.decks = globalThis.normalizeStoredDecks(payload);
      return clone(appData.decks);
    },
    saveSettingSync(key, value) {
      calls.settings.push([key, value]);
      if (key === "language") appData.languagePreference = value;
      if (key === "theme") appData.themePreference = value;
      if (key === "homeGridColumns") appData.homeGridColumns = value;
      if (key === "autoGermanArticle") appData.autoGermanArticle = value !== false;
      if (key === "homeMediaCache") appData.homeMediaCache = JSON.parse(value);
      return value;
    },
    recordStudyAnswerSync(cardId, result) {
      calls.answers.push([cardId, result]);
    },
    recordStudySessionSync(summary) {
      calls.sessions.push(clone(summary));
      appData.studySessions = [summary].concat(appData.studySessions);
      return clone(appData.studySessions);
    },
    clearAllDataSync(options = {}) {
      const preservedLanguage = options.includeLanguage === false ? appData.languagePreference : "en";
      appData = createAppData({
        languagePreference: preservedLanguage
      });
      return clone(appData);
    },
    restoreAppStateSnapshotSync(snapshot) {
      calls.snapshots.push(clone(snapshot));
      appData = createAppData({
        decks: globalThis.normalizeStoredDecks(snapshot.decks),
        languagePreference: snapshot.languagePreference || snapshot.language || appData.languagePreference,
        themePreference: snapshot.themePreference,
        homeGridColumns: snapshot.homeGridColumns,
        autoGermanArticle: snapshot.autoGermanArticle,
        homeMediaCache: snapshot.homeMediaCache || {},
        studyProgress: snapshot.studyProgress || {},
        studySessions: snapshot.studySessions || []
      });
      return clone(appData);
    }
  };

  return { api, calls };
}

function withMockedAppStateRuntime(options, run) {
  const previousValues = new Map();
  const keys = [
    "Karto",
    "api",
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

  const desktop = options.api
    ? { api: options.api, calls: options.calls || {} }
    : createDesktopApi(options.appData || {});

  globalThis.Karto = {};
  globalThis.api = desktop.api;
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
      calls: desktop.calls,
      createAppState: globalThis.Karto.createAppState
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

function testCreateAppStateRequiresDesktopPersistence() {
  const previousApi = globalThis.api;
  const previousKarto = globalThis.Karto;
  const previousCreateStudyState = globalThis.createStudyState;
  const previousAddEventListener = globalThis.addEventListener;

  globalThis.api = null;
  globalThis.Karto = {};
  globalThis.createStudyState = () => ({ cards: [] });
  globalThis.addEventListener = () => {};

  const modulePath = require.resolve("../js/app-state.js");
  delete require.cache[modulePath];
  require(modulePath);

  assert.throws(
    () => globalThis.Karto.createAppState(),
    /desktop persistence is unavailable/
  );

  if (previousApi === undefined) delete globalThis.api;
  else globalThis.api = previousApi;
  if (previousKarto === undefined) delete globalThis.Karto;
  else globalThis.Karto = previousKarto;
  if (previousCreateStudyState === undefined) delete globalThis.createStudyState;
  else globalThis.createStudyState = previousCreateStudyState;
  if (previousAddEventListener === undefined) delete globalThis.addEventListener;
  else globalThis.addEventListener = previousAddEventListener;
}

function testDesktopHomeGridColumnsPersistToSettings() {
  withMockedAppStateRuntime({}, ({ createAppState, calls }) => {
    const store = createAppState();

    store.setHomeGridColumns("3");
    assert.equal(store.state.homeGridColumns, "3");

    store.setHomeGridColumns("banana");
    assert.equal(store.state.homeGridColumns, "auto");
    assert.deepEqual(calls.settings, [
      ["homeGridColumns", "3"],
      ["homeGridColumns", "auto"]
    ]);
  });
}

function testRoundHistoryDropsOldEntriesAndLimitsPerDeck() {
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
    appData: { studySessions }
  }, ({ createAppState }) => {
    const store = createAppState();
    store.load();

    assert.equal(store.state.studySessions.filter((session) => session.deckId === "deck_a").length, 5);
    assert.equal(store.getCompletedRoundsForDeck("deck_a"), 20);
    assert.equal(store.getCompletedRoundsForDeck("deck_b"), 7);

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

function testStudyProgressEntryCanBeRestoredAndDeleted() {
  withMockedAppStateRuntime({}, ({ createAppState, calls }) => {
    const store = createAppState();

    store.recordStudyAnswer("card_1", "correct");
    const previousEntry = store.getStudyProgressEntry("card_1");
    assert.equal(previousEntry.seenCount, 1);
    assert.equal(previousEntry.correctCount, 1);
    assert.equal(previousEntry.lastResult, "correct");
    assert.deepEqual(calls.answers, [["card_1", "correct"]]);

    store.recordStudyAnswer("card_1", "wrong");
    assert.equal(store.getStudyProgressEntry("card_1").seenCount, 2);
    assert.equal(store.getStudyProgressEntry("card_1").lastResult, "wrong");

    store.restoreStudyProgressEntry("card_1", previousEntry);
    assert.deepEqual(store.getStudyProgressEntry("card_1"), previousEntry);

    store.restoreStudyProgressEntry("card_1", null);
    assert.equal(store.getStudyProgressEntry("card_1"), null);
    assert.equal(
      Object.hasOwn(calls.snapshots.at(-1).studyProgress, "card_1"),
      false
    );
  });
}

function testHomeMediaCachePersistsLoadsAndPrunes() {
  const cachedAt = "2026-04-15T10:00:00.000Z";

  withMockedAppStateRuntime({
    appData: {
      homeMediaCache: {
        deck_a: {
          signature: "sig-a",
          images: ["https://example.com/a.jpg", "https://example.com/a.jpg", ""],
          updatedAt: cachedAt
        },
        deck_bad: {
          signature: "",
          images: ["https://example.com/bad.jpg"]
        }
      }
    }
  }, ({ createAppState, calls }) => {
    const store = createAppState();
    store.load();

    assert.deepEqual(store.getHomeMediaCacheEntry("deck_a"), {
      signature: "sig-a",
      images: ["https://example.com/a.jpg"],
      updatedAt: cachedAt
    });
    assert.equal(store.getHomeMediaCacheEntry("deck_bad"), null);

    store.setHomeMediaCacheEntry("deck_b", {
      signature: "sig-b",
      images: ["https://example.com/b.jpg"],
      updatedAt: "2026-04-15T11:00:00.000Z"
    });
    assert.equal(calls.settings.at(-1)[0], "homeMediaCache");
    assert.equal(JSON.parse(calls.settings.at(-1)[1]).deck_b.signature, "sig-b");

    store.pruneHomeMediaCache(new Set(["deck_b"]));
    const prunedCache = JSON.parse(calls.settings.at(-1)[1]);
    assert.equal(Object.hasOwn(prunedCache, "deck_a"), false);
    assert.equal(prunedCache.deck_b.images[0], "https://example.com/b.jpg");

    store.deleteHomeMediaCacheEntry("deck_b");
    assert.equal(Object.keys(JSON.parse(calls.settings.at(-1)[1])).length, 0);
  });
}

function testDesktopLoadReadsRepositoryDataDirectly() {
  withMockedAppStateRuntime({
    appData: {
      decks: [{ id: "deck_db", name: "DB Deck", cards: [] }],
      languagePreference: "de",
      themePreference: "dark",
      homeGridColumns: "4"
    }
  }, ({ createAppState }) => {
    const store = createAppState();
    store.load();

    assert.equal(store.state.languagePreference, "de");
    assert.equal(store.state.themePreference, "dark");
    assert.equal(store.state.homeGridColumns, "4");
    assert.deepEqual(store.state.decks, [{ id: "deck_db", name: "DB Deck", cards: [] }]);
  });
}

function testDesktopPersistenceDelegatesSnapshotAndLanguageSaves() {
  withMockedAppStateRuntime({
    appData: {
      decks: [{ id: "deck_1", name: "Deck 1", cards: [] }],
      languagePreference: "ru"
    }
  }, ({ createAppState, calls }) => {
    const store = createAppState();
    store.load();

    store.state.decks.push({ id: "deck_2", name: "Deck 2", cards: [] });
    store.saveDecksNow();
    store.setLanguagePreference("de");

    assert.deepEqual(calls.savedDecks[0], {
      decks: [
        { id: "deck_1", name: "Deck 1", cards: [] },
        { id: "deck_2", name: "Deck 2", cards: [] }
      ]
    });
    assert.deepEqual(calls.settings.at(-1), ["language", "de"]);
  });
}

testCreateAppStateRequiresDesktopPersistence();
testDesktopHomeGridColumnsPersistToSettings();
testRoundHistoryDropsOldEntriesAndLimitsPerDeck();
testStudyProgressEntryCanBeRestoredAndDeleted();
testHomeMediaCachePersistsLoadsAndPrunes();
testDesktopLoadReadsRepositoryDataDirectly();
testDesktopPersistenceDelegatesSnapshotAndLanguageSaves();

console.log("app-state tests passed");
