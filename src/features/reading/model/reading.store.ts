import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MaterialLanguage, ReadingCategoryId } from "../../../shared/reading";

interface ReadingUiState {
  materialLanguage: MaterialLanguage;
  categoryId: ReadingCategoryId | "all";
  setMaterialLanguage: (language: MaterialLanguage) => void;
  setCategoryId: (categoryId: ReadingCategoryId | "all") => void;
}

export const useReadingUiStore = create<ReadingUiState>()(
  persist(
    (set) => ({
      materialLanguage: "de",
      categoryId: "all",
      setMaterialLanguage: (materialLanguage) => set({ materialLanguage, categoryId: "all" }),
      setCategoryId: (categoryId) => set({ categoryId })
    }),
    { name: "karto-reading-ui" }
  )
);
