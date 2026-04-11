const assert = require("node:assert/strict");

const {
  advanceStudy,
  cancelPendingStudyAnswer,
  commitPendingStudyAnswer,
  createStudyState,
  getCurrentStudyCard,
  getStudyBase,
  queuePendingStudyAnswer
} = require("../js/study-engine.js");

function makeCards(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `card_${index + 1}`,
    frontText: `Card ${index + 1}`,
    backText: `Back ${index + 1}`,
    image: ""
  }));
}

function createState(count, randomFn = () => 0, options = {}) {
  return createStudyState({ cards: makeCards(count) }, randomFn, options);
}

function testCreateStudyStateShufflesFirstRound() {
  const studyState = createState(4, () => 0);

  assert.deepEqual(
    studyState.queue.map((card) => card.id),
    ["card_2", "card_3", "card_4", "card_1"]
  );
  assert.equal(studyState.currentRound, 1);
}

function testRoundDoesNotRepeatBeforeEveryCardAppears() {
  const studyState = createState(4, () => 0);
  const seenInFirstRound = [];

  for (let index = 0; index < 4; index += 1) {
    seenInFirstRound.push(getCurrentStudyCard(studyState).id);
    advanceStudy(studyState, "wrong", () => 0);
  }

  assert.equal(new Set(seenInFirstRound).size, 4);
  assert.deepEqual(seenInFirstRound, ["card_2", "card_3", "card_4", "card_1"]);
  assert.equal(studyState.currentRound, 2);
  assert.deepEqual(
    studyState.queue.map((card) => card.id).sort(),
    ["card_1", "card_2", "card_3", "card_4"]
  );
}

function testEarlyRoundDelays() {
  const expectedDueRounds = {
    wrong: 2,
    unsure: 3,
    correct: 4
  };

  Object.entries(expectedDueRounds).forEach(([result, dueRound]) => {
    const studyState = createState(1, () => 0);
    const cardId = getCurrentStudyCard(studyState).id;

    advanceStudy(studyState, result, () => 0);

    assert.equal(studyState.dueRounds[cardId], dueRound);
  });
}

function testBaseDelaysAfterThirdRound() {
  const base = getStudyBase(30);
  const expectations = {
    wrong: 1 + base,
    unsure: 1 + base * 3,
    correct: 1 + base * 6
  };

  Object.entries(expectations).forEach(([result, dueRound]) => {
    const studyState = createState(30, () => 0, { completedRounds: 3 });
    const currentCard = studyState.allCards[0];
    studyState.queue = [{ ...currentCard }];
    studyState.currentIndex = 0;

    advanceStudy(studyState, result, () => 0);

    assert.equal(studyState.dueRounds[currentCard.id], dueRound);
  });
}

function testCompletedRoundsIncrementAfterFullRound() {
  const studyState = createState(2, () => 0, { completedRounds: 2 });

  advanceStudy(studyState, "wrong", () => 0);
  assert.equal(studyState.sessionCompletedRounds, 0);
  assert.equal(studyState.completedRounds, 2);

  advanceStudy(studyState, "wrong", () => 0);
  assert.equal(studyState.sessionCompletedRounds, 1);
  assert.equal(studyState.completedRounds, 3);
}

function testEmptyEligibleRoundJumpsToNearestDueRound() {
  const studyState = createState(1, () => 0);
  const cardId = getCurrentStudyCard(studyState).id;

  advanceStudy(studyState, "correct", () => 0);

  assert.equal(studyState.dueRounds[cardId], 4);
  assert.equal(studyState.currentRound, 4);
  assert.equal(getCurrentStudyCard(studyState).id, cardId);
}

function testPendingStudyAnswerCommitsAfterReveal() {
  const studyState = createState(3, () => 0);
  const firstCardId = getCurrentStudyCard(studyState).id;

  const queued = queuePendingStudyAnswer(studyState, "wrong");
  assert.equal(queued, true);
  assert.equal(studyState.flipped, true);
  assert.deepEqual(studyState.pendingAnswer, {
    result: "wrong"
  });
  assert.equal(getCurrentStudyCard(studyState).id, firstCardId);

  const committed = commitPendingStudyAnswer(studyState, () => 0);
  assert.deepEqual(committed, {
    result: "wrong"
  });
  assert.equal(studyState.pendingAnswer, null);
  assert.equal(studyState.flipped, false);
  assert.deepEqual(studyState.history, [firstCardId]);
  assert.notEqual(getCurrentStudyCard(studyState).id, firstCardId);
}

function testPendingStudyAnswerCanBeCanceledWithoutAdvancing() {
  const studyState = createState(2, () => 0);
  const firstCardId = getCurrentStudyCard(studyState).id;

  queuePendingStudyAnswer(studyState, "unsure");

  const canceled = cancelPendingStudyAnswer(studyState);
  assert.equal(canceled, true);
  assert.equal(studyState.pendingAnswer, null);
  assert.equal(studyState.flipped, false);
  assert.deepEqual(studyState.history, []);
  assert.equal(getCurrentStudyCard(studyState).id, firstCardId);
}

testCreateStudyStateShufflesFirstRound();
testRoundDoesNotRepeatBeforeEveryCardAppears();
testEarlyRoundDelays();
testBaseDelaysAfterThirdRound();
testCompletedRoundsIncrementAfterFullRound();
testEmptyEligibleRoundJumpsToNearestDueRound();
testPendingStudyAnswerCommitsAfterReveal();
testPendingStudyAnswerCanBeCanceledWithoutAdvancing();

console.log("study-engine tests passed");
