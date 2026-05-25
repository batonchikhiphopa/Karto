const assert = require("node:assert/strict");

const {
  advanceStudy,
  cancelPendingStudyAnswer,
  commitPendingStudyAnswer,
  createStudyState,
  getCurrentStudyCard,
  getStudyBase,
  isStudyProgressDue,
  normalizeStudyProgressEntry,
  queuePendingStudyAnswer,
  scheduleStudyProgressAnswer,
  undoStudyAnswer
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

function testCreateStudyStateMovesPreferredCardsToFront() {
  const studyState = createState(4, () => 0, {
    preferredCardIds: ["card_4", "card_1", "card_4", "missing_card"]
  });

  assert.deepEqual(
    studyState.queue.map((card) => card.id),
    ["card_4", "card_1", "card_2", "card_3"]
  );
  assert.equal(studyState.totalCount, 4);
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
  assert.equal(studyState.history.length, 1);
  assert.equal(studyState.history[0].cardId, firstCardId);
  assert.equal(studyState.history[0].result, "wrong");
  assert.equal(studyState.history[0].previousProgressEntry, null);
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

function testUndoRestoresPreviousCardAfterAnswer() {
  const studyState = createState(3, () => 0);
  const firstCardId = getCurrentStudyCard(studyState).id;
  const initialQueueIds = studyState.queue.map((card) => card.id);
  const initialDueRounds = { ...studyState.dueRounds };
  const previousProgressEntry = {
    seenCount: 2,
    correctCount: 1,
    lastResult: "wrong",
    lastReviewedAt: "2026-04-01T12:00:00.000Z",
    dueAt: null,
    intervalDays: 0,
    easeFactor: 2.5,
    lapseCount: 0
  };

  advanceStudy(studyState, "correct", () => 0, { previousProgressEntry });
  assert.notEqual(getCurrentStudyCard(studyState).id, firstCardId);

  const undone = undoStudyAnswer(studyState);
  assert.deepEqual(undone, {
    cardId: firstCardId,
    result: "correct",
    previousProgressEntry
  });
  assert.equal(getCurrentStudyCard(studyState).id, firstCardId);
  assert.deepEqual(studyState.queue.map((card) => card.id), initialQueueIds);
  assert.deepEqual(studyState.dueRounds, initialDueRounds);
  assert.equal(studyState.pendingAnswer, null);
  assert.equal(studyState.flipped, false);
  assert.deepEqual(studyState.history, []);
}

function testUndoRestoresCardAfterPendingCommit() {
  const studyState = createState(3, () => 0);
  const firstCardId = getCurrentStudyCard(studyState).id;

  queuePendingStudyAnswer(studyState, "unsure");
  commitPendingStudyAnswer(studyState, () => 0, { previousProgressEntry: null });
  assert.notEqual(getCurrentStudyCard(studyState).id, firstCardId);

  const undone = undoStudyAnswer(studyState);
  assert.equal(undone.cardId, firstCardId);
  assert.equal(undone.result, "unsure");
  assert.equal(undone.previousProgressEntry, null);
  assert.equal(getCurrentStudyCard(studyState).id, firstCardId);
  assert.equal(studyState.pendingAnswer, null);
  assert.equal(studyState.flipped, false);
}

function testUndoCanWalkBackMultipleAnswers() {
  const studyState = createState(4, () => 0);
  const firstCardId = getCurrentStudyCard(studyState).id;

  advanceStudy(studyState, "wrong", () => 0);
  const secondCardId = getCurrentStudyCard(studyState).id;
  advanceStudy(studyState, "correct", () => 0);

  assert.equal(undoStudyAnswer(studyState).cardId, secondCardId);
  assert.equal(getCurrentStudyCard(studyState).id, secondCardId);
  assert.equal(undoStudyAnswer(studyState).cardId, firstCardId);
  assert.equal(getCurrentStudyCard(studyState).id, firstCardId);
  assert.deepEqual(studyState.history, []);
}

function testUndoRestoresRoundAfterCompletedRound() {
  const studyState = createState(1, () => 0);
  const cardId = getCurrentStudyCard(studyState).id;

  advanceStudy(studyState, "correct", () => 0);
  assert.equal(studyState.currentRound, 4);
  assert.equal(studyState.completedRounds, 1);
  assert.equal(studyState.sessionCompletedRounds, 1);

  const undone = undoStudyAnswer(studyState);
  assert.equal(undone.cardId, cardId);
  assert.equal(getCurrentStudyCard(studyState).id, cardId);
  assert.equal(studyState.currentRound, 1);
  assert.equal(studyState.completedRounds, 0);
  assert.equal(studyState.sessionCompletedRounds, 0);
  assert.equal(studyState.dueRounds[cardId], 1);
  assert.equal(studyState.roundCardIds.size, 0);
}

function testScheduleStudyProgressAnswerAddsDueDateAndEase() {
  const nextEntry = scheduleStudyProgressAnswer(null, "correct", "2026-04-15T12:00:00.000Z");

  assert.equal(nextEntry.seenCount, 1);
  assert.equal(nextEntry.correctCount, 1);
  assert.equal(nextEntry.intervalDays, 1);
  assert.equal(nextEntry.easeFactor, 2.6);
  assert.equal(nextEntry.lapseCount, 0);
  assert.equal(nextEntry.dueAt, "2026-04-16T12:00:00.000Z");
}

function testScheduleStudyProgressAnswerUsesOverdueInterval() {
  const nextEntry = scheduleStudyProgressAnswer({
    seenCount: 3,
    correctCount: 2,
    intervalDays: 4,
    easeFactor: 2.5,
    dueAt: "2026-04-13T12:00:00.000Z"
  }, "correct", "2026-04-15T12:00:00.000Z");

  assert.equal(nextEntry.intervalDays, 13);
  assert.equal(nextEntry.easeFactor, 2.6);
  assert.equal(nextEntry.dueAt, "2026-04-28T12:00:00.000Z");
}

function testScheduleStudyProgressAnswerHandlesLapses() {
  const nextEntry = scheduleStudyProgressAnswer({
    seenCount: 8,
    correctCount: 5,
    intervalDays: 20,
    easeFactor: 1.35,
    lapseCount: 2,
    dueAt: "2026-04-10T12:00:00.000Z"
  }, "wrong", "2026-04-15T12:00:00.000Z");

  assert.equal(nextEntry.intervalDays, 1);
  assert.equal(nextEntry.easeFactor, 1.3);
  assert.equal(nextEntry.lapseCount, 3);
  assert.equal(nextEntry.dueAt, "2026-04-16T12:00:00.000Z");
}

function testStudyProgressDueSupportsLegacyEntries() {
  assert.equal(isStudyProgressDue(null, "2026-04-15T12:00:00.000Z"), true);
  assert.equal(isStudyProgressDue({
    seenCount: 2,
    correctCount: 1,
    lastResult: "correct",
    lastReviewedAt: "2026-04-14T12:00:00.000Z"
  }, "2026-04-15T12:00:00.000Z"), true);
  assert.equal(isStudyProgressDue({
    seenCount: 2,
    correctCount: 1,
    dueAt: "2026-04-16T12:00:00.000Z"
  }, "2026-04-15T12:00:00.000Z"), false);
  assert.equal(normalizeStudyProgressEntry({ easeFactor: 9 }).easeFactor, 3);
}

testCreateStudyStateShufflesFirstRound();
testCreateStudyStateMovesPreferredCardsToFront();
testRoundDoesNotRepeatBeforeEveryCardAppears();
testEarlyRoundDelays();
testBaseDelaysAfterThirdRound();
testCompletedRoundsIncrementAfterFullRound();
testEmptyEligibleRoundJumpsToNearestDueRound();
testPendingStudyAnswerCommitsAfterReveal();
testPendingStudyAnswerCanBeCanceledWithoutAdvancing();
testUndoRestoresPreviousCardAfterAnswer();
testUndoRestoresCardAfterPendingCommit();
testUndoCanWalkBackMultipleAnswers();
testUndoRestoresRoundAfterCompletedRound();
testScheduleStudyProgressAnswerAddsDueDateAndEase();
testScheduleStudyProgressAnswerUsesOverdueInterval();
testScheduleStudyProgressAnswerHandlesLapses();
testStudyProgressDueSupportsLegacyEntries();

console.log("study-engine tests passed");
