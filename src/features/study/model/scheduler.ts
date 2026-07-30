import type { StudyProgress, StudyResult } from "../../../shared/library";

const DAY_MS = 86_400_000;
const DEFAULT_EASE = 2.5;

export function defaultProgress(cardId: string, deckId: string): StudyProgress {
  return {
    cardId,
    deckId,
    dueAt: null,
    intervalDays: 0,
    easeFactor: DEFAULT_EASE,
    seenCount: 0,
    correctCount: 0,
    lapseCount: 0,
    lastReviewedAt: null,
    lastResult: null
  };
}

export function isDue(progress: StudyProgress | undefined, now = new Date()): boolean {
  if (!progress?.dueAt || progress.seenCount === 0) return true;
  const dueTime = Date.parse(progress.dueAt);
  return !Number.isFinite(dueTime) || dueTime <= now.getTime();
}

export function scheduleAnswer(
  current: StudyProgress,
  result: StudyResult,
  now = new Date()
): StudyProgress {
  const adjustment = result === "correct" ? 0.1 : result === "wrong" ? -0.25 : -0.15;
  const easeFactor = Math.min(3, Math.max(1.3, Math.round((current.easeFactor + adjustment) * 100) / 100));
  const baseInterval = Math.max(1, current.intervalDays || 1);
  const overdueDays = current.dueAt
    ? Math.max(0, (now.getTime() - Date.parse(current.dueAt)) / DAY_MS)
    : 0;
  const intervalDays = result === "wrong"
    ? 1
    : result === "unsure"
      ? Math.max(1, Math.round(baseInterval + overdueDays * 0.25))
      : current.seenCount === 0
        ? 1
        : Math.max(1, Math.round((baseInterval + overdueDays * 0.5) * easeFactor));

  return {
    ...current,
    seenCount: current.seenCount + 1,
    correctCount: current.correctCount + (result === "correct" ? 1 : 0),
    lapseCount: current.lapseCount + (result === "wrong" ? 1 : 0),
    intervalDays,
    easeFactor,
    lastResult: result,
    lastReviewedAt: now.toISOString(),
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString()
  };
}

