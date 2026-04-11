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
    const result = cards.map((card) => ({ ...card }));

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

  function createStudyState(deck, randomFn = Math.random, options = {}) {
    const cards = Array.isArray(deck?.cards) ? deck.cards : [];
    const allCards = cards.map((card) => ({ ...card }));
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
    return studyState;
  }

  function getCurrentStudyCard(studyState) {
    return studyState.queue[studyState.currentIndex] || null;
  }

  function rememberCurrentCard(studyState) {
    const currentCard = getCurrentStudyCard(studyState);
    if (!currentCard) return;

    const lastCardId = studyState.history[studyState.history.length - 1];
    if (lastCardId !== currentCard.id) {
      studyState.history.push(currentCard.id);
    }
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

  function advanceStudy(studyState, result, randomFn = Math.random) {
    if (!studyState.queue.length) return;

    rememberCurrentCard(studyState);
    scheduleCurrentCard(studyState, result, randomFn);
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

  function commitPendingStudyAnswer(studyState, randomFn = Math.random) {
    if (!studyState.pendingAnswer || !studyState.queue.length) {
      return null;
    }

    const committedAnswer = {
      result: studyState.pendingAnswer.result
    };

    advanceStudy(studyState, committedAnswer.result, randomFn);
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

  return {
    advanceStudy,
    cancelPendingStudyAnswer,
    commitPendingStudyAnswer,
    createStudyState,
    getCurrentStudyCard,
    getResultDelay,
    getStudyBase,
    queuePendingStudyAnswer,
    rememberCurrentCard,
    scheduleCurrentCard,
    shuffleCards
  };
});
