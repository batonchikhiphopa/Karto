const assert = require("node:assert/strict");

const {
  createSqliteRepository
} = require("../js/sqlite-repository.js");

function withRepository(run) {
  const repository = createSqliteRepository({ dbPath: ":memory:" });

  try {
    run(repository);
  } finally {
    repository.close();
  }
}

function testCrudAndLoadAppData() {
  withRepository((repository) => {
    const deck = repository.createDeck("Deutsch");
    const card = repository.createCard({
      deckId: deck.id,
      frontText: "Haus",
      backText: "Дом",
      image: "https://example.com/haus.jpg",
      imageSide: "front"
    });

    const decks = repository.getDecks();
    assert.equal(decks.length, 1);
    assert.equal(decks[0].name, "Deutsch");
    assert.equal(decks[0].cards.length, 1);
    assert.equal(decks[0].cards[0].id, card.id);
    assert.equal(decks[0].cards[0].imageSide, "front");

    const appData = repository.loadAppData();
    assert.equal(appData.themePreference, "system");
    assert.equal(appData.homeGridColumns, "auto");
  });
}

function testSaveDeckSnapshotPreservesOrder() {
  withRepository((repository) => {
    repository.saveDecksSnapshot({
      decks: [
        {
          id: "deck_b",
          name: "Second",
          cards: [
            {
              id: "card_b",
              frontText: "B",
              backText: "Beta",
              image: "",
              imageSide: "back"
            }
          ]
        },
        {
          id: "deck_a",
          name: "First",
          cards: [
            {
              id: "card_2",
              frontText: "Two",
              backText: "2",
              image: "",
              imageSide: "back"
            },
            {
              id: "card_1",
              frontText: "One",
              backText: "1",
              image: "",
              imageSide: "front"
            }
          ]
        }
      ]
    });

    const decks = repository.getDecks();
    assert.deepEqual(
      decks.map((deck) => deck.id),
      ["deck_b", "deck_a"]
    );
    assert.deepEqual(
      decks[1].cards.map((card) => card.id),
      ["card_2", "card_1"]
    );
  });
}

function testSettingsProgressAndSessionPersistence() {
  withRepository((repository) => {
    repository.saveSetting("theme", "dark");
    repository.saveSetting("language", "de");
    repository.saveSetting("homeGridColumns", "3");

    const progress = repository.recordStudyAnswer("card_1", "correct");
    assert.equal(progress.seenCount, 1);
    assert.equal(progress.correctCount, 1);

    const sessions = repository.recordStudySession({
      deckId: "deck_1",
      deckName: "Deck 1",
      completedRounds: 2,
      finishedAt: "2026-04-09T12:00:00.000Z"
    });

    assert.equal(sessions.length, 1);

    const appData = repository.loadAppData();
    assert.equal(appData.themePreference, "dark");
    assert.equal(appData.languagePreference, "de");
    assert.equal(appData.homeGridColumns, "3");
    assert.equal(appData.studyProgress.card_1.correctCount, 1);
    assert.equal(appData.studySessions[0].deckName, "Deck 1");
    assert.equal(appData.studySessions[0].completedRounds, 2);
  });
}

function testStudyRoundHistoryIsLimitedPerDeck() {
  withRepository((repository) => {
    for (let index = 1; index <= 6; index += 1) {
      repository.recordStudySession({
        deckId: "deck_a",
        deckName: "A",
        completedRounds: index,
        finishedAt: `2026-04-0${index}T12:00:00.000Z`
      });
    }

    repository.recordStudySession({
      deckId: "deck_b",
      deckName: "B",
      completedRounds: 9,
      finishedAt: "2026-04-07T12:00:00.000Z"
    });

    const appData = repository.loadAppData();
    assert.equal(appData.studySessions.filter((session) => session.deckId === "deck_a").length, 5);
    assert.deepEqual(
      appData.studySessions
        .filter((session) => session.deckId === "deck_a")
        .map((session) => session.completedRounds),
      [6, 5, 4, 3, 2]
    );
    assert.equal(appData.studySessions.find((session) => session.deckId === "deck_b").completedRounds, 9);
  });
}

function testLegacyImportAndReset() {
  withRepository((repository) => {
    const importResult = repository.importLegacyLocalStorage({
      decks: [
        {
          id: "deck_legacy",
          name: "Legacy",
          cards: [
            {
              id: "card_legacy",
              frontText: "Front",
              backText: "Back",
              image: "",
              imageSide: "back"
            }
          ]
        }
      ],
      languagePreference: "ru",
      themePreference: "light",
      homeGridColumns: "4",
      studyProgress: {
        card_legacy: {
          seenCount: 3,
          correctCount: 2,
          lastResult: "correct",
          lastReviewedAt: "2026-04-09T10:00:00.000Z"
        }
      },
      studySessions: [
        {
          deckId: "deck_legacy",
          deckName: "Legacy",
          mode: "review",
          reviewed: 3,
          correct: 2,
          wrong: 1,
          unsure: 0,
          percentCorrect: 67,
          finishedAt: "2026-04-09T10:30:00.000Z"
        }
      ]
    });

    assert.equal(importResult.imported, true);
    assert.equal(importResult.appData.decks.length, 1);
    assert.equal(importResult.appData.languagePreference, "ru");
    assert.equal(importResult.appData.studySessions.length, 0);

    const cleared = repository.clearAllData({ includeLanguage: false });
    assert.equal(cleared.decks.length, 0);
    assert.equal(cleared.languagePreference, "ru");
    assert.equal(cleared.studySessions.length, 0);
  });
}

function testRestoreAppStateSnapshot() {
  withRepository((repository) => {
    const restored = repository.restoreAppStateSnapshot({
      decks: {
        decks: [
          {
            id: "deck_restore",
            name: "Restore",
            cards: []
          }
        ]
      },
      languagePreference: "de",
      themePreference: "dark",
      homeGridColumns: "2",
      studyProgress: {},
      studySessions: []
    });

    assert.equal(restored.decks.length, 1);
    assert.equal(restored.themePreference, "dark");
    assert.equal(restored.homeGridColumns, "2");
    assert.equal(restored.languagePreference, "de");
  });
}

testCrudAndLoadAppData();
testSaveDeckSnapshotPreservesOrder();
testSettingsProgressAndSessionPersistence();
testStudyRoundHistoryIsLimitedPerDeck();
testLegacyImportAndReset();
testRestoreAppStateSnapshot();

console.log("sqlite-repository tests passed");
