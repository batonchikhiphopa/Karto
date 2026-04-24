const assert = require("node:assert/strict");

const {
  interpolate,
  resolveInitialLanguage,
  setLanguage,
  t,
  translatePlural
} = require("../i18n.js");

const memoryStorage = {
  values: new Map(),
  getItem(key) {
    return this.values.get(key) || null;
  },
  setItem(key, value) {
    this.values.set(key, String(value));
  }
};

function testTranslatePluralUsesLanguageRules() {
  setLanguage("ru", {
    persist: false,
    refresh: false,
    storage: memoryStorage
  });

  assert.equal(translatePlural("counts.cards", 1, "ru"), "карточка");
  assert.equal(translatePlural("counts.cards", 2, "ru"), "карточки");
  assert.equal(translatePlural("counts.cards", 5, "ru"), "карточек");
}

function testInterpolationReplacesParams() {
  assert.equal(
    interpolate("Moved {added} cards. Skipped duplicates: {skipped}.", { added: 3, skipped: 1 }),
    "Moved 3 cards. Skipped duplicates: 1."
  );
}

function testFallbackToEnglishWorks() {
  setLanguage("de", {
    persist: false,
    refresh: false,
    storage: memoryStorage
  });

  assert.equal(t("test.fallbackOnly"), "Fallback works");
}

function testNewUiStringsAreLocalized() {
  setLanguage("ru", {
    persist: false,
    refresh: false,
    storage: memoryStorage
  });

  assert.equal(t("actions.share"), "Поделиться");
  assert.equal(t("cardForm.subtitle"), "Лицевая сторона, ответ и картинка.");
  assert.equal(t("editDeck.subtitle"), "Карточки и учёба.");
  assert.equal(t("editDeck.draftHint"), "Назови колоду, чтобы начать добавлять карточки.");
  assert.equal(t("cardForm.searchImages"), "Найти картинки");
  assert.equal(t("settings.windowMode"), "Режим окна");
  assert.equal(t("settings.subtitle"), "Язык, окно, раскладка и тема.");
  assert.equal(t("settings.homeTilesPerRow"), "Тайлов на главной в ряд");
  assert.equal(t("settings.saveChanges"), "Сохранить изменения");
  assert.equal(t("sidebar.quitApp"), "Выйти");
  assert.equal(t("alerts.settingsSaved"), "Настройки сохранены.");
  assert.equal(t("cardForm.addAnswerSide"), "Добавить дополнительную сторону");
  assert.equal(t("cardForm.answerSideLabel", { number: 2 }), "Дополнительная сторона 2");
  assert.equal(t("cardForm.textLimitError"), "Текста слишком много, пожалуйста, добавьте extra_side.");
  assert.equal(t("alerts.textLimitExceeded"), "Текста слишком много, пожалуйста, добавьте extra_side.");
  assert.equal(t("actions.moveCard"), "Переместить карточку");
  assert.equal(t("editDeck.moveConfirm"), "Переместить");
  assert.equal(
    t("alerts.cardMoveSkipped", { deckName: "Deutsch" }),
    "Карточка не перемещена. В колоде \"Deutsch\" уже есть дубликат."
  );
}

function testAdditionalSideTerminology() {
  ["en", "ru", "de"].forEach((lang) => {
    setLanguage(lang, {
      persist: false,
      refresh: false,
      storage: memoryStorage
    });

    const labels = [
      t("cardForm.addAnswerSide"),
      t("cardForm.answerSideLabel", { number: 2 }),
      t("cardForm.answerSidePlaceholder", { number: 2 }),
      t("cardForm.removeAnswerSide", { number: 2 }),
      t("cardForm.extraSideLimit"),
      t("cardForm.textLimitHint"),
      t("alerts.textLimitExceeded")
    ].join(" ");

    const forbiddenTerms = new RegExp([
      "answer\\s+side",
      "сторон[ауы]? ответа",
      "antwort" + "seite",
      "antwort" + "seiten"
    ].join("|"), "i");

    assert.equal(forbiddenTerms.test(labels), false);
  });
}

function testResolveInitialLanguageCanBypassStorage() {
  memoryStorage.setItem("language", "de");

  assert.equal(
    resolveInitialLanguage({
      storage: null,
      navigator: { language: "ru-RU" }
    }),
    "ru"
  );
}

function testSetLanguageWithPersistFalseDoesNotWriteStorage() {
  memoryStorage.values.clear();

  setLanguage("de", {
    persist: false,
    refresh: false,
    storage: memoryStorage
  });

  assert.equal(memoryStorage.getItem("language"), null);
}

testTranslatePluralUsesLanguageRules();
testInterpolationReplacesParams();
testFallbackToEnglishWorks();
testNewUiStringsAreLocalized();
testAdditionalSideTerminology();
testResolveInitialLanguageCanBypassStorage();
testSetLanguageWithPersistFalseDoesNotWriteStorage();

console.log("i18n tests passed");
