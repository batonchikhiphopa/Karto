export type StudyResult = "wrong" | "unsure" | "correct";

export interface ExtraSide {
  id: string;
  text: string;
}

export interface Deck {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  order: number;
  system: boolean;
  cover?: string;
}

export interface Card {
  id: string;
  deckId: string;
  frontText: string;
  backText: string;
  extraSides: ExtraSide[];
  image?: string;
  imageSide: "front" | "back";
  createdAt: string;
  updatedAt: string;
}

export interface StudyProgress {
  cardId: string;
  deckId: string;
  dueAt: string | null;
  intervalDays: number;
  easeFactor: number;
  seenCount: number;
  correctCount: number;
  lapseCount: number;
  lastReviewedAt: string | null;
  lastResult: StudyResult | null;
}

export interface StudySession {
  id: string;
  deckId: string;
  deckName: string;
  startedAt: string;
  finishedAt: string;
  reviewed: number;
  correct: number;
  unsure: number;
  wrong: number;
}

export type AppTheme = "system" | "light" | "dark";

export interface AppSetting {
  id: "preferences";
  interfaceLanguage: "ru" | "en";
  materialLanguage: "de" | "en" | "ru" | "uk";
  theme: AppTheme;
}

export const WORDS_DECK_ID = "system-words";

