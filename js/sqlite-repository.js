"use strict";

const fs = require("node:fs");
const path = require("node:path");

const Database = require("better-sqlite3");

const {
  createCard: createCardModel,
  createDeck: createDeckModel,
  createId,
  normalizeExtraSides,
  normalizeStoredDecks
} = require("./data-model");
const {
  shuffleCards
} = require("./study-engine");
const {
  deriveStudyImageUrl,
  deriveTileImageUrl,
  getResizedDimensions,
  isDataImageUrl,
  normalizeImageSource,
  STUDY_DATA_IMAGE_MAX_SIDE,
  STUDY_IMAGE_QUALITY,
  TILE_THUMB_MAX_SIDE,
  TILE_THUMB_QUALITY
} = require("./image-utils");

const DEFAULT_THEME_PREFERENCE = "system";
const DEFAULT_HOME_GRID_COLUMNS = "auto";
const DEFAULT_LANGUAGE = "en";
const MAX_STUDY_SESSIONS_PER_DECK = 5;
const APP_SHELL_LAST_DECK_CARD_LIMIT = 5;
const APP_SHELL_OTHER_DECK_CARD_LIMIT = 1;

const SETTINGS_KEYS = Object.freeze({
  language: "language",
  theme: "theme",
  homeGridColumns: "homeGridColumns",
  homeMediaCache: "homeMediaCache"
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

function safeParseJson(value, fallback) {
  if (!value) {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseExtraSides(value) {
  return normalizeExtraSides(safeParseJson(value, []));
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
  const parsedValue = safeParseJson(value, {});
  if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
    return {};
  }

  return Object.entries(parsedValue).reduce((result, [deckId, entry]) => {
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

function deriveLightStudyImageUrl(image, imageStudy) {
  const explicitStudyImage = normalizeImageSource(imageStudy);
  if (explicitStudyImage && !isDataImageUrl(explicitStudyImage)) {
    return explicitStudyImage;
  }

  const source = normalizeImageSource(image);
  if (!source || isDataImageUrl(source)) {
    return "";
  }

  return deriveStudyImageUrl(source);
}

function deriveLightThumbImageUrl(image, imageThumb) {
  const explicitThumb = normalizeImageSource(imageThumb);
  if (explicitThumb) {
    return explicitThumb;
  }

  const source = normalizeImageSource(image);
  if (!source || isDataImageUrl(source)) {
    return "";
  }

  return deriveTileImageUrl(source);
}

function isJpegDataImageUrl(value) {
  return /^data:image\/jpe?g[;,]/i.test(normalizeImageSource(value));
}

function resolveStoredDerivedStudyUrl(image) {
  const derived = deriveStudyImageUrl(image);
  return derived && derived !== image ? derived : "";
}

function resolveNativeImage(options) {
  return options?.nativeImage && typeof options.nativeImage.createFromDataURL === "function"
    ? options.nativeImage
    : null;
}

function resizeDataImageWithNativeImage(source, options = {}) {
  const normalizedSource = normalizeImageSource(source);
  const nativeImage = resolveNativeImage(options);
  if (!isDataImageUrl(normalizedSource) || !nativeImage) {
    return "";
  }

  try {
    const image = nativeImage.createFromDataURL(normalizedSource);
    if (!image || image.isEmpty?.()) {
      return "";
    }

    const size = typeof image.getSize === "function" ? image.getSize() : {};
    const dimensions = getResizedDimensions(size.width, size.height, options.maxSide);
    const sourceWidth = Math.max(1, Math.round(Number(size.width) || dimensions.width));
    const sourceHeight = Math.max(1, Math.round(Number(size.height) || dimensions.height));
    const shouldResize = dimensions.width !== sourceWidth || dimensions.height !== sourceHeight;

    if (!options.force && !shouldResize && isJpegDataImageUrl(normalizedSource)) {
      return normalizedSource;
    }

    const outputImage = shouldResize && typeof image.resize === "function"
      ? image.resize({
        width: dimensions.width,
        height: dimensions.height,
        quality: "good"
      })
      : image;
    const quality = Math.round(Math.max(0, Math.min(1, Number(options.quality) || 0.72)) * 100);
    const buffer = typeof outputImage.toJPEG === "function" ? outputImage.toJPEG(quality) : null;

    return buffer?.length
      ? `data:image/jpeg;base64,${Buffer.from(buffer).toString("base64")}`
      : "";
  } catch {
    return "";
  }
}

function normalizeLocalDataImageForStudy(source, nativeImage) {
  return resizeDataImageWithNativeImage(source, {
    maxSide: STUDY_DATA_IMAGE_MAX_SIDE,
    quality: STUDY_IMAGE_QUALITY,
    nativeImage
  }) || normalizeImageSource(source);
}

function createLocalDataImageThumb(source, nativeImage) {
  return resizeDataImageWithNativeImage(source, {
    force: true,
    maxSide: TILE_THUMB_MAX_SIDE,
    quality: TILE_THUMB_QUALITY,
    nativeImage
  });
}

function normalizePersistedCardMedia(card, options = {}) {
  if (!card) {
    return card;
  }

  const nativeImage = resolveNativeImage(options);
  let image = normalizeImageSource(card.image);
  let imageThumb = normalizeImageSource(card.imageThumb);
  let imageStudy = normalizeImageSource(card.imageStudy);
  const imageIsData = isDataImageUrl(image);
  const studyIsData = isDataImageUrl(imageStudy);

  if (imageIsData || (!image && studyIsData)) {
    image = studyIsData ? imageStudy : normalizeLocalDataImageForStudy(image, nativeImage);
    imageThumb = imageThumb || createLocalDataImageThumb(image, nativeImage);
    imageStudy = "";
  } else if (image) {
    imageThumb = imageThumb || deriveTileImageUrl(image);
    imageStudy = imageStudy && !studyIsData
      ? imageStudy
      : resolveStoredDerivedStudyUrl(image);
  } else if (studyIsData) {
    image = imageStudy;
    imageThumb = imageThumb || createLocalDataImageThumb(image, nativeImage);
    imageStudy = "";
  } else {
    imageStudy = imageStudy && !studyIsData ? imageStudy : "";
  }

  return {
    ...card,
    image,
    imageThumb,
    imageStudy,
    hasImage: card.hasImage || !!image || !!imageThumb || !!imageStudy,
    mediaLoaded: card.mediaLoaded
  };
}

function mapCardRow(row, options = {}) {
  const fullImage = normalizeImageSource(row?.image);
  const imageThumb = options.includeFullImage
    ? normalizeImageSource(row.imageThumb)
    : deriveLightThumbImageUrl(fullImage, row.imageThumb);
  const imageStudy = options.includeFullImage
    ? normalizeImageSource(row?.imageStudy) || (isDataImageUrl(fullImage) ? "" : deriveStudyImageUrl(fullImage))
    : "";
  const hasImage = !!fullImage || !!imageThumb || !!deriveLightStudyImageUrl(fullImage, row?.imageStudy);

  return {
    id: row.id,
    frontText: row.frontText,
    backText: row.backText,
    extraSides: parseExtraSides(row.extraSides),
    image: options.includeFullImage ? fullImage : "",
    imageThumb,
    imageStudy,
    imageSide: row.imageSide === "front" ? "front" : "back",
    hasImage,
    mediaLoaded: options.includeFullImage || !fullImage
  };
}

function mergeCardWithExistingMedia(card, existingCard) {
  if (!existingCard || card.mediaLoaded !== false) {
    return card;
  }

  return {
    ...card,
    image: existingCard.image || card.image || "",
    imageThumb: card.imageThumb || existingCard.imageThumb || "",
    imageStudy: card.imageStudy || existingCard.imageStudy || "",
    hasImage: card.hasImage || existingCard.hasImage,
    mediaLoaded: true
  };
}

function mergePartialDeckCards(deck, existingCards) {
  if (deck.cardsHydrated === true || !Array.isArray(existingCards) || existingCards.length === 0) {
    return deck.cards;
  }

  const partialCardsById = new Map(deck.cards.map((card) => [card.id, card]));
  const mergedCards = existingCards.map((existingCard) => {
    const partialCard = partialCardsById.get(existingCard.id);
    if (!partialCard) {
      return existingCard;
    }

    partialCardsById.delete(existingCard.id);
    return mergeCardWithExistingMedia(partialCard, existingCard);
  });

  partialCardsById.forEach((card) => {
    mergedCards.push(card);
  });

  return mergedCards;
}

function createRepositoryError(message) {
  return new Error(`[karto][sqlite] ${message}`);
}

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
      image_thumb TEXT NOT NULL DEFAULT '',
      image_study TEXT NOT NULL DEFAULT '',
      image_side TEXT NOT NULL DEFAULT 'back',
      extra_sides TEXT NOT NULL DEFAULT '[]',
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

  const cardColumns = db.prepare("PRAGMA table_info(cards)").all();
  if (!cardColumns.some((column) => column.name === "image_thumb")) {
    db.exec("ALTER TABLE cards ADD COLUMN image_thumb TEXT NOT NULL DEFAULT ''");
  }
  if (!cardColumns.some((column) => column.name === "image_study")) {
    db.exec("ALTER TABLE cards ADD COLUMN image_study TEXT NOT NULL DEFAULT ''");
  }
  if (!cardColumns.some((column) => column.name === "extra_sides")) {
    db.exec("ALTER TABLE cards ADD COLUMN extra_sides TEXT NOT NULL DEFAULT '[]'");
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
        image_thumb AS imageThumb,
        image_study AS imageStudy,
        image_side AS imageSide,
        extra_sides AS extraSides,
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
        sort_index AS sortIndex,
        (
          SELECT COUNT(*)
          FROM cards
          WHERE cards.deck_id = decks.id
        ) AS cardCount
      FROM decks
      ORDER BY sort_index ASC, created_at ASC, id ASC
    `),
    getLastStudiedDeck: db.prepare(`
      SELECT deck_id AS deckId
      FROM study_sessions
      WHERE deck_id IS NOT NULL AND deck_id <> ''
      ORDER BY finished_at DESC, created_at DESC, id DESC
      LIMIT 1
    `),
    getFirstNonEmptyDeck: db.prepare(`
      SELECT decks.id AS deckId
      FROM decks
      WHERE EXISTS (
        SELECT 1
        FROM cards
        WHERE cards.deck_id = decks.id
      )
      ORDER BY decks.sort_index ASC, decks.created_at ASC, decks.id ASC
      LIMIT 1
    `),
    getSetting: db.prepare("SELECT value FROM settings WHERE key = ?"),
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
        image_thumb,
        image_study,
        image_side,
        extra_sides,
        created_at,
        sort_index
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        deck_id = excluded.deck_id,
        front_text = excluded.front_text,
        back_text = excluded.back_text,
        image = excluded.image,
        image_thumb = excluded.image_thumb,
        image_study = excluded.image_study,
        image_side = excluded.image_side,
        extra_sides = excluded.extra_sides,
        created_at = excluded.created_at,
        sort_index = excluded.sort_index
    `),
    getCardMediaByIds: db.prepare(`
      SELECT
        id,
        front_text AS frontText,
        back_text AS backText,
        image,
        image_thumb AS imageThumb,
        image_study AS imageStudy,
        image_side AS imageSide,
        extra_sides AS extraSides
      FROM cards
      WHERE id IN (SELECT value FROM json_each(?))
      ORDER BY deck_id ASC, sort_index ASC, created_at ASC, id ASC
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
