import { kartoDb } from "../../../platform/database";
import { createId } from "../../../shared/ids";
import type { StudyProgress, StudyResult, StudySession } from "../../../shared/library";
import { defaultProgress, isDue, scheduleAnswer } from "./scheduler";

export async function getDueCardIds(deckId: string): Promise<string[]> {
  const cards = await kartoDb.cards.where("deckId").equals(deckId).toArray();
  const progressEntries = await kartoDb.studyProgress.bulkGet(cards.map((card) => card.id));
  return cards
    .filter((card, index) => isDue(progressEntries[index]))
    .map((card) => card.id);
}

export async function gradeCard(cardId: string, deckId: string, result: StudyResult): Promise<{
  previous: StudyProgress | undefined;
  next: StudyProgress;
}> {
  const previous = await kartoDb.studyProgress.get(cardId);
  const next = scheduleAnswer(previous ?? defaultProgress(cardId, deckId), result);
  await kartoDb.studyProgress.put(next);
  return { previous, next };
}

export async function restoreProgress(cardId: string, previous: StudyProgress | undefined): Promise<void> {
  if (previous) await kartoDb.studyProgress.put(previous);
  else await kartoDb.studyProgress.delete(cardId);
}

export async function saveStudySession(
  session: Omit<StudySession, "id" | "finishedAt">
): Promise<void> {
  await kartoDb.studySessions.add({
    ...session,
    id: createId("session"),
    finishedAt: new Date().toISOString()
  });
}

