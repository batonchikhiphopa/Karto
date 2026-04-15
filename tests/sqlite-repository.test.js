const assert = require("node:assert/strict");

const {
  createSqliteRepository
} = require("../js/sqlite-repository.js");

function withRepository(run, options = {}) {
  const repository = createSqliteRepository({ dbPath: ":memory:", ...options });

  try {
    run(repository);
  } finally {
    repository.close();
  }
}

function createFakeNativeImage() {
  function createImage(label, width = 1440, height = 720) {
    return {
      isEmpty: () => false,
      getSize: () => ({ width, height }),
      resize(options) {
        return createImage(
          `${label}:${options.width}x${options.height}`,
          options.width,
          options.height
        );
      },
      toJPEG(quality) {
        return Buffer.from(`${label}:${width}x${height}:${quality}`);
      }
    };
  }

  return {
    createFromDataURL(source) {
      return createImage(source.includes("heavy") ? "heavy" : "image");
    }
  };
}

function testCrudAndLoadAppData() {
  withRepository((repository) => {
    const deck = repository.createDeck("Deutsch");
    const card = repository.createCard({
      deckId: deck.id,
      frontText: "Haus",
      backText: "Дом",
      image: "https://example.com/haus.jpg",
      imageThumb: "https://example.com/haus-thumb.jpg",
      imageStudy: "https://example.com/haus-study.jpg",
      imageSide: "front"
    });

    const decks = repository.getDecks();
    assert.equal(decks.length, 1);
    assert.equal(decks[0].name, "Deutsch");
    assert.equal(decks[0].cards.length, 1);
    assert.equal(decks[0].cards[0].id, card.id);
    assert.equal(decks[0].cards[0].imageThumb, "https://example.com/haus-thumb.jpg");
    assert.equal(decks[0].cards[0].imageStudy, "https://example.com/haus-study.jpg");
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
              imageThumb: "",
              imageStudy: "",
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
              imageThumb: "",
              imageStudy: "",
              imageSide: "back"
            },
            {
              id: "card_1",
              frontText: "One",
              backText: "1",
              image: "https://example.com/one.jpg",
              imageThumb: "https://example.com/one-thumb.jpg",
              imageStudy: "https://example.com/one-study.jpg",
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
    assert.equal(decks[1].cards[1].imageThumb, "https://example.com/one-thumb.jpg");
  });
}

function makeLazyCard(deckName, index) {
  return {
    id: `${deckName}_card_${index}`,
    frontText: `${deckName} ${index}`,
    backText: `Back ${index}`,
    image: `data:image/jpeg;base64,${deckName}${index}`,
    imageThumb: `data:image/jpeg;base64,thumb${deckName}${index}`,
    imageStudy: `data:image/jpeg;base64,study${deckName}${index}`,
    imageSide: "back"
  };
}

function testLocalDataImagesAreStoredAsSingleStudyVersion() {
  withRepository((repository) => {
    const deck = repository.createDeck("Images");
    const card = repository.createCard({
      deckId: deck.id,
      frontText: "front",
      backText: "back",
      image: "data:image/jpeg;base64,full",
      imageThumb: "data:image/jpeg;base64,thumb",
      imageStudy: "data:image/jpeg;base64,study",
      imageSide: "front"
    });

    const storedCard = repository.getDecks()[0].cards[0];

    assert.equal(card.image, "data:image/jpeg;base64,study");
    assert.equal(card.imageStudy, "");
    assert.equal(storedCard.image, "data:image/jpeg;base64,study");
    assert.equal(storedCard.imageStudy, "");
    assert.equal(storedCard.imageThumb, "data:image/jpeg;base64,thumb");
  });
}

function testHeavyLocalDataImageCanBeCompressedByNativeImage() {
  withRepository((repository) => {
    const deck = repository.createDeck("Compressed");
    const card = repository.createCard({
      deckId: deck.id,
      frontText: "front",
      backText: "back",
      image: "data:image/png;base64,heavy",
      imageThumb: "",
      imageStudy: "",
      imageSide: "back"
    });
    const decodedImage = Buffer.from(card.image.split(",")[1], "base64").toString("utf8");
    const decodedThumb = Buffer.from(card.imageThumb.split(",")[1], "base64").toString("utf8");

    assert.match(card.image, /^data:image\/jpeg;base64,/);
    assert.match(card.imageThumb, /^data:image\/jpeg;base64,/);
    assert.equal(card.imageStudy, "");
    assert.match(decodedImage, /720x360:68$/);
    assert.match(decodedThumb, /360x180:72$/);
  }, { nativeImage: createFakeNativeImage() });
}

function testExternalImagesDeriveLightUrlsWhenPossible() {
  withRepository((repository) => {
    const deck = repository.createDeck("Remote");
    const card = repository.createCard({
      deckId: deck.id,
      frontText: "front",
      backText: "back",
      image: "https://images.unsplash.com/photo-cat?ixid=abc",
      imageThumb: "",
      imageStudy: "",
      imageSide: "front"
    });

    assert.equal(card.image, "https://images.unsplash.com/photo-cat?ixid=abc");
    assert.match(card.imageThumb, /[?&]w=480\b/);
    assert.match(card.imageStudy, /[?&]w=800\b/);
  });
}

function testLoadAppShellDataUsesLastSessionAndRandomLightPreviews() {
  withRepository((repository) => {
    repository.saveDecksSnapshot({
      decks: [
        {
          id: "deck_a",
          name: "A",
          cards: Array.from({ length: 6 }, (_, index) => makeLazyCard("a", index + 1))
        },
        {
          id: "deck_b",
          name: "B",
          cards: Array.from({ length: 6 }, (_, index) => makeLazyCard("b", index + 1))
        }
      ]
    });
    repository.recordStudySession({
      deckId: "deck_b",
      deckName: "B",
      completedRounds: 1,
      finishedAt: "2026-04-15T12:00:00.000Z"
    });

    const shellData = repository.loadAppShellData();
    const shellDeckA = shellData.decks.find((deck) => deck.id === "deck_a");
    const shellDeckB = shellData.decks.find((deck) => deck.id === "deck_b");

    assert.equal(shellDeckA.cardCount, 6);
    assert.equal(shellDeckA.cards.length, 1);
    assert.deepEqual(shellDeckA.cards.map((card) => card.id), ["a_card_2"]);
    assert.equal(shellDeckA.cardsHydrated, false);
    assert.equal(shellDeckB.cardCount, 6);
    assert.equal(shellDeckB.cards.length, 5);
    assert.deepEqual(
      shellDeckB.cards.map((card) => card.id),
      ["b_card_2", "b_card_3", "b_card_4", "b_card_5", "b_card_6"]
    );
    assert.equal(shellDeckB.cardsHydrated, false);
    assert.equal(shellDeckB.cards[0].image, "");
    assert.equal(shellDeckB.cards[0].imageThumb, "data:image/jpeg;base64,thumbb2");
    assert.equal(shellDeckB.cards[0].imageStudy, "");
    assert.equal(shellDeckB.cards[0].mediaLoaded, false);

    const loadedDeck = repository.loadDeckCards("deck_b");
    assert.equal(loadedDeck.cards.length, 6);
    assert.equal(loadedDeck.cardsHydrated, true);
    assert.equal(loadedDeck.cards[0].image, "");

    const media = repository.loadCardMedia(["b_card_1"]);
    assert.equal(media.length, 1);
    assert.equal(media[0].image, "data:image/jpeg;base64,studyb1");
    assert.equal(media[0].imageStudy, "");
    assert.equal(media[0].mediaLoaded, true);
  }, { randomFn: () => 0 });
}

function testSettingsProgressAndSessionPersistence() {
  withRepository((repository) => {
    repository.saveSetting("theme", "dark");
    repository.saveSetting("language", "de");
    repository.saveSetting("homeGridColumns", "3");
    repository.saveSetting("homeMediaCache", {
      deck_1: {
        signature: "sig-1",
        images: ["https://example.com/thumb.jpg", "https://example.com/thumb.jpg"],
        updatedAt: "2026-04-15T10:00:00.000Z"
      }
    });

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
    assert.deepEqual(appData.homeMediaCache.deck_1, {
      signature: "sig-1",
      images: ["https://example.com/thumb.jpg"],
      updatedAt: "2026-04-15T10:00:00.000Z"
    });
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

function testClearAllDataCanPreserveLanguage() {
  withRepository((repository) => {
    repository.saveSetting("language", "ru");
    repository.saveSetting("theme", "dark");
    repository.saveSetting("homeMediaCache", {
      deck_1: {
        signature: "sig",
        images: ["https://example.com/thumb.jpg"],
        updatedAt: "2026-04-15T10:00:00.000Z"
      }
    });

    const cleared = repository.clearAllData({ includeLanguage: false });
    assert.equal(cleared.decks.length, 0);
    assert.equal(cleared.languagePreference, "ru");
    assert.equal(cleared.themePreference, "system");
    assert.deepEqual(cleared.homeMediaCache, {});
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
      homeMediaCache: {
        deck_restore: {
          signature: "sig-restore",
          images: ["https://example.com/restore-thumb.jpg"],
          updatedAt: "2026-04-15T12:00:00.000Z"
        }
      },
      studyProgress: {},
      studySessions: []
    });

    assert.equal(restored.decks.length, 1);
    assert.equal(restored.themePreference, "dark");
    assert.equal(restored.homeGridColumns, "2");
    assert.equal(restored.homeMediaCache.deck_restore.signature, "sig-restore");
    assert.equal(restored.languagePreference, "de");
  });
}

testCrudAndLoadAppData();
testSaveDeckSnapshotPreservesOrder();
testLocalDataImagesAreStoredAsSingleStudyVersion();
testHeavyLocalDataImageCanBeCompressedByNativeImage();
testExternalImagesDeriveLightUrlsWhenPossible();
testLoadAppShellDataUsesLastSessionAndRandomLightPreviews();
testSettingsProgressAndSessionPersistence();
testStudyRoundHistoryIsLimitedPerDeck();
testClearAllDataCanPreserveLanguage();
testRestoreAppStateSnapshot();

console.log("sqlite-repository tests passed");
