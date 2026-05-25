"use strict";

function initializeSchema(db) {
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
      last_reviewed_at TEXT,
      due_at TEXT,
      interval_days INTEGER NOT NULL DEFAULT 0,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      lapse_count INTEGER NOT NULL DEFAULT 0
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

  const progressColumns = db.prepare("PRAGMA table_info(study_progress)").all();
  if (!progressColumns.some((column) => column.name === "due_at")) {
    db.exec("ALTER TABLE study_progress ADD COLUMN due_at TEXT");
  }
  if (!progressColumns.some((column) => column.name === "interval_days")) {
    db.exec("ALTER TABLE study_progress ADD COLUMN interval_days INTEGER NOT NULL DEFAULT 0");
  }
  if (!progressColumns.some((column) => column.name === "ease_factor")) {
    db.exec("ALTER TABLE study_progress ADD COLUMN ease_factor REAL NOT NULL DEFAULT 2.5");
  }
  if (!progressColumns.some((column) => column.name === "lapse_count")) {
    db.exec("ALTER TABLE study_progress ADD COLUMN lapse_count INTEGER NOT NULL DEFAULT 0");
  }
}

module.exports = {
  initializeSchema
};
