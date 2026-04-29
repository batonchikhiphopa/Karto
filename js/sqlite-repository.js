"use strict";

const fs = require("node:fs");
const path = require("node:path");

const Database = require("better-sqlite3");

const {
  createCard: createCardModel,
  createDeck: createDeckModel,
  normalizeExtraSides,
  normalizeStoredDecks
} = require("./data-model");
const {
  shuffleCards
} = require("./study-engine");
const { initializeSchema } = require("./sqlite-repository/schema");
const { createStatements } = require("./sqlite-repository/statements");

const {
  APP_SHELL_LAST_DECK_CARD_LIMIT,
  APP_SHELL_OTHER_DECK_CARD_LIMIT,
  DEFAULT_HOME_GRID_COLUMNS,
  DEFAULT_LANGUAGE,
  DEFAULT_THEME_PREFERENCE,
  MAX_STUDY_SESSIONS_PER_DECK,
  SETTINGS_KEYS,
  createRepositoryError,
  mapCardRow,
  mergeCardWithExistingMedia,
  mergePartialDeckCards,
  normalizeHomeGridColumns,
  normalizeHomeMediaCache,
  normalizeLanguage,
  normalizePersistedCardMedia,
  normalizeStudySession,
  normalizeStudyProgress,
  normalizeStudyProgressEntry,
  normalizeStudySessions,
  normalizeThemePreference
} = require("./sqlite-repository/helpers");

function createSqliteRepository(options = {}) {
  const dbPath = options.dbPath;
  const DatabaseCtor = options.DatabaseCtor || Database;
  const randomFn = typeof options.randomFn === "function" ? options.randomFn : Math.random;

  if (typeof dbPath !== "string" || !dbPath.trim()) {
    throw createRepositoryError("Database path is required.");
  }

  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseCtor(dbPath);
  initializeSchema(db);

  const statements = createStatements(db, {
    maxStudySessionsPerDeck: MAX_STUDY_SESSIONS_PER_DECK
  });

  function getNow() {
    return new Date().toISOString();
  }

  function getSetting(key) {
    const row = statements.getSetting.get(key);
    return row ? row.value : null;
  }

  function setSetting(key, value) {
    const now = getNow();
    statements.setSetting.run(key, String(value), now);
    return String(value);
  }

  function getBootstrapSettings() {
    return {
      languagePreference: normalizeLanguage(getSetting(SETTINGS_KEYS.language)),
      themePreference: normalizeThemePreference(getSetting(SETTINGS_KEYS.theme))
    };
  }

  function getCardsByDeck(deckId) {
    return statements.getCardsByDeck.all(deckId).map((row) => mapCardRow(row, { includeFullImage: true }));
  }

  function getDecks() {
    return statements.getDeckRows.all().map((row) => ({
      id: row.id,
      name: row.name,
      cardCount: row.cardCount,
      cardsHydrated: true,
      cards: getCardsByDeck(row.id)
    }));
  }

  function getShellFocusDeckId(deckRows) {
    const deckIds = new Set(deckRows.map((deck) => deck.id));
    const lastStudiedDeckId = statements.getLastStudiedDeck.get()?.deckId || "";
    if (deckIds.has(lastStudiedDeckId)) {
      return lastStudiedDeckId;
    }

    return statements.getFirstNonEmptyDeck.get()?.deckId || "";
  }

  function loadDeckCards(deckId, options = {}) {
    const deck = statements.getDeckById.get(deckId);
    if (!deck) {
      return null;
    }

    const cardRows = statements.getCardsByDeck.all(deckId);
    const limit = Number.isFinite(Number(options.limit))
      ? Math.max(0, Math.round(Number(options.limit)))
      : null;
    const limitedRows = limit === null ? cardRows : cardRows.slice(0, limit);

    return {
      id: deck.id,
      name: deck.name,
      cardCount: cardRows.length,
      cardsHydrated: limit === null || limit >= cardRows.length,
      cards: limitedRows.map((row) => mapCardRow(row, { includeFullImage: options.includeMedia === true }))
    };
  }

  function loadShellPreviewDeck(row, focusDeckId) {
    const cardRows = statements.getCardsByDeck.all(row.id);
    const previewLimit = row.id === focusDeckId
      ? APP_SHELL_LAST_DECK_CARD_LIMIT
      : APP_SHELL_OTHER_DECK_CARD_LIMIT;
    const previewRows = shuffleCards(cardRows, randomFn).slice(0, previewLimit);

    return {
      id: row.id,
      name: row.name,
      cardCount: row.cardCount,
      cardsHydrated: previewRows.length >= cardRows.length,
      cards: previewRows.map((cardRow) => mapCardRow(cardRow, { includeFullImage: false }))
    };
  }

  function loadCardMedia(cardIds) {
    const normalizedIds = Array.isArray(cardIds)
      ? cardIds
        .map((cardId) => (typeof cardId === "string" ? cardId.trim() : ""))
        .filter(Boolean)
      : [];

    if (normalizedIds.length === 0) {
      return [];
    }

    const uniqueIds = Array.from(new Set(normalizedIds));
    return statements.getCardMediaByIds
      .all(JSON.stringify(uniqueIds))
      .map((row) => mapCardRow(row, { includeFullImage: true }));
  }

  function loadAppShellData() {
    const deckRows = statements.getDeckRows.all();
    const focusDeckId = getShellFocusDeckId(deckRows);

    return {
      decks: deckRows.map((row) => loadShellPreviewDeck(row, focusDeckId)),
      languagePreference: normalizeLanguage(getSetting(SETTINGS_KEYS.language)),
      themePreference: normalizeThemePreference(getSetting(SETTINGS_KEYS.theme)),
      homeGridColumns: normalizeHomeGridColumns(getSetting(SETTINGS_KEYS.homeGridColumns)),
      homeMediaCache: normalizeHomeMediaCache(getSetting(SETTINGS_KEYS.homeMediaCache)),
      studyProgress: loadStudyProgress(),
      studySessions: loadStudySessions()
    };
  }

  function loadStudyProgress() {
    return statements.getStudyProgressRows.all().reduce((result, row) => {
      result[row.cardId] = normalizeStudyProgressEntry(row);
      return result;
    }, {});
  }

  function loadStudySessions() {
    return statements.getStudySessionRows.all().map((row) => normalizeStudySession(row)).filter(Boolean);
  }

  function loadAppData() {
    return {
      decks: getDecks(),
      languagePreference: normalizeLanguage(getSetting(SETTINGS_KEYS.language)),
      themePreference: normalizeThemePreference(getSetting(SETTINGS_KEYS.theme)),
      homeGridColumns: normalizeHomeGridColumns(getSetting(SETTINGS_KEYS.homeGridColumns)),
      homeMediaCache: normalizeHomeMediaCache(getSetting(SETTINGS_KEYS.homeMediaCache)),
      studyProgress: loadStudyProgress(),
      studySessions: loadStudySessions()
    };
  }

  function replaceDecksSnapshotTx(normalizedDecks) {
    const now = getNow();
    const existingDeckCreatedAt = new Map(
      statements.getAllDecksCreatedAt.all().map((row) => [row.id, row.created_at])
    );
    const existingCardCreatedAt = new Map(
      statements.getAllCardsCreatedAt.all().map((row) => [row.id, row.created_at])
    );
    const existingCardsByDeck = new Map(
      getDecks().map((deck) => [deck.id, deck.cards])
    );

    statements.deleteAllDecks.run();

    normalizedDecks.forEach((deck, deckIndex) => {
      const mergedCards = mergePartialDeckCards(deck, existingCardsByDeck.get(deck.id));

      statements.insertDeck.run(
        deck.id,
        deck.name,
        existingDeckCreatedAt.get(deck.id) || now,
        deckIndex
      );

      mergedCards.forEach((card, cardIndex) => {
        const existingCard = (existingCardsByDeck.get(deck.id) || []).find((item) => item.id === card.id);
        const persistedCard = normalizePersistedCardMedia(
          mergeCardWithExistingMedia(card, existingCard),
          options
        );

        statements.insertCard.run(
          persistedCard.id,
          deck.id,
          persistedCard.frontText,
          persistedCard.backText,
          persistedCard.image || "",
          persistedCard.imageThumb || "",
          persistedCard.imageStudy || "",
          persistedCard.imageSide === "front" ? "front" : "back",
          JSON.stringify(normalizeExtraSides(persistedCard.extraSides)),
          existingCardCreatedAt.get(persistedCard.id) || now,
          cardIndex
        );
      });
    });
  }

  function replaceStudyProgressTx(progressMap) {
    statements.deleteAllStudyProgress.run();

    Object.entries(progressMap).forEach(([cardId, entry]) => {
      statements.insertStudyProgress.run(
        cardId,
        entry.seenCount,
        entry.correctCount,
        entry.lastResult,
        entry.lastReviewedAt
      );
    });
  }

  function replaceStudySessionsTx(sessions) {
    statements.deleteAllStudySessions.run();

    sessions.forEach((session) => {
      const now = getNow();
      statements.insertStudySession.run(
        createId("session"),
        session.deckId,
        session.deckName,
        "all",
        0,
        0,
        0,
        0,
        0,
        session.finishedAt,
        now,
        session.completedRounds
      );
    });

    statements.pruneStudySessions.run();
  }

  const saveDecksSnapshotTx = db.transaction((snapshot) => {
    const normalizedDecks = normalizeStoredDecks(snapshot);
    replaceDecksSnapshotTx(normalizedDecks);
  });

  function saveDecksSnapshot(snapshot) {
    saveDecksSnapshotTx(snapshot);
    return getDecks();
  }

  function createDeck(name) {
    const deck = createDeckModel(name);
    if (!deck || !deck.name) {
      throw createRepositoryError("Deck name is required.");
    }

    const now = getNow();
    const sortIndex = statements.maxDeckSortIndex.get().sortIndex + 1;
    statements.insertDeck.run(deck.id, deck.name, now, sortIndex);
    return {
      id: deck.id,
      name: deck.name,
      cardCount: 0,
      cardsHydrated: true,
      cards: []
    };
  }

  function createCard(fields) {
    const normalizedCard = normalizePersistedCardMedia(createCardModel(fields), options);
    if (!normalizedCard) {
      throw createRepositoryError("Card fields are invalid.");
    }

    const deckId = typeof fields.deckId === "string" ? fields.deckId : "";
    if (!deckId.trim()) {
      throw createRepositoryError("Deck id is required for card creation.");
    }

    const deck = statements.getDeckById.get(deckId);
    if (!deck) {
      throw createRepositoryError(`Deck "${deckId}" was not found.`);
    }

    const now = getNow();
    const sortIndex = statements.maxCardSortIndex.get(deckId).sortIndex + 1;
    statements.insertCard.run(
      normalizedCard.id,
      deckId,
      normalizedCard.frontText,
      normalizedCard.backText,
      normalizedCard.image || "",
      normalizedCard.imageThumb || "",
      normalizedCard.imageStudy || "",
      normalizedCard.imageSide,
      JSON.stringify(normalizeExtraSides(normalizedCard.extraSides)),
      now,
      sortIndex
    );

    return normalizedCard;
  }

  function saveSettingValue(key, value) {
    switch (key) {
      case SETTINGS_KEYS.language:
        return setSetting(key, normalizeLanguage(value) || DEFAULT_LANGUAGE);
      case SETTINGS_KEYS.theme:
        return setSetting(key, normalizeThemePreference(value));
      case SETTINGS_KEYS.homeGridColumns:
        return setSetting(key, normalizeHomeGridColumns(value));
      case SETTINGS_KEYS.homeMediaCache:
        return setSetting(key, JSON.stringify(normalizeHomeMediaCache(value)));
      default:
        return setSetting(key, value);
    }
  }

  function recordStudyAnswer(cardId, result) {
    if (typeof cardId !== "string" || !cardId.trim()) {
      throw createRepositoryError("Card id is required.");
    }

    const existing = normalizeStudyProgressEntry(statements.getStudyProgressEntry.get(cardId)) || {
      seenCount: 0,
      correctCount: 0,
      lastResult: null,
      lastReviewedAt: null
    };
    const nextEntry = {
      seenCount: existing.seenCount + 1,
      correctCount: existing.correctCount + (result === "correct" ? 1 : 0),
      lastResult: typeof result === "string" && result ? result : null,
      lastReviewedAt: getNow()
    };

    statements.insertStudyProgress.run(
      cardId,
      nextEntry.seenCount,
      nextEntry.correctCount,
      nextEntry.lastResult,
      nextEntry.lastReviewedAt
    );

    return nextEntry;
  }

  function recordStudySession(summary) {
    const session = normalizeStudySession(summary);
    if (!session) {
      throw createRepositoryError("Study session summary is invalid.");
    }

    const now = getNow();
    statements.insertStudySession.run(
      createId("session"),
      session.deckId,
      session.deckName,
      "all",
      0,
      0,
      0,
      0,
      0,
      session.finishedAt,
      now,
      session.completedRounds
    );
    statements.pruneStudySessions.run();
    return loadStudySessions();
  }

  const clearAllDataTx = db.transaction((options = {}) => {
    const includeLanguage = options.includeLanguage !== false;
    const preservedLanguage = includeLanguage ? null : normalizeLanguage(getSetting(SETTINGS_KEYS.language));

    statements.deleteAllDecks.run();
    statements.deleteAllStudyProgress.run();
    statements.deleteAllStudySessions.run();
    statements.deleteAllSettings.run();

    if (preservedLanguage) {
      setSetting(SETTINGS_KEYS.language, preservedLanguage);
    }
  });

  function clearAllData(options = {}) {
    clearAllDataTx(options);
    return loadAppData();
  }

  const restoreAppStateSnapshotTx = db.transaction((snapshot = {}) => {
    const normalizedSnapshot = {
      decks: normalizeStoredDecks(snapshot.decks),
      languagePreference: normalizeLanguage(snapshot.languagePreference || snapshot.language),
      themePreference: normalizeThemePreference(snapshot.themePreference),
      homeGridColumns: normalizeHomeGridColumns(snapshot.homeGridColumns),
      homeMediaCache: normalizeHomeMediaCache(snapshot.homeMediaCache),
      studyProgress: normalizeStudyProgress(snapshot.studyProgress),
      studySessions: normalizeStudySessions(snapshot.studySessions)
    };

    replaceDecksSnapshotTx(normalizedSnapshot.decks);
    replaceStudyProgressTx(normalizedSnapshot.studyProgress);
    replaceStudySessionsTx(normalizedSnapshot.studySessions);
    saveSettingValue(SETTINGS_KEYS.theme, normalizedSnapshot.themePreference);
    saveSettingValue(SETTINGS_KEYS.homeGridColumns, normalizedSnapshot.homeGridColumns);
    saveSettingValue(SETTINGS_KEYS.homeMediaCache, normalizedSnapshot.homeMediaCache);

    if (normalizedSnapshot.languagePreference) {
      saveSettingValue(SETTINGS_KEYS.language, normalizedSnapshot.languagePreference);
    }

    return loadAppData();
  });

  function restoreAppStateSnapshot(snapshot = {}) {
    return restoreAppStateSnapshotTx(snapshot);
  }

  function close() {
    db.close();
  }

  return {
    SETTINGS_KEYS,
    clearAllData,
    close,
    createCard,
    createDeck,
    getBootstrapSettings,
    getCardsByDeck,
    getDecks,
    loadAppData,
    loadAppShellData,
    loadCardMedia,
    loadDeckCards,
    recordStudyAnswer,
    recordStudySession,
    restoreAppStateSnapshot,
    saveDecksSnapshot,
    saveSetting: saveSettingValue
  };
}

module.exports = {
  DEFAULT_HOME_GRID_COLUMNS,
  DEFAULT_LANGUAGE,
  DEFAULT_THEME_PREFERENCE,
  SETTINGS_KEYS,
  createSqliteRepository,
  normalizeHomeGridColumns,
  normalizeHomeMediaCache,
  normalizeLanguage,
  normalizeStudyProgress,
  normalizeStudySessions,
  normalizeThemePreference
};
