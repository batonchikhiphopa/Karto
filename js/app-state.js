(function(root) {
  const Karto = root.Karto || (root.Karto = {});

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

  function getDesktopPersistence() {
    if (root.api && typeof root.api.loadAppDataSync === "function") {
      return root.api;
    }

    throw new Error("Karto desktop persistence is unavailable.");
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

  function normalizeHomeMediaCacheEntry(entry) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return null;
    }

    const signature = typeof entry.signature === "string" ? entry.signature.trim() : "";
    if (!signature) {
      return null;
    }

    const seenImages = new Set();
    const images = (Array.isArray(entry.images) ? entry.images : [])
      .map((image) => (typeof image === "string" ? image.trim() : ""))
      .filter((image) => {
        if (!image || seenImages.has(image)) {
          return false;
        }

        seenImages.add(image);
        return true;
      });

    return {
      signature,
      images,
      updatedAt: typeof entry.updatedAt === "string" && entry.updatedAt
        ? entry.updatedAt
        : new Date().toISOString()
    };
  }

  function normalizeHomeMediaCache(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return Object.entries(value).reduce((result, [deckId, entry]) => {
      if (typeof deckId !== "string" || !deckId.trim()) {
        return result;
      }

      const normalizedEntry = normalizeHomeMediaCacheEntry(entry);
      if (!normalizedEntry) {
        return result;
      }

      result[deckId] = normalizedEntry;
      return result;
    }, {});
  }

  function getCompletedRoundsForDeck(sessions, deckId) {
    if (typeof deckId !== "string" || !deckId.trim()) {
      return 0;
    }

    return normalizeLoadedStudySessions(sessions)
      .filter((session) => session.deckId === deckId)
      .reduce((sum, session) => sum + session.completedRounds, 0);
  }

  function getDeckCardCount(deck) {
    if (typeof root.getDeckCardCount === "function") {
      return root.getDeckCardCount(deck);
    }

    return Array.isArray(deck?.cards) ? deck.cards.length : 0;
  }

  function createAppState() {
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
        imageTargetSide: "back",
        imageThumb: "",
        imageStudy: ""
      },
      studyMode: "all",
      study: root.createStudyState({ cards: [] }),
      studyProgress: {},
      studySessions: [],
      homeMediaCache: {},
      languagePreference: resolveLanguagePreference(null),
      themePreference: "system",
      homeGridColumns: "auto",
      autoGermanArticle: true,
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

    function loadFromDesktopPersistence() {
      return desktopPersistence.loadAppDataSync();
    }

    async function loadShellFromDesktopPersistence() {
      if (typeof desktopPersistence.loadAppShellData === "function") {
        return desktopPersistence.loadAppShellData();
      }

      return desktopPersistence.loadAppDataSync();
    }

    function saveDecksNow() {
      const persistedDecks = desktopPersistence.saveDecksSnapshotSync(root.createStoragePayload(state.decks));
      const normalizedDecks = root.normalizeStoredDecks(persistedDecks);
      if (normalizedDecks.length > 0 || state.decks.length === 0) {
        state.decks = normalizedDecks;
      }
    }

    const saveDecksSoon = debounce(saveDecksNow, 120);

    function persistStudyProgress() {
      desktopPersistence.restoreAppStateSnapshotSync(createSnapshot());
    }

    function persistStudySessions() {
      desktopPersistence.restoreAppStateSnapshotSync(createSnapshot());
    }

    function applyLoadedPayload(payload) {
      state.decks = root.normalizeStoredDecks(payload.decks);
      state.languagePreference = resolveLanguagePreference(payload.languagePreference);
      state.themePreference = normalizeThemePreference(payload.themePreference);
      state.homeGridColumns = normalizeHomeGridColumns(payload.homeGridColumns);
      state.autoGermanArticle = payload.autoGermanArticle !== false;
      state.homeMediaCache = normalizeHomeMediaCache(payload.homeMediaCache);
      state.studyProgress = normalizeLoadedStudyProgress(payload.studyProgress);
      state.studySessions = normalizeLoadedStudySessions(payload.studySessions);

      applyTheme();
    }

    function load() {
      const payload = loadFromDesktopPersistence();
      applyLoadedPayload(payload);
    }

    async function loadShell() {
      const payload = await loadShellFromDesktopPersistence();
      applyLoadedPayload(payload);
    }

    function setThemePreference(value) {
      state.themePreference = normalizeThemePreference(value);
      desktopPersistence.saveSettingSync("theme", state.themePreference);
      applyTheme();
    }

    function setHomeGridColumns(value) {
      state.homeGridColumns = normalizeHomeGridColumns(value);
      desktopPersistence.saveSettingSync("homeGridColumns", state.homeGridColumns);
    }

    function setAutoGermanArticle(value) {
      state.autoGermanArticle = value !== false;
      desktopPersistence.saveSettingSync("autoGermanArticle", state.autoGermanArticle);
    }

    function setLanguagePreference(value) {
      state.languagePreference = resolveLanguagePreference(value);
      desktopPersistence.saveSettingSync("language", state.languagePreference);
      return state.languagePreference;
    }

    function persistHomeMediaCache() {
      desktopPersistence.saveSettingSync("homeMediaCache", JSON.stringify(state.homeMediaCache));
    }

    function getHomeMediaCacheEntry(deckId) {
      if (typeof deckId !== "string" || !deckId.trim()) {
        return null;
      }

      const entry = normalizeHomeMediaCacheEntry(state.homeMediaCache[deckId]);
      return entry
        ? {
          signature: entry.signature,
          images: entry.images.slice(),
          updatedAt: entry.updatedAt
        }
        : null;
    }

    function setHomeMediaCacheEntry(deckId, entry) {
      if (typeof deckId !== "string" || !deckId.trim()) {
        return;
      }

      const normalizedEntry = normalizeHomeMediaCacheEntry(entry);
      if (normalizedEntry) {
        state.homeMediaCache[deckId] = normalizedEntry;
      } else {
        delete state.homeMediaCache[deckId];
      }

      persistHomeMediaCache();
    }

    function deleteHomeMediaCacheEntry(deckId) {
      if (typeof deckId !== "string" || !deckId.trim() || !Object.hasOwn(state.homeMediaCache, deckId)) {
        return;
      }

      delete state.homeMediaCache[deckId];
      persistHomeMediaCache();
    }

    function pruneHomeMediaCache(validDeckIds) {
      const validIds = validDeckIds instanceof Set
        ? validDeckIds
        : new Set(Array.isArray(validDeckIds) ? validDeckIds : []);
      let didChange = false;

      Object.keys(state.homeMediaCache).forEach((deckId) => {
        if (!validIds.has(deckId)) {
          delete state.homeMediaCache[deckId];
          didChange = true;
        }
      });

      if (didChange) {
        persistHomeMediaCache();
      }
    }

    function findDeckIndex(deckId) {
      return state.decks.findIndex((deck) => deck.id === deckId);
    }

    function mergeLoadedDeck(deckPayload) {
      const normalizedDeck = root.normalizeDeck?.(deckPayload);
      if (!normalizedDeck) {
        return null;
      }

      const deckIndex = findDeckIndex(normalizedDeck.id);
      if (deckIndex === -1) {
        state.decks.push(normalizedDeck);
        return normalizedDeck;
      }

      const existingDeck = state.decks[deckIndex];
      const existingCardsById = new Map((existingDeck.cards || []).map((card) => [card.id, card]));
      const mergedCards = normalizedDeck.cards.map((card) => ({
        ...existingCardsById.get(card.id),
        ...card
      }));

      state.decks[deckIndex] = {
        ...existingDeck,
        ...normalizedDeck,
        cards: mergedCards,
        cardCount: Math.max(normalizedDeck.cardCount, mergedCards.length),
        cardsHydrated: normalizedDeck.cardsHydrated === true
      };

      return state.decks[deckIndex];
    }

    async function ensureDeckHydrated(deckId, options = {}) {
      const deck = state.decks.find((item) => item.id === deckId) || null;
      if (!deck) {
        return null;
      }

      const includeMedia = options.includeMedia === true;
      if (deck.cardsHydrated === true && (!includeMedia || deck.cards.every((card) => card.mediaLoaded !== false))) {
        return deck;
      }

      if (typeof desktopPersistence.loadDeckCards !== "function") {
        deck.cardsHydrated = true;
        deck.cardCount = getDeckCardCount(deck);
        return deck;
      }

      const loadedDeck = await desktopPersistence.loadDeckCards(deckId, { includeMedia });
      return mergeLoadedDeck(loadedDeck);
    }

    async function ensureAllDecksHydrated(options = {}) {
      const deckIds = state.decks.map((deck) => deck.id);
      for (const deckId of deckIds) {
        await ensureDeckHydrated(deckId, options);
      }

      return state.decks;
    }

    function mergeLoadedCardMedia(cards) {
      const normalizedCards = (Array.isArray(cards) ? cards : [])
        .map((card) => root.normalizeCard?.(card))
        .filter(Boolean);

      if (normalizedCards.length === 0) {
        return [];
      }

      const cardsById = new Map(normalizedCards.map((card) => [card.id, card]));
      state.decks.forEach((deck) => {
        deck.cards = (deck.cards || []).map((card) => {
          const mediaCard = cardsById.get(card.id);
          return mediaCard
            ? {
              ...card,
              image: mediaCard.image,
              imageThumb: mediaCard.imageThumb || card.imageThumb || "",
              imageStudy: mediaCard.imageStudy || card.imageStudy || "",
              imageSide: mediaCard.imageSide,
              hasImage: mediaCard.hasImage,
              mediaLoaded: true
            }
            : card;
        });
      });

      return normalizedCards;
    }

    async function loadCardMedia(cardIds) {
      const normalizedIds = Array.isArray(cardIds)
        ? cardIds
          .map((cardId) => (typeof cardId === "string" ? cardId.trim() : ""))
          .filter(Boolean)
        : [];

      if (normalizedIds.length === 0) {
        return [];
      }

      if (typeof desktopPersistence.loadCardMedia !== "function") {
        return [];
      }

      return mergeLoadedCardMedia(await desktopPersistence.loadCardMedia(Array.from(new Set(normalizedIds))));
    }

    function getStudyProgressEntry(cardId) {
      if (typeof cardId !== "string" || !cardId.trim()) {
        return null;
      }

      const entry = normalizeStudyProgressEntry(state.studyProgress[cardId]);
      return entry ? { ...entry } : null;
    }

    function restoreStudyProgressEntry(cardId, entry) {
      if (typeof cardId !== "string" || !cardId.trim()) {
        return;
      }

      const normalizedEntry = normalizeStudyProgressEntry(entry);
      if (normalizedEntry) {
        state.studyProgress[cardId] = normalizedEntry;
      } else {
        delete state.studyProgress[cardId];
      }

      persistStudyProgress();
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

      desktopPersistence.recordStudyAnswerSync(cardId, result);
    }

    function recordStudySession(summary) {
      state.studySessions = normalizeLoadedStudySessions([summary].concat(state.studySessions));
      state.studySessions = normalizeLoadedStudySessions(
        desktopPersistence.recordStudySessionSync(summary)
      );
    }

    function createSnapshot() {
      return {
        decks: root.createStoragePayload(state.decks),
        studyProgress: JSON.parse(JSON.stringify(state.studyProgress)),
        studySessions: JSON.parse(JSON.stringify(state.studySessions)),
        homeMediaCache: JSON.parse(JSON.stringify(state.homeMediaCache)),
        themePreference: state.themePreference,
        homeGridColumns: state.homeGridColumns,
        autoGermanArticle: state.autoGermanArticle,
        languagePreference: state.languagePreference
      };
    }

    function restoreSnapshot(snapshot) {
      const nextSnapshot = {
        decks: snapshot.decks,
        studyProgress: snapshot.studyProgress || {},
        studySessions: Array.isArray(snapshot.studySessions) ? snapshot.studySessions : [],
        homeMediaCache: normalizeHomeMediaCache(snapshot.homeMediaCache),
        themePreference: snapshot.themePreference || "system",
        homeGridColumns: snapshot.homeGridColumns || "auto",
        autoGermanArticle: snapshot.autoGermanArticle !== false,
        languagePreference: snapshot.languagePreference || snapshot.language || resolveLanguagePreference(null)
      };

      const restoredData = desktopPersistence.restoreAppStateSnapshotSync(nextSnapshot);
      state.decks = root.normalizeStoredDecks(restoredData.decks);
      state.studyProgress = normalizeLoadedStudyProgress(restoredData.studyProgress);
      state.studySessions = normalizeLoadedStudySessions(restoredData.studySessions);
      state.homeMediaCache = normalizeHomeMediaCache(restoredData.homeMediaCache);
      state.themePreference = normalizeThemePreference(restoredData.themePreference);
      state.homeGridColumns = normalizeHomeGridColumns(restoredData.homeGridColumns);
      state.autoGermanArticle = restoredData.autoGermanArticle !== false;
      state.languagePreference = resolveLanguagePreference(restoredData.languagePreference);

      applyTheme();
      root.setLanguage(state.languagePreference, {
        persist: false,
        refresh: false
      });
    }

    function clearAllData(options = {}) {
      const includeLanguage = options.includeLanguage !== false;
      const nextLanguage = includeLanguage ? resolveLanguagePreference(null) : state.languagePreference;

      const clearedData = desktopPersistence.clearAllDataSync({ includeLanguage });
      state.decks = root.normalizeStoredDecks(clearedData.decks);
      state.studyProgress = normalizeLoadedStudyProgress(clearedData.studyProgress);
      state.studySessions = normalizeLoadedStudySessions(clearedData.studySessions);
      state.homeMediaCache = normalizeHomeMediaCache(clearedData.homeMediaCache);
      state.themePreference = normalizeThemePreference(clearedData.themePreference);
      state.homeGridColumns = normalizeHomeGridColumns(clearedData.homeGridColumns);
      state.languagePreference = includeLanguage
        ? resolveLanguagePreference(clearedData.languagePreference)
        : nextLanguage;

      if (!includeLanguage) {
        desktopPersistence.saveSettingSync("language", state.languagePreference);
      }

      state.decks = [];
      state.editingDeckId = null;
      state.addOtherTargetDeckId = null;
      state.selectedCardIds = [];
      state.cardForm.editDeckId = null;
      state.cardForm.editCardId = null;
      state.cardForm.imageSide = "back";
      state.cardForm.imageTargetSide = "back";
      state.cardForm.imageThumb = "";
      state.cardForm.imageStudy = "";
      state.studyMode = "all";
      state.study = root.createStudyState({ cards: [] });
      state.studyProgress = {};
      state.studySessions = [];
      state.homeMediaCache = {};
      state.themePreference = "system";
      state.homeGridColumns = "auto";
      state.autoGermanArticle = true;

      applyTheme();
    }

    root.addEventListener("beforeunload", () => {
      saveDecksSoon.flush();
    });

    return {
      state,
      load,
      loadShell,
      saveDecksNow,
      saveDecksSoon,
      persistStudyProgress,
      persistStudySessions,
      getCompletedRoundsForDeck: (deckId) => getCompletedRoundsForDeck(state.studySessions, deckId),
      setThemePreference,
      setHomeGridColumns,
      setAutoGermanArticle,
      setLanguagePreference,
      getHomeMediaCacheEntry,
      setHomeMediaCacheEntry,
      deleteHomeMediaCacheEntry,
      pruneHomeMediaCache,
      ensureDeckHydrated,
      ensureAllDecksHydrated,
      loadCardMedia,
      getStudyProgressEntry,
      restoreStudyProgressEntry,
      recordStudyAnswer,
      recordStudySession,
      createSnapshot,
      restoreSnapshot,
      clearAllData
    };
  }

  Karto.createAppState = createAppState;
  Karto.MAX_ROUND_HISTORY_SESSIONS_PER_DECK = MAX_ROUND_HISTORY_SESSIONS_PER_DECK;
  Karto.getCompletedRoundsForDeck = getCompletedRoundsForDeck;
  Karto.normalizeLoadedStudySessions = normalizeLoadedStudySessions;
  Karto.normalizeHomeMediaCache = normalizeHomeMediaCache;
  Karto.normalizeHomeGridColumns = normalizeHomeGridColumns;
})(typeof window !== "undefined" ? window : globalThis);
