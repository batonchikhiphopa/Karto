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
    createCard({
      frontText: "cat",
      backText: "Katze",
      extraSides: [{ id: "side_cat_1", text: "small animal" }],
      image: "https://example.com/cat.jpg",
      imageThumb: "https://example.com/cat-thumb.jpg"
    }),
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
    importResult.decks[0].cards[0].extraSides,
    [{ id: "side_cat_1", text: "small animal" }]
  );
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

function testExportDoesNotIncludeHomeMediaCache() {
  const deck = createDeck("Cached");
  deck.homeMediaCache = {
    signature: "sig",
    images: ["https://example.com/thumb.jpg"],
    updatedAt: "2026-04-15T10:00:00.000Z"
  };
  deck.cards.push(createCard({ frontText: "cat", backText: "Katze", image: "" }));

  const payload = createExportPayload([deck]);

  assert.equal(Object.hasOwn(payload.decks[0], "homeMediaCache"), false);
}

testExportImportRoundTripKeepsData();
testMergeDecksDeduplicatesCardsByFingerprint();
testExportDoesNotIncludeHomeMediaCache();

console.log("export/import tests passed");
