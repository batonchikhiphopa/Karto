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
        close: "Close navigation",
        quitApp: "Exit app"
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
        createCard: "Create card",
        edit: "Edit",
        editCard: "Edit card",
        moveCard: "Move card",
        mergeDeck: "Merge deck",
        renameDeck: "Rename deck",
        importDecks: "Import decks",
        delete: "Delete",
        share: "Share"
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
        subtitle: "Decks, import, and sharing.",
        createDeck: "Create deck",
        createCard: "Create card",
        merge: "Merge decks",
        exportAll: "Export decks",
        exportCsv: "Export CSV",
        importAll: "Import decks",
        empty: "No decks yet. Create your first one!"
      },
      editDeck: {
        title: "Deck editor",
        subtitle: "Cards and study.",
        createCard: "Create card",
        addFromOther: "Add from another deck",
        share: "Share deck",
        export: "Export",
        exportCsv: "Export CSV",
        import: "Import",
        empty: "No cards yet. Create your first one!",
        draftHint: "Name the deck to start adding cards.",
        namePlaceholder: "Deck name",
        saveName: "Save",
        searchPlaceholder: "Search cards...",
        moveToDeckLabel: "Move to deck",
        moveConfirm: "Move",
        moveCancel: "Cancel"
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
        subtitle: "Language, desktop, layout, and theme.",
        language: "Interface language",
        languageOptionEn: "English",
        languageOptionDe: "Deutsch",
        languageOptionRu: "Русский",
        theme: "Theme",
        themeSystem: "System",
        themeDark: "Dark",
        themeLight: "Light",
        windowMode: "Window mode",
        windowModeFullscreen: "Fullscreen",
        windowModeWindowed: "Windowed",
        homeTilesPerRow: "Home tiles per row",
        homeTilesAuto: "Auto",
        homeTiles2: "2",
        homeTiles3: "3",
        homeTiles4: "4",
        autoGermanArticle: "Auto-insert article for German nouns",
        saveChanges: "Save changes"
      },
      cardForm: {
        titleCreate: "Create card",
        titleEdit: "Edit card",
        subtitle: "Front, answer, and image.",
        frontLabel: "Front side",
        frontPlaceholder: "Word or question",
        backLabel: "Back side",
        backPlaceholder: "Definition or answer",
        imageLabel: "Image",
        imagePlaceholder: "Paste a link or choose below",
        deckLabel: "Deck",
        getDefinition: "Get meaning",
        translate: "Translate",
        searchImages: "Find images",
        save: "Save card",
        imageSelectTitle: "Click to select",
        dictLang: "Dictionary language",
        dictLangEn: "English",
        dictLangDe: "German",
        dictLangRu: "Russian",
        chooseDefinitionSource: "Choose dictionary source",
        chooseTranslationTarget: "Choose translation language",
        definitionOptionEn: "EN · dictionaryapi.dev",
        definitionOptionDe: "DE · DWDS",
        definitionOptionRu: "RU · Wiktionary",
        translationOptionEn: "EN",
        translationOptionDe: "DE",
        translationOptionRu: "RU",
        definitionSelection: "{language} · {source}",
        translationSelection: "Target: {language}",
        uploadImage: "Upload image",
        imageSideFront: "Show image on the front side",
        imageSideBack: "Show image on the back side",
        addCard: "Add card",
        clearImage: "Clear image"
      },
      createDeck: {
        title: "Create deck",
        subtitle: "Just a name.",
        nameLabel: "Name",
        namePlaceholder: "Deck name",
        save: "Create",
        saveAndEdit: "Create and edit deck"
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
        addCard: "Add",
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
        modeReview: "Review"
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
        enterBackText: "Enter text on the back side.",
        definitionNotFound: "Definition not found.",
        serverUnavailable: "The local lookup service is unavailable. Restart Karto.",
        nothingFound: "Nothing found.",
        needTwoDecks: "You need at least 2 decks to merge.",
        chooseTwoDecks: "Choose at least 2 decks.",
        noOtherDecks: "No other decks.",
        cardAdded: "Card \"{frontText}\" added.",
        emptyDeckStudy: "This deck has no cards yet.",
        deckDeleted: "Deck \"{name}\" deleted.",
        cardDeleted: "Card deleted.",
        cardsDeleted: "Deleted {count} cards.",
        cardsMoved: "Moved {added} cards. Skipped duplicates: {skipped}.",
        cardMoved: "Card moved to \"{deckName}\".",
        cardMoveSkipped: "Card was not moved. A duplicate already exists in \"{deckName}\".",
        deckCreated: "Deck created.",
        cardSaved: "Card saved.",
        invalidImageUrl: "Use an http(s) or data:image URL.",
        noCardsForMode: "No cards match the selected study mode.",
        deckMerged: "Decks merged into \"{name}\".",
        deckShared: "Deck shared.",
        deckJsonCopied: "Deck JSON copied.",
        shareUnavailable: "Sharing is unavailable here.",
        translationUnavailable: "Translation is unavailable.",
        windowModeUnavailable: "Window mode could not be updated.",
        settingsSaved: "Settings saved.",
        settingsSaveFailed: "Settings could not be saved.",
        quitUnavailable: "The app could not be closed."
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
        close: "Закрыть навигацию",
        quitApp: "Выйти"
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
        createCard: "Создать карточку",
        edit: "Изменить",
        editCard: "Изменить карточку",
        moveCard: "Переместить карточку",
        mergeDeck: "Объединить колоду",
        renameDeck: "Переименовать колоду",
        importDecks: "Импорт колод",
        delete: "Удалить",
        share: "Поделиться"
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
        subtitle: "Колоды, импорт и обмен.",
        createDeck: "Создать колоду",
        createCard: "Создать карточку",
        merge: "Объединить колоды",
        exportAll: "Экспорт колод",
        exportCsv: "Экспорт CSV",
        importAll: "Импорт колод",
        empty: "Колод пока нет. Создай первую!"
      },
      editDeck: {
        title: "Редактор колоды",
        subtitle: "Карточки и учёба.",
        createCard: "Создать карточку",
        addFromOther: "Добавить из другой колоды",
        share: "Поделиться колодой",
        export: "Экспорт",
        exportCsv: "Экспорт CSV",
        import: "Импорт",
        empty: "Карточек пока нет. Создай первую!",
        draftHint: "Назови колоду, чтобы начать добавлять карточки.",
        namePlaceholder: "Название колоды",
        saveName: "Сохранить",
        searchPlaceholder: "Поиск карточек...",
        moveToDeckLabel: "Переместить в колоду",
        moveConfirm: "Переместить",
        moveCancel: "Отмена"
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
        subtitle: "Язык, окно, раскладка и тема.",
        language: "Язык интерфейса",
        languageOptionEn: "English",
        languageOptionDe: "Deutsch",
        languageOptionRu: "Русский",
        theme: "Тема",
        themeSystem: "Системная",
        themeDark: "Тёмная",
        themeLight: "Светлая",
        windowMode: "Режим окна",
        windowModeFullscreen: "Полный экран",
        windowModeWindowed: "Оконный",
        homeTilesPerRow: "Тайлов на главной в ряд",
        homeTilesAuto: "Авто",
        homeTiles2: "2",
        homeTiles3: "3",
        homeTiles4: "4",
        autoGermanArticle: "Автоподстановка артикля для немецких существительных",
        saveChanges: "Сохранить изменения"
      },
      cardForm: {
        titleCreate: "Создать карточку",
        titleEdit: "Изменить карточку",
        subtitle: "Лицевая сторона, ответ и картинка.",
        frontLabel: "Лицевая сторона",
        frontPlaceholder: "Слово или вопрос",
        backLabel: "Обратная сторона",
        backPlaceholder: "Определение или ответ",
        imageLabel: "Изображение",
        imagePlaceholder: "Вставь ссылку или выбери ниже",
        deckLabel: "Колода",
        getDefinition: "Получить толкование",
        translate: "Перевести",
        searchImages: "Найти картинки",
        save: "Сохранить карточку",
        imageSelectTitle: "Нажми, чтобы выбрать",
        dictLang: "Язык словаря",
        dictLangEn: "Английский",
        dictLangDe: "Немецкий",
        dictLangRu: "Русский",
        chooseDefinitionSource: "Выбрать источник словаря",
        chooseTranslationTarget: "Выбрать язык перевода",
        definitionOptionEn: "EN · dictionaryapi.dev",
        definitionOptionDe: "DE · DWDS",
        definitionOptionRu: "RU · Wiktionary",
        translationOptionEn: "EN",
        translationOptionDe: "DE",
        translationOptionRu: "RU",
        definitionSelection: "{language} · {source}",
        translationSelection: "Цель: {language}",
        uploadImage: "Загрузить картинку",
        imageSideFront: "Показывать картинку на лицевой стороне",
        imageSideBack: "Показывать картинку на обратной стороне",
        addCard: "Добавить карточку",
        clearImage: "Очистить изображение"
      },
      createDeck: {
        title: "Создать колоду",
        subtitle: "Только название.",
        nameLabel: "Название",
        namePlaceholder: "Название колоды",
        save: "Создать",
        saveAndEdit: "Создать и перейти к редактированию колоды"
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
        addCard: "Добавить",
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
        modeReview: "Повторение"
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
        enterBackText: "Введи текст на обратной стороне.",
        definitionNotFound: "Определение не найдено.",
        serverUnavailable: "Локальный сервис поиска недоступен. Перезапусти Karto.",
        nothingFound: "Ничего не найдено.",
        needTwoDecks: "Для объединения нужно минимум две колоды.",
        chooseTwoDecks: "Выбери минимум две колоды.",
        noOtherDecks: "Других колод нет.",
        cardAdded: "Карточка \"{frontText}\" добавлена.",
        emptyDeckStudy: "В этой колоде пока нет карточек.",
        deckDeleted: "Колода \"{name}\" удалена.",
        cardDeleted: "Карточка удалена.",
        cardsDeleted: "Удалено карточек: {count}.",
        cardsMoved: "Перемещено карточек: {added}. Пропущено дубликатов: {skipped}.",
        cardMoved: "Карточка перемещена в колоду \"{deckName}\".",
        cardMoveSkipped: "Карточка не перемещена. В колоде \"{deckName}\" уже есть дубликат.",
        deckCreated: "Колода создана.",
        cardSaved: "Карточка сохранена.",
        invalidImageUrl: "Используй URL формата http(s) или data:image.",
        noCardsForMode: "Для выбранного режима подходящих карточек нет.",
        deckMerged: "Колоды объединены в \"{name}\".",
        deckShared: "Колода отправлена.",
        deckJsonCopied: "JSON колоды скопирован.",
        shareUnavailable: "Поделиться здесь не получилось.",
        translationUnavailable: "Перевод недоступен.",
        windowModeUnavailable: "Не удалось переключить режим окна.",
        settingsSaved: "Настройки сохранены.",
        settingsSaveFailed: "Не удалось сохранить настройки.",
        quitUnavailable: "Не удалось закрыть приложение."
      }
    },
    de: {
      meta: {
        title: "Karto",
        logoAlt: "Karto-Logo"
      },
      sidebar: {
        open: "Navigation öffnen",
        close: "Navigation schließen",
        quitApp: "App beenden"
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
        createCard: "Karte erstellen",
        edit: "Bearbeiten",
        editCard: "Karte bearbeiten",
        moveCard: "Karte verschieben",
        mergeDeck: "Deck zusammenführen",
        renameDeck: "Deck umbenennen",
        importDecks: "Decks importieren",
        delete: "Löschen",
        share: "Teilen"
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
        subtitle: "Decks, Import und Teilen.",
        createDeck: "Deck erstellen",
        createCard: "Karte erstellen",
        merge: "Decks zusammenführen",
        exportAll: "Decks exportieren",
        exportCsv: "CSV exportieren",
        importAll: "Decks importieren",
        empty: "Noch keine Decks. Erstelle dein erstes!"
      },
      editDeck: {
        title: "Deck-Editor",
        subtitle: "Karten und Lernen.",
        createCard: "Karte erstellen",
        addFromOther: "Aus anderem Deck hinzufügen",
        share: "Deck teilen",
        export: "Exportieren",
        exportCsv: "CSV exportieren",
        import: "Importieren",
        empty: "Noch keine Karten. Erstelle deine erste!",
        draftHint: "Benenne das Deck, um Karten hinzuzufügen.",
        namePlaceholder: "Deckname",
        saveName: "Speichern",
        searchPlaceholder: "Karten suchen...",
        moveToDeckLabel: "In Deck verschieben",
        moveConfirm: "Verschieben",
        moveCancel: "Abbrechen"
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
        subtitle: "Sprache, Fenster, Layout und Thema.",
        language: "Sprache der Oberfläche",
        languageOptionEn: "English",
        languageOptionDe: "Deutsch",
        languageOptionRu: "Русский",
        theme: "Thema",
        themeSystem: "System",
        themeDark: "Dunkel",
        themeLight: "Hell",
        windowMode: "Fenstermodus",
        windowModeFullscreen: "Vollbild",
        windowModeWindowed: "Fenster",
        homeTilesPerRow: "Kacheln pro Reihe",
        homeTilesAuto: "Auto",
        homeTiles2: "2",
        homeTiles3: "3",
        homeTiles4: "4",
        autoGermanArticle: "Artikel für deutsche Nomen automatisch einfügen",
        saveChanges: "Änderungen speichern"
      },
      cardForm: {
        titleCreate: "Karte erstellen",
        titleEdit: "Karte bearbeiten",
        subtitle: "Vorderseite, Antwort und Bild.",
        frontLabel: "Vorderseite",
        frontPlaceholder: "Wort oder Frage",
        backLabel: "Rückseite",
        backPlaceholder: "Definition oder Antwort",
        imageLabel: "Bild",
        imagePlaceholder: "Link einfügen oder unten auswählen",
        deckLabel: "Deck",
        getDefinition: "Bedeutung holen",
        translate: "Übersetzen",
        searchImages: "Bilder suchen",
        save: "Karte speichern",
        imageSelectTitle: "Zum Auswählen klicken",
        dictLang: "Wörterbuchsprache",
        dictLangEn: "Englisch",
        dictLangDe: "Deutsch",
        dictLangRu: "Russisch",
        chooseDefinitionSource: "Wörterbuchquelle wählen",
        chooseTranslationTarget: "Zielsprache wählen",
        definitionOptionEn: "EN · dictionaryapi.dev",
        definitionOptionDe: "DE · DWDS",
        definitionOptionRu: "RU · Wiktionary",
        translationOptionEn: "EN",
        translationOptionDe: "DE",
        translationOptionRu: "RU",
        definitionSelection: "{language} · {source}",
        translationSelection: "Ziel: {language}",
        uploadImage: "Bild hochladen",
        imageSideFront: "Bild auf der Vorderseite zeigen",
        imageSideBack: "Bild auf der Rückseite zeigen",
        addCard: "Karte hinzufügen",
        clearImage: "Bild entfernen"
      },
      createDeck: {
        title: "Deck erstellen",
        subtitle: "Nur ein Name.",
        nameLabel: "Name",
        namePlaceholder: "Deckname",
        save: "Erstellen",
        saveAndEdit: "Erstellen und Deck bearbeiten"
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
        addCard: "Hinzufügen",
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
        modeReview: "Wiederholen"
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
        enterBackText: "Gib Text auf der Rückseite ein.",
        definitionNotFound: "Definition nicht gefunden.",
        serverUnavailable: "Der lokale Nachschlagedienst ist nicht verfügbar. Starte Karto neu.",
        nothingFound: "Nichts gefunden.",
        needTwoDecks: "Zum Zusammenführen brauchst du mindestens zwei Decks.",
        chooseTwoDecks: "Wähle mindestens zwei Decks.",
        noOtherDecks: "Keine anderen Decks vorhanden.",
        cardAdded: "Karte \"{frontText}\" hinzugefügt.",
        emptyDeckStudy: "Dieses Deck hat noch keine Karten.",
        deckDeleted: "Deck \"{name}\" gelöscht.",
        cardDeleted: "Karte gelöscht.",
        cardsDeleted: "{count} Karten gelöscht.",
        cardsMoved: "{added} Karten verschoben. Übersprungene Duplikate: {skipped}.",
        cardMoved: "Karte nach \"{deckName}\" verschoben.",
        cardMoveSkipped: "Die Karte wurde nicht verschoben. In \"{deckName}\" existiert bereits ein Duplikat.",
        deckCreated: "Deck erstellt.",
        cardSaved: "Karte gespeichert.",
        invalidImageUrl: "Verwende eine URL mit http(s) oder data:image.",
        noCardsForMode: "Für den gewählten Lernmodus gibt es keine passenden Karten.",
        deckMerged: "Decks wurden zu \"{name}\" zusammengeführt.",
        deckShared: "Deck geteilt.",
        deckJsonCopied: "Deck-JSON kopiert.",
        shareUnavailable: "Teilen ist hier nicht verfügbar.",
        translationUnavailable: "Übersetzung ist nicht verfügbar.",
        windowModeUnavailable: "Der Fenstermodus konnte nicht geändert werden.",
        settingsSaved: "Einstellungen gespeichert.",
        settingsSaveFailed: "Die Einstellungen konnten nicht gespeichert werden.",
        quitUnavailable: "Die App konnte nicht beendet werden."
      }
    }
  };

  let currentLanguage = FALLBACK_LANG;

  function resolveStorageOption(options = {}) {
    return Object.prototype.hasOwnProperty.call(options, "storage")
      ? options.storage
      : null;
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
    const storage = resolveStorageOption(options);
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
    const storage = resolveStorageOption(options);

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
