const assert = require("node:assert/strict");

const {
  cardFingerprint,
  createCard,
  createDeck,
  createExportPayload,
  createStoragePayload,
  getDeckCardCount,
  moveCardsBetweenDecks,
  normalizeStoredDecks,
  prepareDeckImport,
  prepareLibraryImport,
  saveEditedCardToDeck
} = require("../js/data-model.js");

function testCardsPreserveImageThumb() {
  const card = createCard({
    frontText: "cat",
    backText: "Katze",
    image: "https://images.unsplash.com/photo-cat?w=1200",
    imageThumb: "https://images.unsplash.com/photo-cat?w=480",
    imageStudy: "https://images.unsplash.com/photo-cat?w=800",
    imageSide: "front"
  });
  const deck = createDeck("Animals");
  deck.cards.push(card);

  const storedDecks = normalizeStoredDecks(createExportPayload([deck]));

  assert.equal(card.imageThumb, "https://images.unsplash.com/photo-cat?w=480");
  assert.equal(storedDecks[0].cards[0].imageThumb, card.imageThumb);
  assert.equal(storedDecks[0].cards[0].imageStudy, card.imageStudy);
  assert.equal(createExportPayload([deck]).decks[0].cards[0].imageThumb, card.imageThumb);
}

function testCardsPreserveExtraSidesAndNormalizeFrontLines() {
  const card = createCard({
    frontText: "hello\nworld",
    backText: "answer",
    extraSides: [
      { id: "side_one", text: "second additional side" },
      { text: "   " },
      "third additional side"
    ],
    image: ""
  });
  const deck = createDeck("Extra");
  deck.cards.push(card);
  const storedDecks = normalizeStoredDecks(createStoragePayload([deck]));
  const exportedCard = createExportPayload([deck]).decks[0].cards[0];

  assert.equal(card.frontText, "hello world");
  assert.deepEqual(
    card.extraSides.map((side) => side.text),
    ["second additional side", "third additional side"]
  );
  assert.deepEqual(storedDecks[0].cards[0].extraSides, card.extraSides);
  assert.deepEqual(exportedCard.extraSides, card.extraSides);
}

function testPartialDecksPreserveCardCountAndLightMedia() {
  const decks = normalizeStoredDecks({
    decks: [
      {
        id: "deck_partial",
        name: "Partial",
        cardCount: 12,
        cardsHydrated: false,
        cards: [
          {
            id: "card_partial",
            frontText: "front",
            backText: "back",
            image: "",
            imageThumb: "data:image/jpeg;base64,thumb",
            imageStudy: "data:image/jpeg;base64,study",
            imageSide: "back",
            hasImage: true,
            mediaLoaded: false
          }
        ]
      }
    ]
  });

  assert.equal(decks[0].cardCount, 12);
  assert.equal(getDeckCardCount(decks[0]), 12);
  assert.equal(decks[0].cardsHydrated, false);
  assert.equal(decks[0].cards[0].image, "");
  assert.equal(decks[0].cards[0].imageThumb, "data:image/jpeg;base64,thumb");
  assert.equal(decks[0].cards[0].imageStudy, "data:image/jpeg;base64,study");
  assert.equal(decks[0].cards[0].mediaLoaded, false);

  const exportedDeck = createExportPayload(decks).decks[0];
  assert.equal(Object.hasOwn(exportedDeck, "cardCount"), false);
  assert.equal(Object.hasOwn(exportedDeck.cards[0], "mediaLoaded"), false);
}

function testStoragePayloadDoesNotFingerprintDedupePartialDecks() {
  const firstPartial = {
    id: "deck_partial_a",
    name: "Same Preview",
    cardCount: 10,
    cardsHydrated: false,
    cards: [
      {
        id: "card_preview_a",
        frontText: "preview",
        backText: "same",
        image: ""
      }
    ]
  };
  const secondPartial = {
    id: "deck_partial_b",
    name: "Same Preview",
    cardCount: 20,
    cardsHydrated: false,
    cards: [
      {
        id: "card_preview_b",
        frontText: "preview",
        backText: "same",
        image: ""
      }
    ]
  };

  const payload = createStoragePayload([firstPartial, secondPartial]);
  assert.deepEqual(
    payload.decks.map((deck) => deck.id),
    ["deck_partial_a", "deck_partial_b"]
  );
}

function testImageThumbDoesNotAffectFingerprintOrDuplicateChecks() {
  const first = createCard({
    frontText: "cat",
    backText: "Katze",
    image: "https://example.com/cat.jpg",
    imageThumb: "https://example.com/cat-small-a.jpg"
  });
  const second = createCard({
    frontText: "cat",
    backText: "Katze",
    image: "https://example.com/cat.jpg",
    imageThumb: "https://example.com/cat-small-b.jpg"
  });
  const targetDeck = createDeck("Target");
  targetDeck.cards.push(first);

  const result = prepareDeckImport([second], targetDeck);

  assert.equal(cardFingerprint(first), cardFingerprint(second));
  assert.equal(result.skippedCount, 1);
  assert.equal(result.cards.length, 0);
}

function testExtraSidesAffectFingerprintAndDuplicateChecks() {
  const first = createCard({
    frontText: "cat",
    backText: "Katze",
    extraSides: [{ id: "side_1", text: "animal" }],
    image: ""
  });
  const same = createCard({
    frontText: "cat",
    backText: "Katze",
    extraSides: [{ id: "side_2", text: "animal" }],
    image: ""
  });
  const different = createCard({
    frontText: "cat",
    backText: "Katze",
    extraSides: [{ id: "side_3", text: "noun" }],
    image: ""
  });
  const targetDeck = createDeck("Target");
  targetDeck.cards.push(first);

  const sameResult = prepareDeckImport([same], targetDeck);
  const differentResult = prepareDeckImport([different], targetDeck);

  assert.equal(cardFingerprint(first), cardFingerprint(same));
  assert.notEqual(cardFingerprint(first), cardFingerprint(different));
  assert.equal(sameResult.skippedCount, 1);
  assert.equal(differentResult.cards.length, 1);
}

function testNormalizeStoredDecksMigratesLegacyData() {
  const decks = normalizeStoredDecks([
    {
      name: "Animals",
      cards: [
        { frontText: "cat", backText: "Katze", image: "" },
        { frontText: "cat", backText: "Katze", image: "" },
        { frontText: "dog", backText: "", image: "" }
      ]
    }
  ]);

  assert.equal(decks.length, 1);
  assert.match(decks[0].id, /^deck_/);
  assert.equal(decks[0].cards.length, 1);
  assert.match(decks[0].cards[0].id, /^card_/);
}

function testPrepareLibraryImportHandlesDuplicatesAndIdCollisions() {
  const existingDeck = createDeck("Animals");
  existingDeck.cards.push(createCard({ frontText: "cat", backText: "Katze", image: "" }));

  const duplicateFingerprintDeck = createDeck("Animals");
  duplicateFingerprintDeck.cards.push(createCard({ frontText: "cat", backText: "Katze", image: "" }));

  const sameIdDifferentContentDeck = createDeck("Travel");
  sameIdDifferentContentDeck.id = existingDeck.id;
  sameIdDifferentContentDeck.cards.push(createCard({ frontText: "train", backText: "Zug", image: "" }));

  const result = prepareLibraryImport(
    createExportPayload([duplicateFingerprintDeck, sameIdDifferentContentDeck]),
    [existingDeck]
  );

  assert.equal(result.isValid, true);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.decks.length, 1);
  assert.notEqual(result.decks[0].id, existingDeck.id);
  assert.equal(result.decks[0].name, "Travel");
  assert.match(result.decks[0].cards[0].id, /^card_/);
}

function testPrepareDeckImportHandlesDuplicatesAndIdCollisions() {
  const targetDeck = createDeck("German");
  const existingCard = createCard({ frontText: "apple", backText: "Apfel", image: "" });
  targetDeck.cards.push(existingCard);

  const duplicateCard = { ...existingCard };
  const sameIdDifferentContent = {
    id: existingCard.id,
    frontText: "pear",
    backText: "Birne",
    image: ""
  };

  const result = prepareDeckImport([duplicateCard, sameIdDifferentContent], targetDeck);

  assert.equal(result.isValid, true);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.cards.length, 1);
  assert.notEqual(result.cards[0].id, existingCard.id);
  assert.equal(result.cards[0].frontText, "pear");
}

function testMoveCardsBetweenDecksMovesAcceptedCards() {
  const sourceDeck = createDeck("Source");
  const targetDeck = createDeck("Target");
  const firstCard = createCard({ frontText: "sun", backText: "Sonne", image: "" });
  const secondCard = createCard({ frontText: "moon", backText: "Mond", image: "" });

  sourceDeck.cards.push(firstCard, secondCard);

  const result = moveCardsBetweenDecks(sourceDeck, targetDeck, [firstCard.id, secondCard.id]);

  assert.equal(result.isValid, true);
  assert.equal(result.cards.length, 2);
  assert.deepEqual(result.movedCardIds, [firstCard.id, secondCard.id]);
  assert.equal(sourceDeck.cards.length, 0);
  assert.deepEqual(
    targetDeck.cards.map((card) => card.frontText),
    ["sun", "moon"]
  );
}

function testMoveCardsBetweenDecksLeavesDuplicateInSourceDeck() {
  const sourceDeck = createDeck("Source");
  const targetDeck = createDeck("Target");
  const sourceCard = createCard({ frontText: "tree", backText: "Baum", image: "" });

  sourceDeck.cards.push(sourceCard);
  targetDeck.cards.push(createCard({ frontText: "tree", backText: "Baum", image: "" }));

  const result = moveCardsBetweenDecks(sourceDeck, targetDeck, [sourceCard.id]);

  assert.equal(result.isValid, true);
  assert.equal(result.cards.length, 0);
  assert.equal(result.skippedCount, 1);
  assert.deepEqual(result.movedCardIds, []);
  assert.equal(sourceDeck.cards.length, 1);
  assert.equal(targetDeck.cards.length, 1);
}

function testMoveCardsBetweenDecksHandlesIdCollisions() {
  const sourceDeck = createDeck("Source");
  const targetDeck = createDeck("Target");
  const existingCard = createCard({ frontText: "road", backText: "Straße", image: "" });
  const movedCard = createCard({ frontText: "bridge", backText: "Brücke", image: "" });

  movedCard.id = existingCard.id;
  sourceDeck.cards.push(movedCard);
  targetDeck.cards.push(existingCard);

  const result = moveCardsBetweenDecks(sourceDeck, targetDeck, [movedCard.id]);

  assert.equal(result.cards.length, 1);
  assert.notEqual(result.cards[0].id, movedCard.id);
  assert.deepEqual(result.movedCardIds, [movedCard.id]);
  assert.equal(sourceDeck.cards.length, 0);
  assert.deepEqual(
    targetDeck.cards.map((card) => card.frontText),
    ["road", "bridge"]
  );
}

function testMoveCardsBetweenDecksSupportsBulkRegression() {
  const sourceDeck = createDeck("Source");
  const targetDeck = createDeck("Target");
  const duplicateCard = createCard({ frontText: "cloud", backText: "Wolke", image: "" });
  const uniqueCard = createCard({ frontText: "wind", backText: "Wind", image: "" });

  sourceDeck.cards.push(duplicateCard, uniqueCard);
  targetDeck.cards.push(createCard({ frontText: "cloud", backText: "Wolke", image: "" }));

  const result = moveCardsBetweenDecks(sourceDeck, targetDeck, [duplicateCard.id, uniqueCard.id]);

  assert.equal(result.cards.length, 1);
  assert.equal(result.skippedCount, 1);
  assert.deepEqual(result.movedCardIds, [uniqueCard.id]);
  assert.deepEqual(
    sourceDeck.cards.map((card) => card.frontText),
    ["cloud"]
  );
  assert.deepEqual(
    targetDeck.cards.map((card) => card.frontText),
    ["cloud", "wind"]
  );
}

function testMoveCardsBetweenDecksSkipsDuplicateFingerprintsInsideSelection() {
  const sourceDeck = createDeck("Source");
  const targetDeck = createDeck("Target");
  const firstCard = createCard({ frontText: "river", backText: "Fluss", image: "" });
  const duplicateCard = createCard({ frontText: "river", backText: "Fluss", image: "" });

  sourceDeck.cards.push(firstCard, duplicateCard);

  const result = moveCardsBetweenDecks(sourceDeck, targetDeck, [firstCard.id, duplicateCard.id]);

  assert.equal(result.cards.length, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.totalCount, 2);
  assert.deepEqual(result.movedCardIds, [firstCard.id]);
  assert.deepEqual(
    sourceDeck.cards.map((card) => card.id),
    [duplicateCard.id]
  );
  assert.deepEqual(
    targetDeck.cards.map((card) => card.id),
    [firstCard.id]
  );
}

function testSaveEditedCardToDeckReplacesCardInSameDeck() {
  const deck = createDeck("Deutsch");
  const firstCard = createCard({ frontText: "sun", backText: "Sonne", image: "" });
  const secondCard = createCard({ frontText: "moon", backText: "Mond", image: "" });
  const editedCard = createCard({ frontText: "sunlight", backText: "Sonnenlicht", image: "" }, firstCard.id);

  deck.cards.push(firstCard, secondCard);

  const result = saveEditedCardToDeck(deck, deck, editedCard, firstCard.id);

  assert.equal(result.isValid, true);
  assert.equal(result.didSave, true);
  assert.equal(result.didMove, false);
  assert.equal(deck.cards.length, 2);
  assert.deepEqual(
    deck.cards.map((card) => card.id),
    [firstCard.id, secondCard.id]
  );
  assert.deepEqual(
    deck.cards.map((card) => card.frontText),
    ["sunlight", "moon"]
  );
}

function testSaveEditedCardToDeckMovesEditedCard() {
  const sourceDeck = createDeck("Source");
  const targetDeck = createDeck("Target");
  const card = createCard({ frontText: "house", backText: "Haus", image: "" });
  const editedCard = createCard({ frontText: "home", backText: "Zuhause", image: "" }, card.id);

  sourceDeck.cards.push(card);

  const result = saveEditedCardToDeck(sourceDeck, targetDeck, editedCard, card.id);

  assert.equal(result.isValid, true);
  assert.equal(result.didSave, true);
  assert.equal(result.didMove, true);
  assert.equal(sourceDeck.cards.length, 0);
  assert.equal(targetDeck.cards.length, 1);
  assert.equal(targetDeck.cards[0].id, card.id);
  assert.equal(targetDeck.cards[0].frontText, "home");
}

function testSaveEditedCardToDeckBlocksDuplicateTargetWithoutMutatingSource() {
  const sourceDeck = createDeck("Source");
  const targetDeck = createDeck("Target");
  const card = createCard({ frontText: "oak", backText: "Eiche", image: "" });
  const editedCard = createCard({ frontText: "tree", backText: "Baum", image: "" }, card.id);

  sourceDeck.cards.push(card);
  targetDeck.cards.push(createCard({ frontText: "tree", backText: "Baum", image: "" }));

  const result = saveEditedCardToDeck(sourceDeck, targetDeck, editedCard, card.id);

  assert.equal(result.isValid, true);
  assert.equal(result.didSave, false);
  assert.equal(result.didMove, false);
  assert.equal(result.skippedCount, 1);
  assert.equal(sourceDeck.cards.length, 1);
  assert.equal(sourceDeck.cards[0].frontText, "oak");
  assert.equal(targetDeck.cards.length, 1);
}

function testSaveEditedCardToDeckHandlesTargetIdCollision() {
  const sourceDeck = createDeck("Source");
  const targetDeck = createDeck("Target");
  const existingCard = createCard({ frontText: "road", backText: "Straße", image: "" });
  const card = createCard({ frontText: "bridge", backText: "Brücke", image: "" });
  card.id = existingCard.id;
  const editedCard = createCard({ frontText: "bridge updated", backText: "Neue Brücke", image: "" }, card.id);

  sourceDeck.cards.push(card);
  targetDeck.cards.push(existingCard);

  const result = saveEditedCardToDeck(sourceDeck, targetDeck, editedCard, card.id);

  assert.equal(result.isValid, true);
  assert.equal(result.didSave, true);
  assert.equal(result.didMove, true);
  assert.notEqual(result.card.id, card.id);
  assert.equal(sourceDeck.cards.length, 0);
  assert.deepEqual(
    targetDeck.cards.map((item) => item.frontText),
    ["road", "bridge updated"]
  );
}

testCardsPreserveImageThumb();
testCardsPreserveExtraSidesAndNormalizeFrontLines();
testPartialDecksPreserveCardCountAndLightMedia();
testStoragePayloadDoesNotFingerprintDedupePartialDecks();
testImageThumbDoesNotAffectFingerprintOrDuplicateChecks();
testExtraSidesAffectFingerprintAndDuplicateChecks();
testNormalizeStoredDecksMigratesLegacyData();
testPrepareLibraryImportHandlesDuplicatesAndIdCollisions();
testPrepareDeckImportHandlesDuplicatesAndIdCollisions();
testMoveCardsBetweenDecksMovesAcceptedCards();
testMoveCardsBetweenDecksLeavesDuplicateInSourceDeck();
testMoveCardsBetweenDecksHandlesIdCollisions();
testMoveCardsBetweenDecksSupportsBulkRegression();
testMoveCardsBetweenDecksSkipsDuplicateFingerprintsInsideSelection();
testSaveEditedCardToDeckReplacesCardInSameDeck();
testSaveEditedCardToDeckMovesEditedCard();
testSaveEditedCardToDeckBlocksDuplicateTargetWithoutMutatingSource();
testSaveEditedCardToDeckHandlesTargetIdCollision();

console.log("data-model tests passed");
