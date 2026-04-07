(function(root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis, function(root) {
  function createStudyState(deck) {
    const cards = Array.isArray(deck?.cards) ? deck.cards : [];

    return {
      queue: cards.map((card) => ({ ...card })),
      history: [],
      currentIndex: 0,
      flipped: false,
      pendingInterval: null
    };
  }

  function getStudyBase(queueLength) {
    return Math.max(2, Math.floor(queueLength * 0.1));
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

  function scheduleCurrentCard(studyState, interval, randomFn = Math.random) {
    const currentCard = getCurrentStudyCard(studyState);
    if (!currentCard) return;

    studyState.queue.splice(studyState.currentIndex, 1);

    const shift = Math.floor(randomFn() * 3);
    let nextIndex = studyState.currentIndex + interval + shift;
    if (nextIndex > studyState.queue.length) {
      nextIndex = studyState.queue.length;
    }

    studyState.queue.splice(nextIndex, 0, currentCard);

    if (studyState.currentIndex >= studyState.queue.length) {
      studyState.currentIndex = 0;
    }
  }

  function advanceStudy(studyState, interval, randomFn = Math.random) {
    if (!studyState.queue.length) return;

    rememberCurrentCard(studyState);
    scheduleCurrentCard(studyState, interval, randomFn);
    studyState.flipped = false;
    studyState.pendingInterval = null;
  }

  function goToPreviousCard(studyState, randomFn = Math.random) {
    if (!studyState.history.length) return false;

    const previousCardId = studyState.history.pop();
    scheduleCurrentCard(studyState, getStudyBase(studyState.queue.length), randomFn);

    const previousIndex = studyState.queue.findIndex((card) => card.id === previousCardId);
    if (previousIndex === -1) {
      return false;
    }

    studyState.currentIndex = previousIndex;
    studyState.flipped = false;
    studyState.pendingInterval = null;
    return true;
  }

  return {
    advanceStudy,
    createStudyState,
    getCurrentStudyCard,
    getStudyBase,
    goToPreviousCard,
    rememberCurrentCard,
    scheduleCurrentCard
  };
});
