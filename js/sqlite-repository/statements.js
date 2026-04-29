"use strict";

function createStatements(db, { maxStudySessionsPerDeck }) {
  return {
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
      SELECT id, deck_id AS deckId, front_text AS frontText, back_text AS backText,
        image, image_thumb AS imageThumb, image_study AS imageStudy,
        image_side AS imageSide, extra_sides AS extraSides,
        created_at AS createdAt, sort_index AS sortIndex
      FROM cards
      WHERE deck_id = ?
      ORDER BY sort_index ASC, created_at ASC, id ASC
    `),
    getDeckById: db.prepare("SELECT id, name FROM decks WHERE id = ?"),
    getDeckRows: db.prepare(`
      SELECT id, name, created_at AS createdAt, sort_index AS sortIndex,
        (SELECT COUNT(*) FROM cards WHERE cards.deck_id = decks.id) AS cardCount
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
      WHERE EXISTS (SELECT 1 FROM cards WHERE cards.deck_id = decks.id)
      ORDER BY decks.sort_index ASC, decks.created_at ASC, decks.id ASC
      LIMIT 1
    `),
    getSetting: db.prepare("SELECT value FROM settings WHERE key = ?"),
    getStudyProgressEntry: db.prepare(`
      SELECT seen_count AS seenCount, correct_count AS correctCount,
        last_result AS lastResult, last_reviewed_at AS lastReviewedAt
      FROM study_progress
      WHERE card_id = ?
    `),
    getStudyProgressRows: db.prepare(`
      SELECT card_id AS cardId, seen_count AS seenCount, correct_count AS correctCount,
        last_result AS lastResult, last_reviewed_at AS lastReviewedAt
      FROM study_progress
    `),
    getStudySessionRows: db.prepare(`
      SELECT id, deck_id AS deckId, deck_name AS deckName, mode, reviewed,
        correct, wrong, unsure, percent_correct AS percentCorrect,
        finished_at AS finishedAt, created_at AS createdAt,
        completed_rounds AS completedRounds
      FROM study_sessions
      ORDER BY finished_at DESC, created_at DESC, id DESC
    `),
    insertCard: db.prepare(`
      INSERT INTO cards (
        id, deck_id, front_text, back_text, image, image_thumb, image_study,
        image_side, extra_sides, created_at, sort_index
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
      SELECT id, front_text AS frontText, back_text AS backText, image,
        image_thumb AS imageThumb, image_study AS imageStudy,
        image_side AS imageSide, extra_sides AS extraSides
      FROM cards
      WHERE id IN (SELECT value FROM json_each(?))
      ORDER BY deck_id ASC, sort_index ASC, created_at ASC, id ASC
    `),
    insertDeck: db.prepare(`
      INSERT INTO decks (id, name, created_at, sort_index) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        created_at = excluded.created_at,
        sort_index = excluded.sort_index
    `),
    insertStudyProgress: db.prepare(`
      INSERT INTO study_progress (
        card_id, seen_count, correct_count, last_result, last_reviewed_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(card_id) DO UPDATE SET
        seen_count = excluded.seen_count,
        correct_count = excluded.correct_count,
        last_result = excluded.last_result,
        last_reviewed_at = excluded.last_reviewed_at
    `),
    insertStudySession: db.prepare(`
      INSERT INTO study_sessions (
        id, deck_id, deck_name, mode, reviewed, correct, wrong, unsure,
        percent_correct, finished_at, created_at, completed_rounds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    maxDeckSortIndex: db.prepare("SELECT COALESCE(MAX(sort_index), -1) AS sortIndex FROM decks"),
    maxCardSortIndex: db.prepare("SELECT COALESCE(MAX(sort_index), -1) AS sortIndex FROM cards WHERE deck_id = ?"),
    pruneStudySessions: db.prepare(`
      DELETE FROM study_sessions
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY deck_id
            ORDER BY finished_at DESC, created_at DESC, id DESC
          ) AS row_number
          FROM study_sessions
        )
        WHERE row_number <= ${maxStudySessionsPerDeck}
      )
    `),
    setSetting: db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `)
  };
}

module.exports = {
  createStatements
};
