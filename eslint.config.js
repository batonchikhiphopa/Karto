"use strict";

const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**"
    ]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.node,
        Karto: "readonly",
        applyTranslations: "readonly",
        buildDeckExportFilename: "readonly",
        buildLibraryExportFilename: "readonly",
        cancelPendingStudyAnswer: "readonly",
        clearElement: "readonly",
        commitPendingStudyAnswer: "readonly",
        createCard: "readonly",
        createDeck: "readonly",
        createElement: "readonly",
        createExportPayload: "readonly",
        createStudyState: "readonly",
        getCurrentLanguage: "readonly",
        getCurrentStudyCard: "readonly",
        normalizeLanguage: "readonly",
        normalizeSide: "readonly",
        prepareDeckImport: "readonly",
        prepareLibraryImport: "readonly",
        queuePendingStudyAnswer: "readonly",
        saveEditedCardToDeck: "readonly",
        setLanguage: "readonly",
        t: "readonly",
        translatePlural: "readonly",
        undoStudyAnswer: "readonly"
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-control-regex": "off",
      "no-redeclare": "off",
      "no-undef": "off",
      "no-unused-vars": "off"
    }
  }
];
