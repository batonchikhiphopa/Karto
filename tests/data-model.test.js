const assert = require("node:assert/strict");

const {
  createCard,
  createDeck,
  createExportPayload,
  normalizeStoredDecks,
  prepareDeckImport,
  prepareLibraryImport
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

testNormalizeStoredDecksMigratesLegacyData();
testPrepareLibraryImportHandlesDuplicatesAndIdCollisions();
testPrepareDeckImportHandlesDuplicatesAndIdCollisions();

console.log("data-model tests passed");
