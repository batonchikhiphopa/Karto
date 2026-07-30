import type { ReadingCategoryId } from "../../../shared/reading";

export interface ReadingCategory {
  id: ReadingCategoryId;
  label: string;
}

export const germanCategories: readonly ReadingCategory[] = [
  { id: "gesellschaft", label: "Gesellschaft" },
  { id: "kultur-unterhaltung", label: "Kultur & Unterhaltung" },
  { id: "arbeit-leben", label: "Arbeit & Leben" },
  { id: "technologie", label: "Technologie" },
  { id: "style", label: "Style" }
];
