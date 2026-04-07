(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  const STORAGE_KEYS = {
    decks: "decks",
    language: "language",
    theme: "karto.theme",
    studyProgress: "karto.studyProgress",
    studySessions: "karto.studySessions"
  };

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

  function normalizeThemePreference(value) {
    return ["system", "dark", "light"].includes(value) ? value : "system";
  }

  function createAppState() {
    const storage = root.localStorage;

    const state = {
      decks: [],
      currentScreenId: "homeScreen",
      createDeckReturn: "homeScreen",
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
      themePreference: normalizeThemePreference(storage.getItem(STORAGE_KEYS.theme)),
      dragCardId: null
    };

    function saveDecksNow() {
      storage.setItem(STORAGE_KEYS.decks, JSON.stringify(root.createStoragePayload(state.decks)));
    }

    const saveDecksSoon = debounce(saveDecksNow, 120);

    function persistStudyProgress() {
      storage.setItem(STORAGE_KEYS.studyProgress, JSON.stringify(state.studyProgress));
    }

    function persistStudySessions() {
      storage.setItem(STORAGE_KEYS.studySessions, JSON.stringify(state.studySessions));
    }

    function applyTheme() {
      root.document.documentElement.dataset.theme = state.themePreference;
    }

    function load() {
      const rawPayload = safeParse(storage.getItem(STORAGE_KEYS.decks), null);
      state.decks = root.normalizeStoredDecks(rawPayload);
      saveDecksNow();

      state.studyProgress = safeParse(storage.getItem(STORAGE_KEYS.studyProgress), {});
      state.studySessions = safeParse(storage.getItem(STORAGE_KEYS.studySessions), [])
        .filter((entry) => entry && typeof entry === "object");

      applyTheme();
    }

    function setThemePreference(value) {
      state.themePreference = normalizeThemePreference(value);
      storage.setItem(STORAGE_KEYS.theme, state.themePreference);
      applyTheme();
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

      persistStudyProgress();
    }

    function recordStudySession(summary) {
      state.studySessions = [summary].concat(state.studySessions).slice(0, 20);
      persistStudySessions();
    }

    function createSnapshot() {
      return {
        decks: root.createStoragePayload(state.decks),
        studyProgress: JSON.parse(JSON.stringify(state.studyProgress)),
        studySessions: JSON.parse(JSON.stringify(state.studySessions)),
        themePreference: state.themePreference,
        language: root.getCurrentLanguage()
      };
    }

    function restoreSnapshot(snapshot) {
      state.decks = root.normalizeStoredDecks(snapshot.decks);
      saveDecksNow();

      state.studyProgress = snapshot.studyProgress || {};
      persistStudyProgress();

      state.studySessions = Array.isArray(snapshot.studySessions) ? snapshot.studySessions : [];
      persistStudySessions();

      setThemePreference(snapshot.themePreference || "system");
      root.setLanguage(snapshot.language || root.resolveInitialLanguage(), {
        persist: true,
        refresh: false
      });
    }

    function clearAllData(options = {}) {
      const includeLanguage = options.includeLanguage !== false;

      storage.removeItem(STORAGE_KEYS.decks);
      storage.removeItem(STORAGE_KEYS.studyProgress);
      storage.removeItem(STORAGE_KEYS.studySessions);
      storage.removeItem(STORAGE_KEYS.theme);

      if (includeLanguage) {
        storage.removeItem(STORAGE_KEYS.language);
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
      setThemePreference,
      recordStudyAnswer,
      recordStudySession,
      createSnapshot,
      restoreSnapshot,
      clearAllData
    };
  }

  Karto.createAppState = createAppState;
  Karto.STORAGE_KEYS = STORAGE_KEYS;
})(window);
