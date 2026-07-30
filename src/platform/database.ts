import Dexie, { type EntityTable } from "dexie";
import type {
  AppSetting,
  Card,
  Deck,
  StudyProgress,
  StudySession
} from "../shared/library";
import type {
  ReadingItem,
  ReadingProgress,
  ReadingSource
} from "../shared/reading";

export const kartoDb = new Dexie("karto") as Dexie & {
  readingItems: EntityTable<ReadingItem, "id">;
  readingProgress: EntityTable<ReadingProgress, "itemId">;
  readingSources: EntityTable<ReadingSource, "id">;
  decks: EntityTable<Deck, "id">;
  cards: EntityTable<Card, "id">;
  studyProgress: EntityTable<StudyProgress, "cardId">;
  studySessions: EntityTable<StudySession, "id">;
  settings: EntityTable<AppSetting, "id">;
};

kartoDb.version(1).stores({
  readingItems: "id, language, categoryId, sourceId, importedAt"
});

kartoDb.version(2).stores({
  readingItems: "id, language, categoryId, sourceId, importedAt",
  decks: "id, order, system, updatedAt",
  cards: "id, deckId, updatedAt",
  studyProgress: "cardId, dueAt, lastResult"
});

kartoDb.version(3).stores({
  readingItems: "id, language, categoryId, sourceId, importedAt",
  readingProgress: "itemId, openedAt, completedAt",
  readingSources: "id, language, categoryId, enabled, builtIn",
  decks: "id, order, system, updatedAt",
  cards: "id, deckId, updatedAt",
  studyProgress: "cardId, deckId, dueAt, lastResult, lastReviewedAt",
  studySessions: "id, deckId, finishedAt",
  settings: "id"
}).upgrade(async (transaction) => {
  const cards = transaction.table("cards");
  await cards.toCollection().modify((card) => {
    card.frontText ??= card.front ?? "";
    card.backText ??= card.back ?? "";
    card.extraSides ??= [];
    card.imageSide ??= "back";
    delete card.front;
    delete card.back;
  });

  const progress = transaction.table("studyProgress");
  await progress.toCollection().modify((entry) => {
    entry.deckId ??= "";
    entry.lapseCount ??= 0;
    entry.lastReviewedAt ??= null;
  });
});

export async function resetKartoDatabase(): Promise<void> {
  await kartoDb.transaction(
    "rw",
    [
      kartoDb.readingItems,
      kartoDb.readingProgress,
      kartoDb.readingSources,
      kartoDb.decks,
      kartoDb.cards,
      kartoDb.studyProgress,
      kartoDb.studySessions,
      kartoDb.settings
    ],
    async () => {
      await Promise.all(kartoDb.tables.map((table) => table.clear()));
    }
  );
}

