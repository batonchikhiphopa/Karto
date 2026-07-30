import { kartoDb } from "../../../platform/database";
import { createId } from "../../../shared/ids";
import type { Card, Deck } from "../../../shared/library";

export async function listDecks(): Promise<Deck[]> {
  return kartoDb.decks.orderBy("order").toArray();
}

export async function getDeck(deckId: string): Promise<Deck | undefined> {
  return kartoDb.decks.get(deckId);
}

export async function getCards(deckId: string): Promise<Card[]> {
  return kartoDb.cards.where("deckId").equals(deckId).sortBy("createdAt");
}

export async function createDeck(name: string): Promise<Deck> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Название колоды не может быть пустым.");
  const now = new Date().toISOString();
  const last = await kartoDb.decks.orderBy("order").last();
  const deck: Deck = {
    id: createId("deck"),
    name: cleanName,
    createdAt: now,
    updatedAt: now,
    order: Math.max(0, (last?.order ?? -1) + 1),
    system: false
  };
  await kartoDb.decks.add(deck);
  return deck;
}

export async function updateDeck(deckId: string, name: string): Promise<void> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Название колоды не может быть пустым.");
  await kartoDb.decks.update(deckId, { name: cleanName, updatedAt: new Date().toISOString() });
}

export async function deleteDeck(deckId: string): Promise<void> {
  const deck = await kartoDb.decks.get(deckId);
  if (!deck || deck.system) return;
  await kartoDb.transaction(
    "rw",
    [kartoDb.decks, kartoDb.cards, kartoDb.studyProgress, kartoDb.studySessions],
    async () => {
      const cardIds = await kartoDb.cards.where("deckId").equals(deckId).primaryKeys();
      await kartoDb.cards.bulkDelete(cardIds);
      await kartoDb.studyProgress.bulkDelete(cardIds);
      await kartoDb.studySessions.where("deckId").equals(deckId).delete();
      await kartoDb.decks.delete(deckId);
    }
  );
}

export interface CardInput {
  frontText: string;
  backText: string;
  extraSides?: Array<{ id?: string; text: string }>;
  image?: string;
  imageSide?: "front" | "back";
}

export async function saveCard(deckId: string, input: CardInput, cardId?: string): Promise<Card> {
  const frontText = input.frontText.replace(/\s+/g, " ").trim();
  const backText = input.backText.trim();
  if (!frontText || !backText) throw new Error("Заполните лицевую и обратную стороны.");
  const now = new Date().toISOString();
  const existing = cardId ? await kartoDb.cards.get(cardId) : undefined;
  const card: Card = {
    id: existing?.id ?? createId("card"),
    deckId,
    frontText,
    backText,
    extraSides: (input.extraSides ?? [])
      .map((side) => ({ id: side.id ?? createId("side"), text: side.text.trim() }))
      .filter((side) => side.text),
    image: input.image?.trim() || undefined,
    imageSide: input.imageSide ?? "back",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  await kartoDb.transaction("rw", [kartoDb.cards, kartoDb.decks], async () => {
    await kartoDb.cards.put(card);
    await kartoDb.decks.update(deckId, { updatedAt: now });
  });
  return card;
}

export async function deleteCard(cardId: string): Promise<void> {
  await kartoDb.transaction("rw", [kartoDb.cards, kartoDb.studyProgress], async () => {
    await kartoDb.cards.delete(cardId);
    await kartoDb.studyProgress.delete(cardId);
  });
}

