(function(root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis, function(root) {
  const DATA_SCHEMA_VERSION = 3;
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

  function normalizeFrontText(value) {
    return normalizeText(value).replace(/\s*\r?\n\s*/g, " ").replace(/\s+/g, " ");
  }

  function normalizeExtraSides(value) {
    const rawSides = Array.isArray(value) ? value : [];

    return rawSides
      .map((side) => {
        const text = isPlainObject(side)
          ? normalizeText(side.text)
          : normalizeText(side);

        if (!text) {
          return null;
        }

        return {
          id: isPlainObject(side) && hasStableId(side.id) ? side.id.trim() : createId("side"),
          text
        };
      })
      .filter(Boolean);
  }

  function normalizeImageSide(value) {
    return value === "front" ? "front" : "back";
  }

  function normalizeCardCount(value, fallback) {
    const count = Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : null;
    return count === null ? Math.max(0, Number(fallback) || 0) : count;
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

    const frontText = normalizeFrontText(rawCard.frontText);
    const backText = normalizeText(rawCard.backText);
    const extraSides = normalizeExtraSides(rawCard.extraSides);
    const image = normalizeText(rawCard.image);
    const imageThumb = normalizeText(rawCard.imageThumb);
    const imageStudy = normalizeText(rawCard.imageStudy);
    const hasImage = rawCard.hasImage === true || !!image || !!imageThumb || !!imageStudy;
    const imageSide = normalizeImageSide(rawCard.imageSide);

    if (!frontText || !backText) {
      return null;
    }

    return {
      id: hasStableId(rawCard.id) ? rawCard.id.trim() : createId("card"),
      frontText,
      backText,
      extraSides,
      image,
      imageThumb: hasImage ? imageThumb : "",
      imageStudy: hasImage ? imageStudy : "",
      imageSide,
      hasImage,
      mediaLoaded: rawCard.mediaLoaded === false ? false : true
    };
  }

  function cardFingerprint(card) {
    const extraSidePart = normalizeExtraSides(card.extraSides)
      .map((side) => side.text)
      .join("\u241e");

    return [card.frontText, card.backText, extraSidePart, card.image, card.imageSide]
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
    const hasExplicitCardCount = Object.prototype.hasOwnProperty.call(rawDeck, "cardCount");
    const cardCount = normalizeCardCount(rawDeck.cardCount, cards.length);

    return {
      id: hasStableId(rawDeck.id) ? rawDeck.id.trim() : createId("deck"),
      name,
      cards,
      cardCount: Math.max(cardCount, cards.length),
      cardsHydrated: rawDeck.cardsHydrated === true || !hasExplicitCardCount
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

  function dedupeDecksForStorage(decks) {
    const seenIds = new Set();
    const seenFullFingerprints = new Set();
    const result = [];

    decks.forEach((deck) => {
      if (!deck) return;

      if (seenIds.has(deck.id)) {
        return;
      }

      if (deck.cardsHydrated === true) {
        const fingerprint = deckFingerprint(deck);
        if (seenFullFingerprints.has(fingerprint)) {
          return;
        }

        seenFullFingerprints.add(fingerprint);
      }

      seenIds.add(deck.id);
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

    const clonedCard = {
      id: options.freshId ? createId("card") : normalized.id,
      frontText: normalized.frontText,
      backText: normalized.backText,
      extraSides: normalized.extraSides.map((side) => ({
        id: options.freshId ? createId("side") : side.id,
        text: side.text
      })),
      image: normalized.image,
      imageThumb: normalized.imageThumb,
      imageStudy: normalized.imageStudy,
      imageSide: normalized.imageSide
    };

    if (options.includeRuntimeMetadata) {
      clonedCard.hasImage = normalized.hasImage;
      clonedCard.mediaLoaded = normalized.mediaLoaded;
    }

    return clonedCard;
  }

  function cloneDeck(deck, options = {}) {
    const normalized = normalizeDeck(deck);
    if (!normalized) return null;

    const clonedDeck = {
      id: options.freshId ? createId("deck") : normalized.id,
      name: normalized.name,
      cards: normalized.cards
        .map((card) => cloneCard(card, {
          freshId: options.freshCardIds,
          includeRuntimeMetadata: options.includeRuntimeMetadata
        }))
        .filter(Boolean)
    };

    if (options.includeRuntimeMetadata) {
      clonedDeck.cardCount = normalized.cardCount;
      clonedDeck.cardsHydrated = normalized.cardsHydrated;
    }

    return clonedDeck;
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
      extraSides: fields.extraSides,
      image: fields.image,
      imageThumb: fields.imageThumb,
      imageStudy: fields.imageStudy,
      imageSide: fields.imageSide
    });
  }

  function getDeckCardCount(deck) {
    const normalizedDeck = normalizeDeck(deck);
    return normalizedDeck ? normalizedDeck.cardCount : 0;
  }

  function createStoragePayload(decks) {
    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      decks: dedupeDecksForStorage(
        (decks || []).map((deck) => cloneDeck(deck, { includeRuntimeMetadata: true })).filter(Boolean)
      )
    };
  }

  function createExportPayload(decks) {
    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      decks: dedupeDecks((decks || []).map((deck) => cloneDeck(deck)).filter(Boolean))
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

  function moveCardsBetweenDecks(sourceDeck, targetDeck, cardIds) {
    const selectedIds = new Set(
      Array.isArray(cardIds)
        ? cardIds
          .filter(hasStableId)
          .map((cardId) => cardId.trim())
        : []
    );

    if (
      !isDeckLike(sourceDeck) ||
      !isDeckLike(targetDeck) ||
      selectedIds.size === 0
    ) {
      return {
        cards: [],
        skippedCount: 0,
        totalCount: 0,
        movedCardIds: [],
        isValid: false
      };
    }

    const selectedCards = sourceDeck.cards.filter((card) => selectedIds.has(card.id));
    if (selectedCards.length === 0) {
      return {
        cards: [],
        skippedCount: 0,
        totalCount: 0,
        movedCardIds: [],
        isValid: true
      };
    }

    const existingFingerprints = new Set(targetDeck.cards.map(cardFingerprint));
    const existingIds = new Set(targetDeck.cards.map((card) => card.id));
    const selectedFingerprints = new Set();
    const acceptedCards = [];
    const movedCardIds = [];
    let skippedCount = 0;

    selectedCards.forEach((card) => {
      const fingerprint = cardFingerprint(card);
      if (existingFingerprints.has(fingerprint) || selectedFingerprints.has(fingerprint)) {
        skippedCount += 1;
        return;
      }

      let candidate = card;
      if (existingIds.has(card.id)) {
        candidate = cloneCard(card, { freshId: true });
      }

      if (!candidate) {
        skippedCount += 1;
        return;
      }

      acceptedCards.push(candidate);
      movedCardIds.push(card.id);
      existingIds.add(candidate.id);
      existingFingerprints.add(fingerprint);
      selectedFingerprints.add(fingerprint);
    });

    targetDeck.cards.push(...acceptedCards);

    const movedIdSet = new Set(movedCardIds);
    sourceDeck.cards = sourceDeck.cards.filter((card) => {
      return !movedIdSet.has(card.id);
    });

    return {
      cards: acceptedCards,
      skippedCount,
      totalCount: selectedCards.length,
      isValid: true,
      movedCardIds
    };
  }

  function saveEditedCardToDeck(sourceDeck, targetDeck, editedCard, originalCardId) {
    const sourceCardId = hasStableId(originalCardId)
      ? originalCardId.trim()
      : hasStableId(editedCard?.id)
        ? editedCard.id.trim()
        : "";
    const normalizedCard = normalizeCard(editedCard);

    if (
      !isDeckLike(sourceDeck) ||
      !isDeckLike(targetDeck) ||
      !normalizedCard ||
      !hasStableId(sourceCardId)
    ) {
      return {
        card: null,
        cards: [],
        didMove: false,
        didSave: false,
        isValid: false,
        skippedCount: 0
      };
    }

    const sourceCardIndex = sourceDeck.cards.findIndex((card) => card.id === sourceCardId);
    if (sourceCardIndex === -1) {
      return {
        card: null,
        cards: [],
        didMove: false,
        didSave: false,
        isValid: false,
        skippedCount: 0
      };
    }

    const isSameDeck = sourceDeck === targetDeck || (
      hasStableId(sourceDeck.id) &&
      sourceDeck.id === targetDeck.id
    );
    if (isSameDeck) {
      sourceDeck.cards.splice(sourceCardIndex, 1, normalizedCard);

      return {
        card: normalizedCard,
        cards: [normalizedCard],
        didMove: false,
        didSave: true,
        isValid: true,
        skippedCount: 0
      };
    }

    const editedFingerprint = cardFingerprint(normalizedCard);
    const targetFingerprints = new Set(targetDeck.cards.map(cardFingerprint));
    if (targetFingerprints.has(editedFingerprint)) {
      return {
        card: null,
        cards: [],
        didMove: false,
        didSave: false,
        isValid: true,
        skippedCount: 1
      };
    }

    const targetIds = new Set(targetDeck.cards.map((card) => card.id));
    const savedCard = targetIds.has(normalizedCard.id)
      ? cloneCard(normalizedCard, { freshId: true })
      : normalizedCard;

    targetDeck.cards.push(savedCard);
    sourceDeck.cards.splice(sourceCardIndex, 1);

    return {
      card: savedCard,
      cards: [savedCard],
      didMove: true,
      didSave: true,
      isValid: true,
      skippedCount: 0
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
    getDeckCardCount,
    mergeDecks,
    normalizeExtraSides,
    moveCardsBetweenDecks,
    normalizeCard,
    normalizeDeck,
    normalizeStoredDecks,
    prepareDeckImport,
    prepareLibraryImport,
    saveEditedCardToDeck
  };
});
