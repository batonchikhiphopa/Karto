(function(root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root && typeof root === "object") {
    Object.assign(root, api);
  }
})(typeof window !== "undefined" ? window : globalThis, function(root) {
  const SUPPORTED_LANGS = ["ru", "en", "de"];
  const FALLBACK_LANG = "en";

  const TRANSLATIONS = {
    en: {
      meta: {
        title: "Karto",
        logoAlt: "Karto logo"
      },
      sidebar: {
        open: "Open navigation",
        close: "Close navigation"
      },
      nav: {
        home: "Home",
        library: "Library",
        settings: "Settings"
      },
      common: {
        back: "Back",
        loading: "Loading...",
        undo: "Undo",
        close: "Close"
      },
      actions: {
        edit: "Edit",
        delete: "Delete"
      },
      counts: {
        cards: {
          one: "card",
          other: "cards"
        }
      },
      home: {
        subtitle: "Study your decks with Karto.",
        createDeck: "New deck"
      },
      library: {
        title: "Library",
        subtitle: "Manage decks, exports, and imports.",
        createDeck: "+ Create deck",
        createCard: "+ Create card",
        merge: "Merge decks",
        exportAll: "Export decks",
        exportCsv: "Export CSV",
        importAll: "Import decks",
        empty: "No decks yet. Create your first one!"
      },
      editDeck: {
        title: "Deck editor",
        subtitle: "Sort, search, and study cards from one place.",
        createCard: "+ Create card",
        addFromOther: "+ Add from another deck",
        export: "Export",
        exportCsv: "Export CSV",
        import: "Import",
        empty: "No cards yet. Create your first one!",
        namePlaceholder: "Deck name",
        saveName: "Save",
        searchPlaceholder: "Search cards..."
      },
      bulk: {
        noneSelected: "No cards selected",
        selectAll: "Select all",
        deleteSelected: "Delete selected",
        moveSelected: "Move selected",
        moveToDeckPlaceholder: "Move to deck",
        selectedSummary: "{count} selected"
      },
      settings: {
        title: "Settings",
        subtitle: "Choose language, theme, and review recent study sessions.",
        language: "Interface language",
        reset: "Reset all data",
        languageOptionEn: "English",
        languageOptionDe: "Deutsch",
        languageOptionRu: "Русский",
        theme: "Theme",
        themeSystem: "System",
        themeDark: "Dark",
        themeLight: "Light",
        sessionHistory: "Session history",
        emptySessions: "No study sessions yet."
      },
      cardForm: {
        titleCreate: "Create card",
        titleEdit: "Edit card",
        subtitle: "Build the front and back, then preview before saving.",
        frontLabel: "Front side",
        frontPlaceholder: "Word or question",
        backLabel: "Back side",
        backPlaceholder: "Definition or answer",
        imageLabel: "Image (URL)",
        imagePlaceholder: "Paste a link or choose below",
        deckLabel: "Deck",
        getDefinition: "Get definition",
        searchImages: "Find images",
        save: "Save card",
        imageSelectTitle: "Click to select",
        dictLang: "Dictionary language",
        dictLangEn: "English",
        dictLangDe: "Deutsch",
        dictLangRu: "Русский",
        uploadImage: "Upload image",
        addCard: "Add card",
        previewTitle: "Live preview",
        flipPreview: "Flip preview",
        clearImage: "Clear image"
      },
      createDeck: {
        title: "Create deck",
        nameLabel: "Name",
        namePlaceholder: "Deck name",
        save: "Create"
      },
      merge: {
        title: "Merge decks",
        selectLabel: "Choose decks to merge",
        newNameLabel: "New deck name",
        namePlaceholder: "Name",
        confirm: "Merge"
      },
      addFromOther: {
        title: "Add from another deck",
        subtitle: "Copy cards from one deck into another.",
        sourceDeck: "Source deck",
        addCard: "+ Add",
        empty: "No cards"
      },
      study: {
        title: "Study mode",
        close: "Close study mode",
        wrong: "Don't know",
        correct: "Know it",
        unsure: "Not sure",
        back: "Back",
        question: "Question",
        answer: "Answer",
        hintFront: "Press Space or Enter to flip the card",
        hintBack: "Use arrows or keys 1/2/3 to answer",
        emptyQueue: "Queue is empty",
        startStudy: "Start study",
        startModeLabel: "Study mode",
        modeAll: "All cards",
        modeNew: "New cards only",
        modeReview: "Review",
        stats: "{reviewed} reviewed • {percent}% correct • mode: {mode}",
        sessionEntry: "{reviewed} reviewed • {percent}% correct"
      },
      alerts: {
        invalidJson: "The file is corrupted or has an invalid format.",
        libraryImportSummary: "Imported decks: {added}. Skipped duplicates: {skipped}.",
        deckImportSummary: "Imported cards: {added}. Skipped duplicates: {skipped}.",
        noDecksExport: "No decks to export.",
        invalidFormat: "Invalid file format.",
        enterDeckName: "Enter a deck name.",
        enterName: "Enter a name.",
        deckNameSaved: "Deck name saved.",
        requiredFields: "Fill in the required fields.",
        chooseDeck: "Choose a deck.",
        enterFrontWord: "Enter a word on the front side.",
        definitionNotFound: "Definition not found.",
        serverUnavailable: "Server is unavailable. Start `node server.js`.",
        nothingFound: "Nothing found.",
        needTwoDecks: "You need at least 2 decks to merge.",
        chooseTwoDecks: "Choose at least 2 decks.",
        noOtherDecks: "No other decks.",
        cardAdded: "Card \"{frontText}\" added.",
        confirmReset: "All data was cleared.",
        emptyDeckStudy: "This deck has no cards yet.",
        deckDeleted: "Deck \"{name}\" deleted.",
        cardDeleted: "Card deleted.",
        cardsDeleted: "Deleted {count} cards.",
        cardsMoved: "Moved {added} cards. Skipped duplicates: {skipped}.",
        resetUndone: "Data restored.",
        deckCreated: "Deck created.",
        cardSaved: "Card saved.",
        invalidImageUrl: "Use an http(s) or data:image URL.",
        noCardsForMode: "No cards match the selected study mode.",
        deckMerged: "Decks merged into \"{name}\"."
      },
      test: {
        fallbackOnly: "Fallback works"
      }
    },
    ru: {
      meta: {
        title: "Karto",
        logoAlt: "Логотип Karto"
      },
      sidebar: {
        open: "Открыть навигацию",
        close: "Закрыть навигацию"
      },
      nav: {
        home: "Главная",
        library: "Библиотека",
        settings: "Настройки"
      },
      common: {
        back: "Назад",
        loading: "Загрузка...",
        undo: "Отменить",
        close: "Закрыть"
      },
      actions: {
        edit: "Изменить",
        delete: "Удалить"
      },
      counts: {
        cards: {
          one: "карточка",
          few: "карточки",
          many: "карточек",
          other: "карточки"
        }
      },
      home: {
        subtitle: "Учи колоды в Karto.",
        createDeck: "Новая колода"
      },
      library: {
        title: "Библиотека",
        subtitle: "Управляй колодами, экспортом и импортом.",
        createDeck: "+ Создать колоду",
        createCard: "+ Создать карточку",
        merge: "Объединить колоды",
        exportAll: "Экспорт колод",
        exportCsv: "Экспорт CSV",
        importAll: "Импорт колод",
        empty: "Колод пока нет. Создай первую!"
      },
      editDeck: {
        title: "Редактор колоды",
        subtitle: "Сортируй, ищи и учи карточки в одном месте.",
        createCard: "+ Создать карточку",
        addFromOther: "+ Добавить из другой колоды",
        export: "Экспорт",
        exportCsv: "Экспорт CSV",
        import: "Импорт",
        empty: "Карточек пока нет. Создай первую!",
        namePlaceholder: "Название колоды",
        saveName: "Сохранить",
        searchPlaceholder: "Поиск карточек..."
      },
      bulk: {
        noneSelected: "Карточки не выбраны",
        selectAll: "Выбрать все",
        deleteSelected: "Удалить выбранные",
        moveSelected: "Переместить выбранные",
        moveToDeckPlaceholder: "Переместить в колоду",
        selectedSummary: "Выбрано: {count}"
      },
      settings: {
        title: "Настройки",
        subtitle: "Выбери язык, тему и просмотри недавние сессии.",
        language: "Язык интерфейса",
        reset: "Сбросить все данные",
        languageOptionEn: "English",
        languageOptionDe: "Deutsch",
        languageOptionRu: "Русский",
        theme: "Тема",
        themeSystem: "Системная",
        themeDark: "Тёмная",
        themeLight: "Светлая",
        sessionHistory: "История сессий",
        emptySessions: "Учебных сессий пока нет."
      },
      cardForm: {
        titleCreate: "Создать карточку",
        titleEdit: "Редактировать карточку",
        subtitle: "Заполни обе стороны и проверь превью перед сохранением.",
        frontLabel: "Лицевая сторона",
        frontPlaceholder: "Слово или вопрос",
        backLabel: "Обратная сторона",
        backPlaceholder: "Определение или ответ",
        imageLabel: "Изображение (URL)",
        imagePlaceholder: "Вставь ссылку или выбери ниже",
        deckLabel: "Колода",
        getDefinition: "Получить определение",
        searchImages: "Найти картинки",
        save: "Сохранить карточку",
        imageSelectTitle: "Нажми, чтобы выбрать",
        dictLang: "Язык словаря",
        dictLangEn: "English",
        dictLangDe: "Deutsch",
        dictLangRu: "Русский",
        uploadImage: "Загрузить картинку",
        addCard: "Добавить карточку",
        previewTitle: "Живое превью",
        flipPreview: "Перевернуть превью",
        clearImage: "Очистить изображение"
      },
      createDeck: {
        title: "Создать колоду",
        nameLabel: "Название",
        namePlaceholder: "Название колоды",
        save: "Создать"
      },
      merge: {
        title: "Объединить колоды",
        selectLabel: "Выбери колоды для объединения",
        newNameLabel: "Название новой колоды",
        namePlaceholder: "Название",
        confirm: "Объединить"
      },
      addFromOther: {
        title: "Добавить из другой колоды",
        subtitle: "Скопируй карточки из одной колоды в другую.",
        sourceDeck: "Исходная колода",
        addCard: "+ Добавить",
        empty: "Карточек нет"
      },
      study: {
        title: "Режим изучения",
        close: "Закрыть режим изучения",
        wrong: "Не знаю",
        correct: "Знаю",
        unsure: "Не уверен",
        back: "Назад",
        question: "Вопрос",
        answer: "Ответ",
        hintFront: "Нажми Space или Enter, чтобы перевернуть карточку",
        hintBack: "Используй стрелки или клавиши 1/2/3 для ответа",
        emptyQueue: "Очередь пуста",
        startStudy: "Начать изучение",
        startModeLabel: "Режим изучения",
        modeAll: "Все карточки",
        modeNew: "Только новые",
        modeReview: "Повторение",
        stats: "Просмотрено: {reviewed} • {percent}% верно • режим: {mode}",
        sessionEntry: "Просмотрено: {reviewed} • {percent}% верно"
      },
      alerts: {
        invalidJson: "Файл повреждён или имеет неверный формат.",
        libraryImportSummary: "Импортировано колод: {added}. Пропущено дубликатов: {skipped}.",
        deckImportSummary: "Импортировано карточек: {added}. Пропущено дубликатов: {skipped}.",
        noDecksExport: "Нет колод для экспорта.",
        invalidFormat: "Неверный формат файла.",
        enterDeckName: "Введи название колоды.",
        enterName: "Введи название.",
        deckNameSaved: "Название колоды сохранено.",
        requiredFields: "Заполни обязательные поля.",
        chooseDeck: "Выбери колоду.",
        enterFrontWord: "Введи слово на лицевой стороне.",
        definitionNotFound: "Определение не найдено.",
        serverUnavailable: "Сервер недоступен. Запусти `node server.js`.",
        nothingFound: "Ничего не найдено.",
        needTwoDecks: "Для объединения нужно минимум две колоды.",
        chooseTwoDecks: "Выбери минимум две колоды.",
        noOtherDecks: "Других колод нет.",
        cardAdded: "Карточка \"{frontText}\" добавлена.",
        confirmReset: "Все данные очищены.",
        emptyDeckStudy: "В этой колоде пока нет карточек.",
        deckDeleted: "Колода \"{name}\" удалена.",
        cardDeleted: "Карточка удалена.",
        cardsDeleted: "Удалено карточек: {count}.",
        cardsMoved: "Перемещено карточек: {added}. Пропущено дубликатов: {skipped}.",
        resetUndone: "Данные восстановлены.",
        deckCreated: "Колода создана.",
        cardSaved: "Карточка сохранена.",
        invalidImageUrl: "Используй URL формата http(s) или data:image.",
        noCardsForMode: "Для выбранного режима подходящих карточек нет.",
        deckMerged: "Колоды объединены в \"{name}\"."
      }
    },
    de: {
      meta: {
        title: "Karto",
        logoAlt: "Karto-Logo"
      },
      sidebar: {
        open: "Navigation öffnen",
        close: "Navigation schließen"
      },
      nav: {
        home: "Start",
        library: "Bibliothek",
        settings: "Einstellungen"
      },
      common: {
        back: "Zurück",
        loading: "Wird geladen...",
        undo: "Rückgängig",
        close: "Schließen"
      },
      actions: {
        edit: "Bearbeiten",
        delete: "Löschen"
      },
      counts: {
        cards: {
          one: "Karte",
          other: "Karten"
        }
      },
      home: {
        subtitle: "Lerne deine Decks mit Karto.",
        createDeck: "Neues Deck"
      },
      library: {
        title: "Bibliothek",
        subtitle: "Verwalte Decks, Exporte und Importe.",
        createDeck: "+ Deck erstellen",
        createCard: "+ Karte erstellen",
        merge: "Decks zusammenführen",
        exportAll: "Decks exportieren",
        exportCsv: "CSV exportieren",
        importAll: "Decks importieren",
        empty: "Noch keine Decks. Erstelle dein erstes!"
      },
      editDeck: {
        title: "Deck-Editor",
        subtitle: "Sortiere, suche und lerne Karten an einem Ort.",
        createCard: "+ Karte erstellen",
        addFromOther: "+ Aus anderem Deck hinzufügen",
        export: "Exportieren",
        exportCsv: "CSV exportieren",
        import: "Importieren",
        empty: "Noch keine Karten. Erstelle deine erste!",
        namePlaceholder: "Deckname",
        saveName: "Speichern",
        searchPlaceholder: "Karten suchen..."
      },
      bulk: {
        noneSelected: "Keine Karten ausgewählt",
        selectAll: "Alle auswählen",
        deleteSelected: "Ausgewählte löschen",
        moveSelected: "Ausgewählte verschieben",
        moveToDeckPlaceholder: "In Deck verschieben",
        selectedSummary: "{count} ausgewählt"
      },
      settings: {
        title: "Einstellungen",
        subtitle: "Wähle Sprache, Thema und sieh dir letzte Lernsitzungen an.",
        language: "Sprache der Oberfläche",
        reset: "Alle Daten zurücksetzen",
        languageOptionEn: "English",
        languageOptionDe: "Deutsch",
        languageOptionRu: "Русский",
        theme: "Thema",
        themeSystem: "System",
        themeDark: "Dunkel",
        themeLight: "Hell",
        sessionHistory: "Sitzungsverlauf",
        emptySessions: "Noch keine Lernsitzungen."
      },
      cardForm: {
        titleCreate: "Karte erstellen",
        titleEdit: "Karte bearbeiten",
        subtitle: "Fülle Vorder- und Rückseite aus und prüfe die Vorschau vor dem Speichern.",
        frontLabel: "Vorderseite",
        frontPlaceholder: "Wort oder Frage",
        backLabel: "Rückseite",
        backPlaceholder: "Definition oder Antwort",
        imageLabel: "Bild (URL)",
        imagePlaceholder: "Link einfügen oder unten auswählen",
        deckLabel: "Deck",
        getDefinition: "Definition holen",
        searchImages: "Bilder suchen",
        save: "Karte speichern",
        imageSelectTitle: "Zum Auswählen klicken",
        dictLang: "Wörterbuchsprache",
        dictLangEn: "English",
        dictLangDe: "Deutsch",
        dictLangRu: "Русский",
        uploadImage: "Bild hochladen",
        addCard: "Karte hinzufügen",
        previewTitle: "Live-Vorschau",
        flipPreview: "Vorschau drehen",
        clearImage: "Bild entfernen"
      },
      createDeck: {
        title: "Deck erstellen",
        nameLabel: "Name",
        namePlaceholder: "Deckname",
        save: "Erstellen"
      },
      merge: {
        title: "Decks zusammenführen",
        selectLabel: "Wähle Decks zum Zusammenführen",
        newNameLabel: "Name des neuen Decks",
        namePlaceholder: "Name",
        confirm: "Zusammenführen"
      },
      addFromOther: {
        title: "Aus anderem Deck hinzufügen",
        subtitle: "Kopiere Karten aus einem Deck in ein anderes.",
        sourceDeck: "Quelldeck",
        addCard: "+ Hinzufügen",
        empty: "Keine Karten"
      },
      study: {
        title: "Lernmodus",
        close: "Lernmodus schließen",
        wrong: "Weiß ich nicht",
        correct: "Kann ich",
        unsure: "Unsicher",
        back: "Zurück",
        question: "Frage",
        answer: "Antwort",
        hintFront: "Drücke Leertaste oder Enter, um die Karte umzudrehen",
        hintBack: "Nutze Pfeiltasten oder 1/2/3 für deine Antwort",
        emptyQueue: "Die Warteschlange ist leer",
        startStudy: "Lernen starten",
        startModeLabel: "Lernmodus",
        modeAll: "Alle Karten",
        modeNew: "Nur neue Karten",
        modeReview: "Wiederholen",
        stats: "{reviewed} gelernt • {percent}% richtig • Modus: {mode}",
        sessionEntry: "{reviewed} gelernt • {percent}% richtig"
      },
      alerts: {
        invalidJson: "Die Datei ist beschädigt oder hat ein ungültiges Format.",
        libraryImportSummary: "Importierte Decks: {added}. Übersprungene Duplikate: {skipped}.",
        deckImportSummary: "Importierte Karten: {added}. Übersprungene Duplikate: {skipped}.",
        noDecksExport: "Keine Decks zum Exportieren.",
        invalidFormat: "Ungültiges Dateiformat.",
        enterDeckName: "Gib einen Decknamen ein.",
        enterName: "Gib einen Namen ein.",
        deckNameSaved: "Deckname gespeichert.",
        requiredFields: "Fülle die Pflichtfelder aus.",
        chooseDeck: "Wähle ein Deck.",
        enterFrontWord: "Gib ein Wort auf der Vorderseite ein.",
        definitionNotFound: "Definition nicht gefunden.",
        serverUnavailable: "Server ist nicht verfügbar. Starte `node server.js`.",
        nothingFound: "Nichts gefunden.",
        needTwoDecks: "Zum Zusammenführen brauchst du mindestens zwei Decks.",
        chooseTwoDecks: "Wähle mindestens zwei Decks.",
        noOtherDecks: "Keine anderen Decks vorhanden.",
        cardAdded: "Karte \"{frontText}\" hinzugefügt.",
        confirmReset: "Alle Daten wurden gelöscht.",
        emptyDeckStudy: "Dieses Deck hat noch keine Karten.",
        deckDeleted: "Deck \"{name}\" gelöscht.",
        cardDeleted: "Karte gelöscht.",
        cardsDeleted: "{count} Karten gelöscht.",
        cardsMoved: "{added} Karten verschoben. Übersprungene Duplikate: {skipped}.",
        resetUndone: "Daten wiederhergestellt.",
        deckCreated: "Deck erstellt.",
        cardSaved: "Karte gespeichert.",
        invalidImageUrl: "Verwende eine URL mit http(s) oder data:image.",
        noCardsForMode: "Für den gewählten Lernmodus gibt es keine passenden Karten.",
        deckMerged: "Decks wurden zu \"{name}\" zusammengeführt."
      }
    }
  };

  let currentLanguage = FALLBACK_LANG;

  function getStorage() {
    try {
      return root.localStorage || null;
    } catch {
      return null;
    }
  }

  function hasDom() {
    return !!(root && root.document);
  }

  function normalizeLanguage(value) {
    if (typeof value !== "string") return null;
    const normalized = value.trim().toLowerCase().split(/[-_]/)[0];
    return SUPPORTED_LANGS.includes(normalized) ? normalized : null;
  }

  function resolveNavigatorLanguage(navigatorObject = root.navigator) {
    if (!navigatorObject) return FALLBACK_LANG;

    const candidates = Array.isArray(navigatorObject.languages) && navigatorObject.languages.length
      ? navigatorObject.languages
      : [navigatorObject.language];

    for (const candidate of candidates) {
      const normalized = normalizeLanguage(candidate);
      if (normalized) return normalized;
    }

    return FALLBACK_LANG;
  }

  function resolveInitialLanguage(options = {}) {
    const storage = options.storage || getStorage();
    const saved = normalizeLanguage(storage?.getItem?.("language"));
    return saved || resolveNavigatorLanguage(options.navigator || root.navigator);
  }

  function getTranslationValue(lang, key) {
    return key
      .split(".")
      .reduce((acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined), TRANSLATIONS[lang]);
  }

  function interpolate(template, params = {}) {
    return template.replace(/\{(\w+)\}/g, (match, name) => {
      const value = params[name];
      return value === undefined || value === null ? match : String(value);
    });
  }

  function t(key, params = {}) {
    const value =
      getTranslationValue(currentLanguage, key) ??
      getTranslationValue(FALLBACK_LANG, key) ??
      key;

    return typeof value === "string" ? interpolate(value, params) : key;
  }

  function translatePlural(key, count, lang = currentLanguage) {
    const forms =
      getTranslationValue(lang, key) ??
      getTranslationValue(FALLBACK_LANG, key);

    if (!forms || typeof forms !== "object") return "";

    const category = new Intl.PluralRules(lang).select(count);
    return forms[category] || forms.other || "";
  }

  function collectTranslatableNodes(rootNode) {
    if (!rootNode || typeof rootNode !== "object") return [];

    const selector = "[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-alt], [data-i18n-aria-label]";
    const nodes = [];
    const ElementCtor = typeof Element !== "undefined" ? Element : null;

    if (ElementCtor && rootNode instanceof ElementCtor && rootNode.matches(selector)) {
      nodes.push(rootNode);
    }

    if (typeof rootNode.querySelectorAll === "function") {
      nodes.push(...rootNode.querySelectorAll(selector));
    }

    return nodes;
  }

  function applyTranslations(rootNode = hasDom() ? root.document : null) {
    if (!hasDom() || !rootNode) return;

    collectTranslatableNodes(rootNode).forEach((node) => {
      if (node.dataset.i18n) {
        node.textContent = t(node.dataset.i18n);
      }

      if (node.dataset.i18nPlaceholder) {
        node.placeholder = t(node.dataset.i18nPlaceholder);
      }

      if (node.dataset.i18nTitle) {
        node.title = t(node.dataset.i18nTitle);
      }

      if (node.dataset.i18nAlt) {
        node.alt = t(node.dataset.i18nAlt);
      }

      if (node.dataset.i18nAriaLabel) {
        node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
      }
    });

    const title = root.document.querySelector("title[data-i18n]");
    if (title) {
      title.textContent = t(title.dataset.i18n);
    }

    root.document.documentElement.lang = currentLanguage;

    const languageSelect = root.document.getElementById("languageSelect");
    if (languageSelect) {
      languageSelect.value = currentLanguage;
    }
  }

  function getCurrentLanguage() {
    return currentLanguage;
  }

  function setLanguage(lang, options = {}) {
    const normalized = normalizeLanguage(lang) || FALLBACK_LANG;
    const persist = options.persist !== false;
    const refresh = options.refresh !== false;
    const storage = options.storage || getStorage();

    currentLanguage = normalized;

    if (persist) {
      storage?.setItem?.("language", normalized);
    }

    if (hasDom()) {
      applyTranslations(root.document);
    }

    if (refresh && typeof root.refreshLocalizedUI === "function") {
      root.refreshLocalizedUI();
    }

    return currentLanguage;
  }

  return {
    SUPPORTED_LANGS,
    FALLBACK_LANG,
    TRANSLATIONS,
    normalizeLanguage,
    resolveNavigatorLanguage,
    resolveInitialLanguage,
    getTranslationValue,
    interpolate,
    t,
    translatePlural,
    applyTranslations,
    getCurrentLanguage,
    setLanguage
  };
});
