const assert = require("node:assert/strict");

const {
  createCard,
  createDeck,
  createExportPayload,
  moveCardsBetweenDecks,
  normalizeStoredDecks,
  prepareDeckImport,
  prepareLibraryImport,
  saveEditedCardToDeck
} = require("../js/data-model.js");

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
