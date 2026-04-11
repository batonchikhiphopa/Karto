"use strict";

const fs = require("node:fs");
const path = require("node:path");

const Database = require("better-sqlite3");

const {
  createCard: createCardModel,
  createDeck: createDeckModel,
  createId,
  normalizeStoredDecks
} = require("./data-model");

const DEFAULT_THEME_PREFERENCE = "system";
const DEFAULT_HOME_GRID_COLUMNS = "auto";
const DEFAULT_LANGUAGE = "en";
const MAX_STUDY_SESSIONS_PER_DECK = 5;

const SETTINGS_KEYS = Object.freeze({
  language: "language",
  theme: "theme",
  homeGridColumns: "homeGridColumns",
  legacyMigrationCompleted: "legacyMigrationCompleted"
});

function normalizeThemePreference(value) {
  return ["system", "dark", "light"].includes(value) ? value : DEFAULT_THEME_PREFERENCE;
}

function normalizeHomeGridColumns(value) {
  return ["auto", "2", "3", "4"].includes(value) ? value : DEFAULT_HOME_GRID_COLUMNS;
}

function normalizeLanguage(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().split(/[-_]/)[0];
  return ["ru", "en", "de"].includes(normalized) ? normalized : null;
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

function normalizeStudyProgress(value) {
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

function normalizeStudySession(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const deckId = typeof entry.deckId === "string" ? entry.deckId.trim() : "";
  if (!deckId || !Object.prototype.hasOwnProperty.call(entry, "completedRounds")) {
    return null;
  }

  const completedRounds = Number.isFinite(Number(entry.completedRounds))
    ? Math.max(0, Math.round(Number(entry.completedRounds)))
    : null;

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

function compareStudySessionsByFinishedAtDesc(left, right) {
  const leftTime = Date.parse(left.finishedAt) || 0;
  const rightTime = Date.parse(right.finishedAt) || 0;
  return rightTime - leftTime;
}

function normalizeStudySessions(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const countsByDeckId = new Map();

  return value
    .map(normalizeStudySession)
    .filter(Boolean)
    .sort(compareStudySessionsByFinishedAtDesc)
    .filter((session) => {
      const count = countsByDeckId.get(session.deckId) || 0;
      if (count >= MAX_STUDY_SESSIONS_PER_DECK) {
        return false;
      }

      countsByDeckId.set(session.deckId, count + 1);
      return true;
    });
}

function hasAnyLegacyData(payload) {
  return (
    (Array.isArray(payload.decks) && payload.decks.length > 0) ||
    !!payload.languagePreference ||
    payload.themePreference !== DEFAULT_THEME_PREFERENCE ||
    payload.homeGridColumns !== DEFAULT_HOME_GRID_COLUMNS ||
    Object.keys(payload.studyProgress).length > 0 ||
    payload.studySessions.length > 0
  );
}

function createRepositoryError(message) {
  return new Error(`[karto][sqlite] ${message}`);
}

function createSqliteRepository(options = {}) {
  const dbPath = options.dbPath;
  const DatabaseCtor = options.DatabaseCtor || Database;

  if (typeof dbPath !== "string" || !dbPath.trim()) {
    throw createRepositoryError("Database path is required.");
  }

  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseCtor(dbPath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL,
      front_text TEXT NOT NULL,
      back_text TEXT NOT NULL,
      image TEXT NOT NULL DEFAULT '',
      image_side TEXT NOT NULL DEFAULT 'back',
      created_at TEXT NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(deck_id) REFERENCES decks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS study_progress (
      card_id TEXT PRIMARY KEY,
      seen_count INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      last_result TEXT,
      last_reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
      id TEXT PRIMARY KEY,
      deck_id TEXT,
      deck_name TEXT NOT NULL,
      mode TEXT NOT NULL,
      reviewed INTEGER NOT NULL,
      correct INTEGER NOT NULL,
      wrong INTEGER NOT NULL,
      unsure INTEGER NOT NULL,
      percent_correct INTEGER NOT NULL,
      finished_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      completed_rounds INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_decks_sort ON decks(sort_index, created_at, id);
    CREATE INDEX IF NOT EXISTS idx_cards_deck_sort ON cards(deck_id, sort_index, created_at, id);
    CREATE INDEX IF NOT EXISTS idx_sessions_finished ON study_sessions(finished_at, created_at, id);
  `);

  const sessionColumns = db.prepare("PRAGMA table_info(study_sessions)").all();
  if (!sessionColumns.some((column) => column.name === "completed_rounds")) {
    db.exec(`
      ALTER TABLE study_sessions ADD COLUMN completed_rounds INTEGER NOT NULL DEFAULT 0;
      DELETE FROM study_sessions;
    `);
  }

  const statements = {
    deleteAllDecks: db.prepare("DELETE FROM decks"),
    deleteCardsByDeck: db.prepare("DELETE FROM cards WHERE deck_id = ?"),
    deleteSettingsExcept: db.prepare("DELETE FROM settings WHERE key <> ?"),
    deleteAllSettings: db.prepare("DELETE FROM settings"),
    deleteAllStudyProgress: db.prepare("DELETE FROM study_progress"),
    deleteAllStudySessions: db.prepare("DELETE FROM study_sessions"),
    deleteDeck: db.prepare("DELETE FROM decks WHERE id = ?"),
    getAllCardsCreatedAt: db.prepare("SELECT id, created_at FROM cards"),
    getAllDecksCreatedAt: db.prepare("SELECT id, created_at FROM decks"),
    getCardsByDeck: db.prepare(`
      SELECT
        id,
        deck_id AS deckId,
        front_text AS frontText,
        back_text AS backText,
        image,
        image_side AS imageSide,
        created_at AS createdAt,
        sort_index AS sortIndex
      FROM cards
      WHERE deck_id = ?
      ORDER BY sort_index ASC, created_at ASC, id ASC
    `),
    getDeckById: db.prepare("SELECT id, name FROM decks WHERE id = ?"),
    getDeckRows: db.prepare(`
      SELECT
        id,
        name,
        created_at AS createdAt,
        sort_index AS sortIndex
      FROM decks
      ORDER BY sort_index ASC, created_at ASC, id ASC
    `),
    getDeckCount: db.prepare("SELECT COUNT(*) AS count FROM decks"),
    getSetting: db.prepare("SELECT value FROM settings WHERE key = ?"),
    getSettingsCount: db.prepare("SELECT COUNT(*) AS count FROM settings WHERE key IN (?, ?, ?)"),
    getStudyProgressCount: db.prepare("SELECT COUNT(*) AS count FROM study_progress"),
    getStudySessionCount: db.prepare("SELECT COUNT(*) AS count FROM study_sessions"),
    getStudyProgressEntry: db.prepare(`
      SELECT
        seen_count AS seenCount,
        correct_count AS correctCount,
        last_result AS lastResult,
        last_reviewed_at AS lastReviewedAt
      FROM study_progress
      WHERE card_id = ?
    `),
    getStudyProgressRows: db.prepare(`
      SELECT
        card_id AS cardId,
        seen_count AS seenCount,
        correct_count AS correctCount,
        last_result AS lastResult,
        last_reviewed_at AS lastReviewedAt
      FROM study_progress
    `),
    getStudySessionRows: db.prepare(`
      SELECT
        id,
        deck_id AS deckId,
        deck_name AS deckName,
        mode,
        reviewed,
        correct,
        wrong,
        unsure,
        percent_correct AS percentCorrect,
        finished_at AS finishedAt,
        created_at AS createdAt,
        completed_rounds AS completedRounds
      FROM study_sessions
      ORDER BY finished_at DESC, created_at DESC, id DESC
    `),
    insertCard: db.prepare(`
      INSERT INTO cards (
        id,
        deck_id,
        front_text,
        back_text,
        image,
        image_side,
        created_at,
        sort_index
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        deck_id = excluded.deck_id,
        front_text = excluded.front_text,
        back_text = excluded.back_text,
        image = excluded.image,
        image_side = excluded.image_side,
        created_at = excluded.created_at,
        sort_index = excluded.sort_index
    `),
    insertDeck: db.prepare(`
      INSERT INTO decks (
        id,
        name,
        created_at,
        sort_index
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        created_at = excluded.created_at,
        sort_index = excluded.sort_index
    `),
    insertStudyProgress: db.prepare(`
      INSERT INTO study_progress (
        card_id,
        seen_count,
        correct_count,
        last_result,
        last_reviewed_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(card_id) DO UPDATE SET
        seen_count = excluded.seen_count,
        correct_count = excluded.correct_count,
        last_result = excluded.last_result,
        last_reviewed_at = excluded.last_reviewed_at
    `),
    insertStudySession: db.prepare(`
      INSERT INTO study_sessions (
        id,
        deck_id,
        deck_name,
        mode,
        reviewed,
        correct,
        wrong,
        unsure,
        percent_correct,
        finished_at,
        created_at,
        completed_rounds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    maxDeckSortIndex: db.prepare("SELECT COALESCE(MAX(sort_index), -1) AS sortIndex FROM decks"),
    maxCardSortIndex: db.prepare("SELECT COALESCE(MAX(sort_index), -1) AS sortIndex FROM cards WHERE deck_id = ?"),
    pruneStudySessions: db.prepare(`
      DELETE FROM study_sessions
      WHERE id NOT IN (
        SELECT id
        FROM (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY deck_id
              ORDER BY finished_at DESC, created_at DESC, id DESC
            ) AS row_number
          FROM study_sessions
        )
        WHERE row_number <= ${MAX_STUDY_SESSIONS_PER_DECK}
      )
    `),
    setSetting: db.prepare(`
      INSERT INTO settings (
        key,
        value,
        updated_at
      ) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `)
  };

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
    return statements.getCardsByDeck.all(deckId).map((row) => ({
      id: row.id,
      frontText: row.frontText,
      backText: row.backText,
      image: row.image || "",
      imageSide: row.imageSide === "front" ? "front" : "back"
    }));
  }

  function getDecks() {
    return statements.getDeckRows.all().map((row) => ({
      id: row.id,
      name: row.name,
      cards: getCardsByDeck(row.id)
    }));
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
      studyProgress: loadStudyProgress(),
      studySessions: loadStudySessions(),
      legacyMigrationCompleted: getSetting(SETTINGS_KEYS.legacyMigrationCompleted) === "1"
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

    statements.deleteAllDecks.run();

    normalizedDecks.forEach((deck, deckIndex) => {
      statements.insertDeck.run(
        deck.id,
        deck.name,
        existingDeckCreatedAt.get(deck.id) || now,
        deckIndex
      );

      deck.cards.forEach((card, cardIndex) => {
        statements.insertCard.run(
          card.id,
          deck.id,
          card.frontText,
          card.backText,
          card.image || "",
          card.imageSide === "front" ? "front" : "back",
          existingCardCreatedAt.get(card.id) || now,
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
      cards: []
    };
  }

  function createCard(fields) {
    const normalizedCard = createCardModel(fields);
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
      normalizedCard.imageSide,
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
    const migrationCompleted = getSetting(SETTINGS_KEYS.legacyMigrationCompleted) === "1";

    statements.deleteAllDecks.run();
    statements.deleteAllStudyProgress.run();
    statements.deleteAllStudySessions.run();
    statements.deleteAllSettings.run();

    if (migrationCompleted) {
      setSetting(SETTINGS_KEYS.legacyMigrationCompleted, "1");
    }

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
      studyProgress: normalizeStudyProgress(snapshot.studyProgress),
      studySessions: normalizeStudySessions(snapshot.studySessions)
    };

    replaceDecksSnapshotTx(normalizedSnapshot.decks);
    replaceStudyProgressTx(normalizedSnapshot.studyProgress);
    replaceStudySessionsTx(normalizedSnapshot.studySessions);
    saveSettingValue(SETTINGS_KEYS.theme, normalizedSnapshot.themePreference);
    saveSettingValue(SETTINGS_KEYS.homeGridColumns, normalizedSnapshot.homeGridColumns);

    if (normalizedSnapshot.languagePreference) {
      saveSettingValue(SETTINGS_KEYS.language, normalizedSnapshot.languagePreference);
    }

    setSetting(SETTINGS_KEYS.legacyMigrationCompleted, "1");
    return loadAppData();
  });

  function restoreAppStateSnapshot(snapshot = {}) {
    return restoreAppStateSnapshotTx(snapshot);
  }

  const importLegacyLocalStorageTx = db.transaction((payload = {}) => {
    const migrationCompleted = getSetting(SETTINGS_KEYS.legacyMigrationCompleted) === "1";
    if (migrationCompleted) {
      return {
        imported: false,
        clearLegacyStorage: true,
        appData: loadAppData()
      };
    }

    const normalizedPayload = {
      decks: normalizeStoredDecks(payload.decks),
      languagePreference: normalizeLanguage(payload.languagePreference || payload.language),
      themePreference: normalizeThemePreference(payload.themePreference),
      homeGridColumns: normalizeHomeGridColumns(payload.homeGridColumns),
      studyProgress: normalizeStudyProgress(payload.studyProgress),
      studySessions: normalizeStudySessions(payload.studySessions)
    };

    const hasExistingUserData =
      statements.getDeckCount.get().count > 0 ||
      statements.getStudyProgressCount.get().count > 0 ||
      statements.getStudySessionCount.get().count > 0 ||
      statements.getSettingsCount.get(
        SETTINGS_KEYS.language,
        SETTINGS_KEYS.theme,
        SETTINGS_KEYS.homeGridColumns
      ).count > 0;

    const shouldImport = !hasExistingUserData && hasAnyLegacyData(normalizedPayload);

    if (shouldImport) {
      replaceDecksSnapshotTx(normalizedPayload.decks);
      replaceStudyProgressTx(normalizedPayload.studyProgress);
      replaceStudySessionsTx(normalizedPayload.studySessions);

      if (normalizedPayload.languagePreference) {
        saveSettingValue(SETTINGS_KEYS.language, normalizedPayload.languagePreference);
      }

      saveSettingValue(SETTINGS_KEYS.theme, normalizedPayload.themePreference);
      saveSettingValue(SETTINGS_KEYS.homeGridColumns, normalizedPayload.homeGridColumns);
    }

    setSetting(SETTINGS_KEYS.legacyMigrationCompleted, "1");

    return {
      imported: shouldImport,
      clearLegacyStorage: true,
      appData: loadAppData()
    };
  });

  function importLegacyLocalStorage(payload = {}) {
    return importLegacyLocalStorageTx(payload);
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
    importLegacyLocalStorage,
    loadAppData,
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
  normalizeLanguage,
  normalizeStudyProgress,
  normalizeStudySessions,
  normalizeThemePreference
};
