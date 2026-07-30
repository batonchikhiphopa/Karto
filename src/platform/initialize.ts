import { kartoDb } from "./database";
import { WORDS_DECK_ID, type AppSetting, type Deck } from "../shared/library";
import { seedGermanReading } from "../features/reading/model/reading.seed";
import { defaultReadingSources } from "../features/reading/model/reading.sources";

const defaultPreferences: AppSetting = {
  id: "preferences",
  interfaceLanguage: "ru",
  materialLanguage: "de",
  theme: "system"
};

export async function initializeKartoDatabase(): Promise<void> {
  await kartoDb.open();
  const now = new Date().toISOString();

  await kartoDb.transaction("rw", [kartoDb.decks, kartoDb.settings, kartoDb.readingSources], async () => {
    if (!(await kartoDb.decks.get(WORDS_DECK_ID))) {
      const wordsDeck: Deck = {
        id: WORDS_DECK_ID,
        name: "Слова из чтения",
        createdAt: now,
        updatedAt: now,
        order: -1,
        system: true
      };
      await kartoDb.decks.add(wordsDeck);
    }

    if (!(await kartoDb.settings.get("preferences"))) {
      await kartoDb.settings.add(defaultPreferences);
    }

    for (const source of defaultReadingSources) {
      if (!(await kartoDb.readingSources.get(source.id))) {
        await kartoDb.readingSources.add(source);
      }
    }
  });

  const preferences = await kartoDb.settings.get("preferences");
  document.documentElement.dataset.theme = preferences?.theme ?? "system";
  void seedGermanReading().catch((error) => {
    console.warn("[karto] Reading seed failed:", error);
  });
}
