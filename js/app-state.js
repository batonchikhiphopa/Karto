(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  const STORAGE_KEYS = {
    decks: "decks",
    language: "language",
    theme: "karto.theme",
    homeGridColumns: "karto.homeGridColumns",
    studyProgress: "karto.studyProgress",
    studySessions: "karto.studySessions"
  };
  const MAX_ROUND_HISTORY_SESSIONS_PER_DECK = 5;

  function debounce(fn, wait) {
    let timerId = null;

    function wrapped(...args) {
      if (timerId) {
        root.clearTimeout(timerId);
      }

      timerId = root.setTimeout(() => {
        timerId = null;
        fn(...args);
      }, wait);
    }

    wrapped.flush = (...args) => {
      if (timerId) {
        root.clearTimeout(timerId);
        timerId = null;
      }

      fn(...args);
    };

    return wrapped;
  }

  function safeParse(rawValue, fallback) {
    if (!rawValue) return fallback;

    try {
      return JSON.parse(rawValue);
    } catch {
      return fallback;
    }
  }

  function getStorage() {
    try {
      return root.localStorage || null;
    } catch {
      return null;
    }
  }

  function getDesktopPersistence() {
    return root.api && typeof root.api.loadAppDataSync === "function" ? root.api : null;
  }

  function normalizeThemePreference(value) {
    return ["system", "dark", "light"].includes(value) ? value : "system";
  }

  function normalizeHomeGridColumns(value) {
    return ["auto", "2", "3", "4"].includes(value) ? value : "auto";
  }

  function normalizeLanguagePreference(value) {
    if (typeof root.normalizeLanguage === "function") {
      return root.normalizeLanguage(value);
    }

    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim().toLowerCase().split(/[-_]/)[0];
    return ["ru", "en", "de"].includes(normalized) ? normalized : null;
  }

  function resolveLanguagePreference(value) {
    const normalized = normalizeLanguagePreference(value);
    if (normalized) {
      return normalized;
    }

    if (typeof root.resolveNavigatorLanguage === "function") {
      return root.resolveNavigatorLanguage(root.navigator);
    }

    if (typeof root.resolveInitialLanguage === "function") {
      return root.resolveInitialLanguage({
        storage: null,
        navigator: root.navigator
      });
    }

    return "en";
  }

  function normalizeStudyProgressEntry(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const seenCount = Number.isFinite(Number(entry.seenCount)) ? Math.max(0, Math.round(Number(entry.seenCount))) : 0;
    const correctCount = Number.isFinite(Number(entry.correctCount))
      ? Math.max(0, Math.round(Number(entry.correctCount)))
      : 0;

    return {
      seenCount,
      correctCount,
      lastResult: typeof entry.lastResult === "string" && entry.lastResult ? entry.lastResult : null,
      lastReviewedAt: typeof entry.lastReviewedAt === "string" && entry.lastReviewedAt ? entry.lastReviewedAt : null
    };
  }

  function normalizeLoadedStudyProgress(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return Object.entries(value).reduce((result, [cardId, entry]) => {
      if (typeof cardId !== "string" || !cardId.trim()) {
        return result;
      }

      const normalizedEntry = normalizeStudyProgressEntry(entry);
      if (!normalizedEntry) {
        return result;
      }

      result[cardId] = normalizedEntry;
      return result;
    }, {});
  }

  function normalizeCompletedRounds(value) {
    return Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : null;
  }

  function compareStudySessionsByFinishedAtDesc(left, right) {
    const leftTime = Date.parse(left.finishedAt) || 0;
    const rightTime = Date.parse(right.finishedAt) || 0;
    return rightTime - leftTime;
  }

  function normalizeLoadedStudySession(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const deckId = typeof entry.deckId === "string" ? entry.deckId.trim() : "";
    if (!deckId) {
      return null;
    }

    if (!Object.prototype.hasOwnProperty.call(entry, "completedRounds")) {
      return null;
    }

    const completedRounds = normalizeCompletedRounds(entry.completedRounds);
    if (completedRounds === null) {
      return null;
    }

    return {
      deckId,
      deckName: typeof entry.deckName === "string" && entry.deckName ? entry.deckName : "Deck",
      completedRounds,
      finishedAt: typeof entry.finishedAt === "string" && entry.finishedAt ? entry.finishedAt : new Date().toISOString()
    };
  }

  function limitStudySessionsPerDeck(sessions) {
    const countsByDeckId = new Map();

    return sessions
      .slice()
      .sort(compareStudySessionsByFinishedAtDesc)
      .filter((session) => {
        const count = countsByDeckId.get(session.deckId) || 0;
        if (count >= MAX_ROUND_HISTORY_SESSIONS_PER_DECK) {
          return false;
        }

        countsByDeckId.set(session.deckId, count + 1);
        return true;
      });
  }

  function normalizeLoadedStudySessions(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return limitStudySessionsPerDeck(
      value
        .map(normalizeLoadedStudySession)
        .filter(Boolean)
    );
  }

  function getCompletedRoundsForDeck(sessions, deckId) {
    if (typeof deckId !== "string" || !deckId.trim()) {
      return 0;
    }

    return normalizeLoadedStudySessions(sessions)
      .filter((session) => session.deckId === deckId)
      .reduce((sum, session) => sum + session.completedRounds, 0);
  }

  function createAppState() {
    const storage = getStorage();
    const desktopPersistence = getDesktopPersistence();

    const state = {
      decks: [],
      currentScreenId: "homeScreen",
      editingDeckId: null,
      addOtherTargetDeckId: null,
      selectedCardIds: [],
      cardForm: {
        returnScreen: "libraryScreen",
        editDeckId: null,
        editCardId: null,
        imageSide: "back",
        imageTargetSide: "back"
      },
      studyMode: "all",
      study: root.createStudyState({ cards: [] }),
      studyProgress: {},
      studySessions: [],
      languagePreference: resolveLanguagePreference(null),
      themePreference: normalizeThemePreference(storage?.getItem?.(STORAGE_KEYS.theme)),
      homeGridColumns: normalizeHomeGridColumns(storage?.getItem?.(STORAGE_KEYS.homeGridColumns)),
      openMoveCardId: null,
      pendingMoveDeckId: ""
    };

    function applyTheme() {
      const documentElement = root.document?.documentElement;
      if (!documentElement) {
        return;
      }

      documentElement.dataset.theme = state.themePreference;
    }

    function createLegacyPayload() {
      return {
        decks: root.normalizeStoredDecks(safeParse(storage?.getItem?.(STORAGE_KEYS.decks), null)),
        languagePreference: normalizeLanguagePreference(storage?.getItem?.(STORAGE_KEYS.language)),
        themePreference: normalizeThemePreference(storage?.getItem?.(STORAGE_KEYS.theme)),
        homeGridColumns: normalizeHomeGridColumns(storage?.getItem?.(STORAGE_KEYS.homeGridColumns)),
        studyProgress: normalizeLoadedStudyProgress(safeParse(storage?.getItem?.(STORAGE_KEYS.studyProgress), {})),
        studySessions: normalizeLoadedStudySessions(safeParse(storage?.getItem?.(STORAGE_KEYS.studySessions), []))
      };
    }

    function clearLegacyStorage() {
      if (!storage) {
        return;
      }

      Object.values(STORAGE_KEYS).forEach((key) => {
        storage.removeItem?.(key);
      });
    }

    function loadFromDesktopPersistence() {
      const migrationResult = desktopPersistence.importLegacyLocalStorageSync(createLegacyPayload());

      if (migrationResult?.clearLegacyStorage) {
        clearLegacyStorage();
      }

      return migrationResult?.appData || desktopPersistence.loadAppDataSync();
    }

    function loadFromBrowserStorage() {
      return {
        decks: root.normalizeStoredDecks(safeParse(storage?.getItem?.(STORAGE_KEYS.decks), null)),
        languagePreference: resolveLanguagePreference(
          storage?.getItem?.(STORAGE_KEYS.language) ||
          root.resolveInitialLanguage?.({
            storage,
            navigator: root.navigator
          })
        ),
        themePreference: normalizeThemePreference(storage?.getItem?.(STORAGE_KEYS.theme)),
        homeGridColumns: normalizeHomeGridColumns(storage?.getItem?.(STORAGE_KEYS.homeGridColumns)),
        studyProgress: normalizeLoadedStudyProgress(safeParse(storage?.getItem?.(STORAGE_KEYS.studyProgress), {})),
        studySessions: normalizeLoadedStudySessions(safeParse(storage?.getItem?.(STORAGE_KEYS.studySessions), []))
      };
    }

    function saveDecksNow() {
      if (desktopPersistence) {
        desktopPersistence.saveDecksSnapshotSync(root.createStoragePayload(state.decks));
        return;
      }

      storage?.setItem?.(STORAGE_KEYS.decks, JSON.stringify(root.createStoragePayload(state.decks)));
    }

    const saveDecksSoon = debounce(saveDecksNow, 120);

    function persistStudyProgress() {
      if (desktopPersistence) {
        desktopPersistence.restoreAppStateSnapshotSync(createSnapshot());
        return;
      }

      storage?.setItem?.(STORAGE_KEYS.studyProgress, JSON.stringify(state.studyProgress));
    }

    function persistStudySessions() {
      if (desktopPersistence) {
        desktopPersistence.restoreAppStateSnapshotSync(createSnapshot());
        return;
      }

      storage?.setItem?.(STORAGE_KEYS.studySessions, JSON.stringify(state.studySessions));
    }

    function load() {
      const payload = desktopPersistence
        ? loadFromDesktopPersistence()
        : loadFromBrowserStorage();

      state.decks = root.normalizeStoredDecks(payload.decks);
      state.languagePreference = resolveLanguagePreference(payload.languagePreference);
      state.themePreference = normalizeThemePreference(payload.themePreference);
      state.homeGridColumns = normalizeHomeGridColumns(payload.homeGridColumns);
      state.studyProgress = normalizeLoadedStudyProgress(payload.studyProgress);
      state.studySessions = normalizeLoadedStudySessions(payload.studySessions);

      if (!desktopPersistence) {
        saveDecksNow();
        storage?.setItem?.(STORAGE_KEYS.studySessions, JSON.stringify(state.studySessions));
      }

      applyTheme();
    }

    function setThemePreference(value) {
      state.themePreference = normalizeThemePreference(value);

      if (desktopPersistence) {
        desktopPersistence.saveSettingSync("theme", state.themePreference);
      } else {
        storage?.setItem?.(STORAGE_KEYS.theme, state.themePreference);
      }

      applyTheme();
    }

    function setHomeGridColumns(value) {
      state.homeGridColumns = normalizeHomeGridColumns(value);

      if (desktopPersistence) {
        desktopPersistence.saveSettingSync("homeGridColumns", state.homeGridColumns);
      } else {
        storage?.setItem?.(STORAGE_KEYS.homeGridColumns, state.homeGridColumns);
      }
    }

    function setLanguagePreference(value) {
      state.languagePreference = resolveLanguagePreference(value);

      if (desktopPersistence) {
        desktopPersistence.saveSettingSync("language", state.languagePreference);
      } else {
        storage?.setItem?.(STORAGE_KEYS.language, state.languagePreference);
      }

      return state.languagePreference;
    }

    function recordStudyAnswer(cardId, result) {
      const existing = state.studyProgress[cardId] || {
        seenCount: 0,
        correctCount: 0,
        lastResult: null,
        lastReviewedAt: null
      };

      state.studyProgress[cardId] = {
        seenCount: existing.seenCount + 1,
        correctCount: existing.correctCount + (result === "correct" ? 1 : 0),
        lastResult: result,
        lastReviewedAt: new Date().toISOString()
      };

      if (desktopPersistence) {
        desktopPersistence.recordStudyAnswerSync(cardId, result);
        return;
      }

      storage?.setItem?.(STORAGE_KEYS.studyProgress, JSON.stringify(state.studyProgress));
    }

    function recordStudySession(summary) {
      state.studySessions = normalizeLoadedStudySessions([summary].concat(state.studySessions));

      if (desktopPersistence) {
        state.studySessions = normalizeLoadedStudySessions(
          desktopPersistence.recordStudySessionSync(summary)
        );
        return;
      }

      storage?.setItem?.(STORAGE_KEYS.studySessions, JSON.stringify(state.studySessions));
    }

    function createSnapshot() {
      return {
        decks: root.createStoragePayload(state.decks),
        studyProgress: JSON.parse(JSON.stringify(state.studyProgress)),
        studySessions: JSON.parse(JSON.stringify(state.studySessions)),
        themePreference: state.themePreference,
        homeGridColumns: state.homeGridColumns,
        languagePreference: state.languagePreference
      };
    }

    function restoreSnapshot(snapshot) {
      const nextSnapshot = {
        decks: snapshot.decks,
        studyProgress: snapshot.studyProgress || {},
        studySessions: Array.isArray(snapshot.studySessions) ? snapshot.studySessions : [],
        themePreference: snapshot.themePreference || "system",
        homeGridColumns: snapshot.homeGridColumns || "auto",
        languagePreference: snapshot.languagePreference || snapshot.language || resolveLanguagePreference(null)
      };

      if (desktopPersistence) {
        const restoredData = desktopPersistence.restoreAppStateSnapshotSync(nextSnapshot);
        state.decks = root.normalizeStoredDecks(restoredData.decks);
        state.studyProgress = normalizeLoadedStudyProgress(restoredData.studyProgress);
        state.studySessions = normalizeLoadedStudySessions(restoredData.studySessions);
        state.themePreference = normalizeThemePreference(restoredData.themePreference);
        state.homeGridColumns = normalizeHomeGridColumns(restoredData.homeGridColumns);
        state.languagePreference = resolveLanguagePreference(restoredData.languagePreference);
      } else {
        state.decks = root.normalizeStoredDecks(nextSnapshot.decks);
        saveDecksNow();

        state.studyProgress = nextSnapshot.studyProgress || {};
        storage?.setItem?.(STORAGE_KEYS.studyProgress, JSON.stringify(state.studyProgress));

        state.studySessions = normalizeLoadedStudySessions(nextSnapshot.studySessions);
        storage?.setItem?.(STORAGE_KEYS.studySessions, JSON.stringify(state.studySessions));

        setThemePreference(nextSnapshot.themePreference);
        setHomeGridColumns(nextSnapshot.homeGridColumns);
        setLanguagePreference(nextSnapshot.languagePreference);
      }

      applyTheme();
      root.setLanguage(state.languagePreference, {
        persist: false,
        refresh: false
      });
    }

    function clearAllData(options = {}) {
      const includeLanguage = options.includeLanguage !== false;
      const nextLanguage = includeLanguage ? resolveLanguagePreference(null) : state.languagePreference;

      if (desktopPersistence) {
        const clearedData = desktopPersistence.clearAllDataSync({ includeLanguage });
        state.decks = root.normalizeStoredDecks(clearedData.decks);
        state.studyProgress = normalizeLoadedStudyProgress(clearedData.studyProgress);
        state.studySessions = normalizeLoadedStudySessions(clearedData.studySessions);
        state.themePreference = normalizeThemePreference(clearedData.themePreference);
        state.homeGridColumns = normalizeHomeGridColumns(clearedData.homeGridColumns);
        state.languagePreference = includeLanguage
          ? resolveLanguagePreference(clearedData.languagePreference)
          : nextLanguage;

        if (!includeLanguage) {
          desktopPersistence.saveSettingSync("language", state.languagePreference);
        }
      } else {
        storage?.removeItem?.(STORAGE_KEYS.decks);
        storage?.removeItem?.(STORAGE_KEYS.studyProgress);
        storage?.removeItem?.(STORAGE_KEYS.studySessions);
        storage?.removeItem?.(STORAGE_KEYS.theme);
        storage?.removeItem?.(STORAGE_KEYS.homeGridColumns);

        if (includeLanguage) {
          storage?.removeItem?.(STORAGE_KEYS.language);
        }

        state.languagePreference = nextLanguage;

        if (!includeLanguage) {
          storage?.setItem?.(STORAGE_KEYS.language, state.languagePreference);
        }
      }

      state.decks = [];
      state.editingDeckId = null;
      state.addOtherTargetDeckId = null;
      state.selectedCardIds = [];
      state.cardForm.editDeckId = null;
      state.cardForm.editCardId = null;
      state.cardForm.imageSide = "back";
      state.cardForm.imageTargetSide = "back";
      state.studyMode = "all";
      state.study = root.createStudyState({ cards: [] });
      state.studyProgress = {};
      state.studySessions = [];
      state.themePreference = "system";
      state.homeGridColumns = "auto";

      applyTheme();
    }

    root.addEventListener("beforeunload", () => {
      saveDecksSoon.flush();
    });

    return {
      STORAGE_KEYS,
      state,
      load,
      saveDecksNow,
      saveDecksSoon,
      persistStudyProgress,
      persistStudySessions,
      getCompletedRoundsForDeck: (deckId) => getCompletedRoundsForDeck(state.studySessions, deckId),
      setThemePreference,
      setHomeGridColumns,
      setLanguagePreference,
      recordStudyAnswer,
      recordStudySession,
      createSnapshot,
      restoreSnapshot,
      clearAllData
    };
  }

  Karto.createAppState = createAppState;
  Karto.STORAGE_KEYS = STORAGE_KEYS;
  Karto.MAX_ROUND_HISTORY_SESSIONS_PER_DECK = MAX_ROUND_HISTORY_SESSIONS_PER_DECK;
  Karto.getCompletedRoundsForDeck = getCompletedRoundsForDeck;
  Karto.normalizeLoadedStudySessions = normalizeLoadedStudySessions;
  Karto.normalizeHomeGridColumns = normalizeHomeGridColumns;
})(typeof window !== "undefined" ? window : globalThis);
