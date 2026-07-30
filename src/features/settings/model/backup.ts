import { kartoDb } from "../../../platform/database";
import { createId } from "../../../shared/ids";
import type { Card, Deck } from "../../../shared/library";

interface KartoBackup {
  product: "Karto";
  schemaVersion: 4;
  exportedAt: string;
  decks: Deck[];
  cards: Card[];
  studyProgress: Awaited<ReturnType<typeof kartoDb.studyProgress.toArray>>;
  studySessions: Awaited<ReturnType<typeof kartoDb.studySessions.toArray>>;
  readingItems: Awaited<ReturnType<typeof kartoDb.readingItems.toArray>>;
  readingProgress: Awaited<ReturnType<typeof kartoDb.readingProgress.toArray>>;
  readingSources: Awaited<ReturnType<typeof kartoDb.readingSources.toArray>>;
  settings: Awaited<ReturnType<typeof kartoDb.settings.toArray>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function createBackup(): Promise<KartoBackup> {
  const [
    decks,
    cards,
    studyProgress,
    studySessions,
    readingItems,
    readingProgress,
    readingSources,
    settings
  ] = await Promise.all([
    kartoDb.decks.toArray(),
    kartoDb.cards.toArray(),
    kartoDb.studyProgress.toArray(),
    kartoDb.studySessions.toArray(),
    kartoDb.readingItems.toArray(),
    kartoDb.readingProgress.toArray(),
    kartoDb.readingSources.toArray(),
    kartoDb.settings.toArray()
  ]);

  return {
    product: "Karto",
    schemaVersion: 4,
    exportedAt: new Date().toISOString(),
    decks,
    cards,
    studyProgress,
    studySessions,
    readingItems,
    readingProgress,
    readingSources,
    settings
  };
}

export async function downloadBackup(): Promise<void> {
  const backup = await createBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `karto-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeLegacyDecks(value: unknown): { decks: Deck[]; cards: Card[] } | null {
  const rawDecks = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.decks)
      ? value.decks
      : null;
  if (!rawDecks) return null;

  const now = new Date().toISOString();
  const decks: Deck[] = [];
  const cards: Card[] = [];
  rawDecks.forEach((rawDeck, deckIndex) => {
    if (!isRecord(rawDeck) || typeof rawDeck.name !== "string" || !rawDeck.name.trim()) return;
    const deckId = typeof rawDeck.id === "string" && rawDeck.id ? rawDeck.id : createId("deck");
    decks.push({
      id: deckId,
      name: rawDeck.name.trim(),
      createdAt: typeof rawDeck.createdAt === "string" ? rawDeck.createdAt : now,
      updatedAt: typeof rawDeck.updatedAt === "string" ? rawDeck.updatedAt : now,
      order: typeof rawDeck.order === "number" ? rawDeck.order : deckIndex,
      system: rawDeck.system === true
    });

    const rawCards = Array.isArray(rawDeck.cards) ? rawDeck.cards : [];
    rawCards.forEach((rawCard) => {
      if (!isRecord(rawCard)) return;
      const frontText = typeof rawCard.frontText === "string"
        ? rawCard.frontText.trim()
        : typeof rawCard.front === "string" ? rawCard.front.trim() : "";
      const backText = typeof rawCard.backText === "string"
        ? rawCard.backText.trim()
        : typeof rawCard.back === "string" ? rawCard.back.trim() : "";
      if (!frontText || !backText) return;
      const rawExtraSides = Array.isArray(rawCard.extraSides) ? rawCard.extraSides : [];
      cards.push({
        id: typeof rawCard.id === "string" && rawCard.id ? rawCard.id : createId("card"),
        deckId,
        frontText,
        backText,
        extraSides: rawExtraSides.flatMap((side) => {
          const text = typeof side === "string"
            ? side.trim()
            : isRecord(side) && typeof side.text === "string" ? side.text.trim() : "";
          return text ? [{ id: isRecord(side) && typeof side.id === "string" ? side.id : createId("side"), text }] : [];
        }),
        image: typeof rawCard.image === "string" ? rawCard.image : undefined,
        imageSide: rawCard.imageSide === "front" ? "front" : "back",
        createdAt: now,
        updatedAt: now
      });
    });
  });
  return { decks, cards };
}

export async function importBackup(raw: unknown): Promise<{ decks: number; cards: number }> {
  if (isRecord(raw) && raw.product === "Karto" && raw.schemaVersion === 4) {
    const decks = Array.isArray(raw.decks) ? raw.decks as unknown as Deck[] : [];
    const cards = Array.isArray(raw.cards) ? raw.cards as unknown as Card[] : [];
    await kartoDb.transaction("rw", kartoDb.tables, async () => {
      await kartoDb.decks.bulkPut(decks);
      await kartoDb.cards.bulkPut(cards);
      if (Array.isArray(raw.studyProgress)) await kartoDb.studyProgress.bulkPut(raw.studyProgress as never[]);
      if (Array.isArray(raw.studySessions)) await kartoDb.studySessions.bulkPut(raw.studySessions as never[]);
      if (Array.isArray(raw.readingItems)) await kartoDb.readingItems.bulkPut(raw.readingItems as never[]);
      if (Array.isArray(raw.readingProgress)) await kartoDb.readingProgress.bulkPut(raw.readingProgress as never[]);
      if (Array.isArray(raw.readingSources)) await kartoDb.readingSources.bulkPut(raw.readingSources as never[]);
      if (Array.isArray(raw.settings)) await kartoDb.settings.bulkPut(raw.settings as never[]);
    });
    return { decks: decks.length, cards: cards.length };
  }

  const legacy = normalizeLegacyDecks(raw);
  if (!legacy) throw new Error("Файл не похож на резервную копию Karto.");
  await kartoDb.transaction("rw", [kartoDb.decks, kartoDb.cards], async () => {
    await kartoDb.decks.bulkPut(legacy.decks);
    await kartoDb.cards.bulkPut(legacy.cards);
  });
  return { decks: legacy.decks.length, cards: legacy.cards.length };
}

