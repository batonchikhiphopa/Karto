const assert = require("node:assert/strict");

const {
  createCard,
  createDeck,
  createExportPayload,
  createStoragePayload,
  mergeDecks,
  prepareLibraryImport
} = require("../js/data-model.js");

function testExportImportRoundTripKeepsData() {
  const deckA = createDeck("Animals");
  deckA.cards.push(
    createCard({ frontText: "cat", backText: "Katze", image: "https://example.com/cat.jpg" }),
    createCard({ frontText: "dog", backText: "Hund", image: "" })
  );

  const deckB = createDeck("Travel");
  deckB.cards.push(
    createCard({ frontText: "train", backText: "Zug", image: "" })
  );

  const exportPayload = createExportPayload([deckA, deckB]);
  const importResult = prepareLibraryImport(exportPayload, []);

  assert.equal(importResult.isValid, true);
  assert.deepEqual(
    createStoragePayload(importResult.decks),
    createStoragePayload([deckA, deckB])
  );
}

function testMergeDecksDeduplicatesCardsByFingerprint() {
  const deckA = createDeck("First");
  deckA.cards.push(
    createCard({ frontText: "cat", backText: "Katze", image: "" }),
    createCard({ frontText: "dog", backText: "Hund", image: "" })
  );

  const deckB = createDeck("Second");
  deckB.cards.push(
    createCard({ frontText: "cat", backText: "Katze", image: "" }),
    createCard({ frontText: "bird", backText: "Vogel", image: "" })
  );

  const mergedDeck = mergeDecks([deckA, deckB], "Merged");

  assert.equal(mergedDeck.name, "Merged");
  assert.equal(mergedDeck.cards.length, 3);
  assert.deepEqual(
    mergedDeck.cards.map((card) => card.frontText),
    ["cat", "dog", "bird"]
  );
}

testExportImportRoundTripKeepsData();
testMergeDecksDeduplicatesCardsByFingerprint();

console.log("export/import tests passed");
