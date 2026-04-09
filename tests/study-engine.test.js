const assert = require("node:assert/strict");

const {
  advanceStudy,
  createStudyState,
  getCurrentStudyCard,
  getStudyBase,
  goToPreviousCard
} = require("../js/study-engine.js");

function testAdvanceStudyRecordsVisitedCards() {
  const studyState = createStudyState({
    cards: [
      { id: "card_a", frontText: "A", backText: "a", image: "" },
      { id: "card_b", frontText: "B", backText: "b", image: "" },
      { id: "card_c", frontText: "C", backText: "c", image: "" }
    ]
  });

  advanceStudy(studyState, getStudyBase(studyState.queue.length), () => 0);

  assert.deepEqual(studyState.history, ["card_a"]);
  assert.equal(getCurrentStudyCard(studyState).id, "card_b");
}

function testGoToPreviousCardUsesStableCardIds() {
  const studyState = createStudyState({
    cards: [
      { id: "card_a", frontText: "A", backText: "a", image: "" },
      { id: "card_b", frontText: "B", backText: "b", image: "" },
      { id: "card_c", frontText: "C", backText: "c", image: "" }
    ]
  });

  advanceStudy(studyState, getStudyBase(studyState.queue.length), () => 0);
  advanceStudy(studyState, getStudyBase(studyState.queue.length), () => 0);

  const movedBack = goToPreviousCard(studyState, () => 0);

  assert.equal(movedBack, true);
  assert.equal(getCurrentStudyCard(studyState).id, "card_b");
  assert.deepEqual(studyState.queue.map((card) => card.id), ["card_a", "card_b", "card_c"]);
}

testAdvanceStudyRecordsVisitedCards();
testGoToPreviousCardUsesStableCardIds();

console.log("study-engine tests passed");
