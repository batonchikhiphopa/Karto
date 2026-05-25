(function(root) {
  const Karto = root.Karto || (root.Karto = {});

  Karto.CARD_FORM_DEFINITION_SOURCES = Object.freeze({
    en: {
      labelKey: "cardForm.dictLangEn",
      sourceLabel: "dictionaryapi.dev"
    },
    de: {
      labelKey: "cardForm.dictLangDe",
      sourceLabel: "DWDS"
    },
    ru: {
      labelKey: "cardForm.dictLangRu",
      sourceLabel: "Wiktionary"
    }
  });

  Karto.CARD_FORM_TRANSLATION_TARGETS = Object.freeze({
    en: { labelKey: "cardForm.dictLangEn" },
    de: { labelKey: "cardForm.dictLangDe" },
    ru: { labelKey: "cardForm.dictLangRu" }
  });
})(window);
