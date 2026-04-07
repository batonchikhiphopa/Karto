const assert = require("node:assert/strict");

const {
  interpolate,
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
  assert.equal(t("cardForm.searchImages"), "Найти картинки");
}

testTranslatePluralUsesLanguageRules();
testInterpolationReplacesParams();
testFallbackToEnglishWorks();
testNewUiStringsAreLocalized();

console.log("i18n tests passed");
