(function(root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis, function(root) {
  const EARLY_ROUND_DELAYS = {
    wrong: 1,
    unsure: 2,
    correct: 3
  };

  function normalizeResult(result) {
    return ["wrong", "unsure", "correct"].includes(result) ? result : "unsure";
  }

  function shuffleCards(cards, randomFn = Math.random) {
    const result = cloneCards(cards);

    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(randomFn() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }

    return result;
  }

  function getStudyBase(queueLength) {
    return Math.max(2, Math.floor(queueLength * 0.1));
  }

  function getResultDelay(studyState, result) {
    const normalizedResult = normalizeResult(result);

    if (studyState.completedRounds < 3) {
      return EARLY_ROUND_DELAYS[normalizedResult];
    }

    const base = getStudyBase(studyState.totalCount);
    if (normalizedResult === "correct") {
      return base * 6;
    }

    if (normalizedResult === "unsure") {
      return base * 3;
    }

    return base;
  }

  function getDueRound(studyState, cardId) {
    return studyState.dueRounds[cardId] || 1;
  }

  function buildRoundQueue(studyState, randomFn = Math.random) {
    const dueCards = studyState.allCards.filter((card) => {
      return getDueRound(studyState, card.id) <= studyState.currentRound;
    });

    studyState.queue = shuffleCards(dueCards, randomFn);
    studyState.currentIndex = 0;
  }

  function normalizePreferredCardIds(value) {
    const seen = new Set();
    return (Array.isArray(value) ? value : [])
      .map((cardId) => (typeof cardId === "string" ? cardId.trim() : ""))
      .filter((cardId) => {
        if (!cardId || seen.has(cardId)) {
          return false;
        }

        seen.add(cardId);
        return true;
      });
  }

  function movePreferredCardsToFront(cards, preferredCardIds) {
    const preferredIds = normalizePreferredCardIds(preferredCardIds);
    if (!preferredIds.length || !Array.isArray(cards) || cards.length < 2) {
      return cards;
    }

    const cardsById = new Map(cards.map((card) => [card.id, card]));
    const preferredCards = preferredIds
      .map((cardId) => cardsById.get(cardId))
      .filter(Boolean);

    if (!preferredCards.length) {
      return cards;
    }

    const preferredIdSet = new Set(preferredCards.map((card) => card.id));
    return preferredCards.concat(cards.filter((card) => !preferredIdSet.has(card.id)));
  }

  function advanceToNextAvailableRound(studyState, randomFn = Math.random) {
    if (!studyState.allCards.length) {
      studyState.queue = [];
      studyState.currentIndex = 0;
      return;
    }

    studyState.currentRound += 1;
    buildRoundQueue(studyState, randomFn);

    if (studyState.queue.length > 0) {
      return;
    }

    const nextDueRound = studyState.allCards.reduce((nextRound, card) => {
      const dueRound = getDueRound(studyState, card.id);
      if (dueRound <= studyState.currentRound) {
        return nextRound;
      }

      return Math.min(nextRound, dueRound);
    }, Number.POSITIVE_INFINITY);

    if (Number.isFinite(nextDueRound)) {
      studyState.currentRound = nextDueRound;
      buildRoundQueue(studyState, randomFn);
    }
  }

  function normalizeCompletedRounds(value) {
    return Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;
  }

  function cloneCards(cards) {
    return Array.isArray(cards)
      ? cards.map((card) => ({
        ...card,
        extraSides: Array.isArray(card.extraSides)
          ? card.extraSides.map((side) => ({ ...side }))
          : []
      }))
      : [];
  }

  function cloneDueRounds(dueRounds) {
    return dueRounds && typeof dueRounds === "object" ? { ...dueRounds } : {};
  }

  function cloneRoundCardIds(roundCardIds) {
    return roundCardIds instanceof Set ? Array.from(roundCardIds) : [];
  }

  function cloneProgressEntry(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    return {
      seenCount: Number.isFinite(Number(entry.seenCount)) ? Math.max(0, Math.round(Number(entry.seenCount))) : 0,
      correctCount: Number.isFinite(Number(entry.correctCount)) ? Math.max(0, Math.round(Number(entry.correctCount))) : 0,
      lastResult: typeof entry.lastResult === "string" && entry.lastResult ? entry.lastResult : null,
      lastReviewedAt: typeof entry.lastReviewedAt === "string" && entry.lastReviewedAt ? entry.lastReviewedAt : null
    };
  }

  function createUndoSnapshot(studyState) {
    return {
      queue: cloneCards(studyState.queue),
      currentIndex: studyState.currentIndex,
      currentRound: studyState.currentRound,
      dueRounds: cloneDueRounds(studyState.dueRounds),
      roundCardIds: cloneRoundCardIds(studyState.roundCardIds),
      completedRounds: studyState.completedRounds,
      sessionCompletedRounds: studyState.sessionCompletedRounds
    };
  }

  function resolveAdvanceOptions(randomFn, undoMeta) {
    if (typeof randomFn === "function") {
      return {
        randomFn,
        undoMeta: undoMeta || {}
      };
    }

    return {
      randomFn: Math.random,
      undoMeta: randomFn || {}
    };
  }

  function createStudyState(deck, randomFn = Math.random, options = {}) {
    const cards = Array.isArray(deck?.cards) ? deck.cards : [];
    const allCards = cloneCards(cards);
    const dueRounds = {};

    allCards.forEach((card) => {
      dueRounds[card.id] = 1;
    });

    const studyState = {
      allCards,
      dueRounds,
      queue: [],
      history: [],
      currentIndex: 0,
      currentRound: 1,
      totalCount: allCards.length,
      completedRounds: normalizeCompletedRounds(options.completedRounds),
      sessionCompletedRounds: 0,
      roundCardIds: new Set(),
      flipped: false,
      pendingAnswer: null
    };

    buildRoundQueue(studyState, randomFn);
    studyState.queue = movePreferredCardsToFront(studyState.queue, options.preferredCardIds);
    return studyState;
  }

  function getCurrentStudyCard(studyState) {
    return studyState.queue[studyState.currentIndex] || null;
  }

  function rememberCurrentCard(studyState, result, undoMeta = {}) {
    const currentCard = getCurrentStudyCard(studyState);
    if (!currentCard) return;

    studyState.history.push({
      cardId: currentCard.id,
      result: normalizeResult(result),
      previousProgressEntry: cloneProgressEntry(undoMeta.previousProgressEntry),
      snapshot: createUndoSnapshot(studyState)
    });
  }

  function scheduleCurrentCard(studyState, result, randomFn = Math.random) {
    const currentCard = getCurrentStudyCard(studyState);
    if (!currentCard) return;

    const delay = getResultDelay(studyState, result);
    studyState.dueRounds[currentCard.id] = studyState.currentRound + delay;
    studyState.queue.splice(studyState.currentIndex, 1);
    studyState.roundCardIds.add(currentCard.id);

    if (studyState.roundCardIds.size >= studyState.totalCount && studyState.totalCount > 0) {
      studyState.sessionCompletedRounds += 1;
      studyState.completedRounds += 1;
      studyState.roundCardIds.clear();
    }

    if (studyState.currentIndex >= studyState.queue.length) {
      studyState.currentIndex = 0;
    }

    if (studyState.queue.length === 0) {
      advanceToNextAvailableRound(studyState, randomFn);
    }
  }

  function advanceStudy(studyState, result, randomFn = Math.random, undoMeta = {}) {
    if (!studyState.queue.length) return;

    const options = resolveAdvanceOptions(randomFn, undoMeta);
    rememberCurrentCard(studyState, result, options.undoMeta);
    scheduleCurrentCard(studyState, result, options.randomFn);
    studyState.flipped = false;
    studyState.pendingAnswer = null;
  }

  function queuePendingStudyAnswer(studyState, result) {
    if (!getCurrentStudyCard(studyState)) {
      return false;
    }

    studyState.pendingAnswer = { result: normalizeResult(result) };
    studyState.flipped = true;
    return true;
  }

  function commitPendingStudyAnswer(studyState, randomFn = Math.random, undoMeta = {}) {
    if (!studyState.pendingAnswer || !studyState.queue.length) {
      return null;
    }

    const options = resolveAdvanceOptions(randomFn, undoMeta);
    const committedAnswer = {
      result: studyState.pendingAnswer.result
    };

    advanceStudy(studyState, committedAnswer.result, options.randomFn, options.undoMeta);
    return committedAnswer;
  }

  function cancelPendingStudyAnswer(studyState) {
    if (!studyState.pendingAnswer) {
      return false;
    }

    studyState.pendingAnswer = null;
    studyState.flipped = false;
    return true;
  }

  function undoStudyAnswer(studyState) {
    if (!Array.isArray(studyState.history) || studyState.history.length === 0) {
      return null;
    }

    const undoEntry = studyState.history.pop();
    const snapshot = undoEntry?.snapshot;
    if (!snapshot || typeof snapshot !== "object") {
      return null;
    }

    studyState.queue = cloneCards(snapshot.queue);
    studyState.currentIndex = Number.isInteger(snapshot.currentIndex)
      ? Math.max(0, Math.min(snapshot.currentIndex, Math.max(0, studyState.queue.length - 1)))
      : 0;
    studyState.currentRound = Number.isFinite(Number(snapshot.currentRound))
      ? Math.max(1, Math.round(Number(snapshot.currentRound)))
      : 1;
    studyState.dueRounds = cloneDueRounds(snapshot.dueRounds);
    studyState.roundCardIds = new Set(Array.isArray(snapshot.roundCardIds) ? snapshot.roundCardIds : []);
    studyState.completedRounds = normalizeCompletedRounds(snapshot.completedRounds);
    studyState.sessionCompletedRounds = normalizeCompletedRounds(snapshot.sessionCompletedRounds);
    studyState.flipped = false;
    studyState.pendingAnswer = null;

    return {
      cardId: undoEntry.cardId,
      result: normalizeResult(undoEntry.result),
      previousProgressEntry: cloneProgressEntry(undoEntry.previousProgressEntry)
    };
  }

  return {
    advanceStudy,
    cancelPendingStudyAnswer,
    commitPendingStudyAnswer,
    createStudyState,
    getCurrentStudyCard,
    getResultDelay,
    getStudyBase,
    movePreferredCardsToFront,
    queuePendingStudyAnswer,
    rememberCurrentCard,
    scheduleCurrentCard,
    shuffleCards,
    undoStudyAnswer
  };
});
