(function(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis, function() {
  const DATA_SCHEMA_VERSION = 2;
  let idCounter = 0;

  function createId(prefix = "id") {
    idCounter += 1;
    return [
      prefix,
      Date.now().toString(36),
      idCounter.toString(36),
      Math.random().toString(36).slice(2, 8)
    ].join("_");
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function hasStableId(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function isDeckLike(value) {
    return isPlainObject(value) && typeof value.name === "string" && Array.isArray(value.cards);
  }

  function isCardLike(value) {
    return (
      isPlainObject(value) &&
      (typeof value.frontText === "string" || typeof value.backText === "string" || typeof value.image === "string")
    );
  }

  function normalizeCard(rawCard) {
    if (!isPlainObject(rawCard)) return null;

    const frontText = normalizeText(rawCard.frontText);
    const backText = normalizeText(rawCard.backText);
    const image = normalizeText(rawCard.image);

    if (!frontText || !backText) {
      return null;
    }

    return {
      id: hasStableId(rawCard.id) ? rawCard.id.trim() : createId("card"),
      frontText,
      backText,
      image
    };
  }

  function cardFingerprint(card) {
    return [card.frontText, card.backText, card.image]
      .map((value) => normalizeText(value).toLowerCase())
      .join("\u241f");
  }

  function dedupeCards(cards) {
    const seenIds = new Set();
    const seenFingerprints = new Set();
    const result = [];

    cards.forEach((card) => {
      if (!card) return;

      const fingerprint = cardFingerprint(card);
      if (seenFingerprints.has(fingerprint) || seenIds.has(card.id)) {
        return;
      }

      seenIds.add(card.id);
      seenFingerprints.add(fingerprint);
      result.push(card);
    });

    return result;
  }

  function dedupeCardsByFingerprint(cards) {
    const seenFingerprints = new Set();
    const result = [];

    cards.forEach((card) => {
      if (!card) return;

      const fingerprint = cardFingerprint(card);
      if (seenFingerprints.has(fingerprint)) {
        return;
      }

      seenFingerprints.add(fingerprint);
      result.push(card);
    });

    return result;
  }

  function normalizeDeck(rawDeck) {
    if (!isDeckLike(rawDeck)) return null;

    const name = normalizeText(rawDeck.name);
    if (!name) return null;

    const cards = dedupeCards((rawDeck.cards || []).map(normalizeCard).filter(Boolean));

    return {
      id: hasStableId(rawDeck.id) ? rawDeck.id.trim() : createId("deck"),
      name,
      cards
    };
  }

  function deckFingerprint(deck) {
    const cardPart = deck.cards.map(cardFingerprint).sort().join("\u241e");
    return `${deck.name.trim().toLowerCase()}\u241d${cardPart}`;
  }

  function dedupeDecks(decks) {
    const seenIds = new Set();
    const seenFingerprints = new Set();
    const result = [];

    decks.forEach((deck) => {
      if (!deck) return;

      const fingerprint = deckFingerprint(deck);
      if (seenFingerprints.has(fingerprint) || seenIds.has(deck.id)) {
        return;
      }

      seenIds.add(deck.id);
      seenFingerprints.add(fingerprint);
      result.push(deck);
    });

    return result;
  }

  function dedupeDecksByFingerprint(decks) {
    const seenFingerprints = new Set();
    const result = [];

    decks.forEach((deck) => {
      if (!deck) return;

      const fingerprint = deckFingerprint(deck);
      if (seenFingerprints.has(fingerprint)) {
        return;
      }

      seenFingerprints.add(fingerprint);
      result.push(deck);
    });

    return result;
  }

  function cloneCard(card, options = {}) {
    const normalized = normalizeCard(card);
    if (!normalized) return null;

    return {
      id: options.freshId ? createId("card") : normalized.id,
      frontText: normalized.frontText,
      backText: normalized.backText,
      image: normalized.image
    };
  }

  function cloneDeck(deck, options = {}) {
    const normalized = normalizeDeck(deck);
    if (!normalized) return null;

    return {
      id: options.freshId ? createId("deck") : normalized.id,
      name: normalized.name,
      cards: normalized.cards
        .map((card) => cloneCard(card, { freshId: options.freshCardIds }))
        .filter(Boolean)
    };
  }

  function createDeck(name) {
    return {
      id: createId("deck"),
      name: normalizeText(name),
      cards: []
    };
  }

  function createCard(fields, existingId = null) {
    return normalizeCard({
      id: existingId,
      frontText: fields.frontText,
      backText: fields.backText,
      image: fields.image
    });
  }

  function createStoragePayload(decks) {
    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      decks: dedupeDecks((decks || []).map((deck) => cloneDeck(deck)).filter(Boolean))
    };
  }

  function createExportPayload(decks) {
    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      decks: createStoragePayload(decks).decks
    };
  }

  function normalizeStoredDecks(rawPayload) {
    if (Array.isArray(rawPayload)) {
      return dedupeDecks(rawPayload.map(normalizeDeck).filter(Boolean));
    }

    if (isPlainObject(rawPayload) && Array.isArray(rawPayload.decks)) {
      return dedupeDecks(rawPayload.decks.map(normalizeDeck).filter(Boolean));
    }

    return [];
  }

  function extractDecksFromImport(rawPayload) {
    if (Array.isArray(rawPayload)) {
      if (rawPayload.length === 0) return [];
      if (!rawPayload.every(isDeckLike)) return null;
      return rawPayload.map(normalizeDeck).filter(Boolean);
    }

    if (isPlainObject(rawPayload) && Array.isArray(rawPayload.decks)) {
      return rawPayload.decks.map(normalizeDeck).filter(Boolean);
    }

    if (isDeckLike(rawPayload)) {
      const deck = normalizeDeck(rawPayload);
      return deck ? [deck] : [];
    }

    return null;
  }

  function extractCardsFromImport(rawPayload) {
    if (Array.isArray(rawPayload)) {
      if (rawPayload.length === 0) return [];

      if (rawPayload.every(isCardLike)) {
        return dedupeCardsByFingerprint(rawPayload.map(normalizeCard).filter(Boolean));
      }

      if (rawPayload.every(isDeckLike)) {
        return dedupeCardsByFingerprint(
          rawPayload.flatMap((deck) => {
            const normalizedDeck = normalizeDeck(deck);
            return normalizedDeck ? normalizedDeck.cards : [];
          })
        );
      }

      return null;
    }

    if (isPlainObject(rawPayload) && Array.isArray(rawPayload.decks)) {
      return dedupeCardsByFingerprint(
        rawPayload.decks.flatMap((deck) => {
          const normalizedDeck = normalizeDeck(deck);
          return normalizedDeck ? normalizedDeck.cards : [];
        })
      );
    }

    if (isDeckLike(rawPayload)) {
      const normalizedDeck = normalizeDeck(rawPayload);
      return normalizedDeck ? normalizedDeck.cards : [];
    }

    return null;
  }

  function prepareLibraryImport(rawPayload, existingDecks) {
    const importedDecks = extractDecksFromImport(rawPayload);
    if (!importedDecks) {
      return { decks: [], skippedCount: 0, totalCount: 0, isValid: false };
    }

    const normalizedDecks = dedupeDecksByFingerprint(
      importedDecks.map((deck) => cloneDeck(deck)).filter(Boolean)
    );
    const existingFingerprints = new Set((existingDecks || []).map(deckFingerprint));
    const existingIds = new Set((existingDecks || []).map((deck) => deck.id));
    const acceptedDecks = [];
    let skippedCount = 0;

    normalizedDecks.forEach((deck) => {
      const fingerprint = deckFingerprint(deck);

      if (existingFingerprints.has(fingerprint)) {
        skippedCount += 1;
        return;
      }

      let candidate = deck;
      if (existingIds.has(deck.id)) {
        candidate = cloneDeck(deck, { freshId: true, freshCardIds: true });
      }

      acceptedDecks.push(candidate);
      existingIds.add(candidate.id);
      existingFingerprints.add(fingerprint);
    });

    return {
      decks: acceptedDecks,
      skippedCount,
      totalCount: normalizedDecks.length,
      isValid: true
    };
  }

  function prepareDeckImport(rawPayload, targetDeck) {
    const importedCards = extractCardsFromImport(rawPayload);
    if (!importedCards) {
      return { cards: [], skippedCount: 0, totalCount: 0, isValid: false };
    }

    const existingFingerprints = new Set((targetDeck?.cards || []).map(cardFingerprint));
    const existingIds = new Set((targetDeck?.cards || []).map((card) => card.id));
    const acceptedCards = [];
    let skippedCount = 0;

    importedCards.forEach((card) => {
      const fingerprint = cardFingerprint(card);

      if (existingFingerprints.has(fingerprint)) {
        skippedCount += 1;
        return;
      }

      let candidate = card;
      if (existingIds.has(card.id)) {
        candidate = cloneCard(card, { freshId: true });
      }

      acceptedCards.push(candidate);
      existingIds.add(candidate.id);
      existingFingerprints.add(fingerprint);
    });

    return {
      cards: acceptedCards,
      skippedCount,
      totalCount: importedCards.length,
      isValid: true
    };
  }

  function buildDeckExportFilename(deckName) {
    const baseName = normalizeText(deckName).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
    return `karto-${baseName || "deck"}.json`;
  }

  function buildLibraryExportFilename() {
    return "karto-decks.json";
  }

  function mergeDecks(decks, name) {
    const mergedDeck = createDeck(name);
    const clonedCards = (decks || [])
      .flatMap((deck) => (deck?.cards || []).map((card) => cloneCard(card, { freshId: true })))
      .filter(Boolean);

    mergedDeck.cards = dedupeCardsByFingerprint(clonedCards);
    return mergedDeck;
  }

  return {
    DATA_SCHEMA_VERSION,
    buildDeckExportFilename,
    buildLibraryExportFilename,
    cardFingerprint,
    cloneCard,
    cloneDeck,
    createCard,
    createDeck,
    createExportPayload,
    createId,
    createStoragePayload,
    deckFingerprint,
    mergeDecks,
    normalizeCard,
    normalizeDeck,
    normalizeStoredDecks,
    prepareDeckImport,
    prepareLibraryImport
  };
});
