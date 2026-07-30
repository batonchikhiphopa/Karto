export const materialLanguages = ["de", "en", "ru", "uk"] as const;
export type MaterialLanguage = (typeof materialLanguages)[number];

export const readingCategoryIds = [
  "gesellschaft",
  "kultur-unterhaltung",
  "arbeit-leben",
  "technologie",
  "style"
] as const;
export type ReadingCategoryId = (typeof readingCategoryIds)[number];

export interface ReadingItem {
  id: string;
  sourceId: string;
  sourceLabel: string;
  language: MaterialLanguage;
  categoryId: ReadingCategoryId;
  title: string;
  originalUrl: string;
  publishedAt: string | null;
  author: string | null;
  summary: string | null;
  content: string | null;
  imageUrl: string | null;
  importedAt: string;
}

export interface ReadingProgress {
  itemId: string;
  openedAt: string;
  completedAt: string | null;
  position: number;
}

export interface ReadingSource {
  id: string;
  label: string;
  homepageUrl: string;
  language: MaterialLanguage;
  categoryId: ReadingCategoryId;
  builtIn: boolean;
  enabled: boolean;
  createdAt: string;
}

