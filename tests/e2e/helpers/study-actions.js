const { expect } = require("./electron-app");

const studyRuleCards = [
  {
    id: "card_study_rule_1",
    frontText: "rule front one",
    backText: "rule back one",
    image: ""
  },
  {
    id: "card_study_rule_2",
    frontText: "rule front two",
    backText: "rule back two",
    image: ""
  },
  {
    id: "card_study_rule_3",
    frontText: "rule front three",
    backText: "rule back three",
    image: ""
  }
];

function getStudyRuleCardByFrontText(frontText) {
  return studyRuleCards.find((card) => card.frontText === frontText);
}

async function getStudyCardText(studyCard) {
  return (await studyCard.innerText()).trim();
}

async function getStudyProgressEntry(page, cardId) {
  return page.evaluate((id) => window.__kartoE2E.snapshot().studyProgress[id] || null, cardId);
}

async function moveStudyPointerToTopEdge(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new MouseEvent("mousemove", {
      bubbles: true,
      clientX: Math.floor(window.innerWidth / 2),
      clientY: 4
    }));
  });
}

async function dispatchStudyEdgeClick(page, elementId, pointName) {
  await page.evaluate(({ targetId, point }) => {
    const target = document.getElementById(targetId);
    if (!target) {
      throw new Error(`Missing study edge: ${targetId}`);
    }

    const points = {
      left: { clientX: 12, clientY: Math.floor(window.innerHeight / 2) },
      right: { clientX: window.innerWidth - 12, clientY: Math.floor(window.innerHeight / 2) },
      bottom: { clientX: Math.floor(window.innerWidth / 2), clientY: window.innerHeight - 12 }
    };
    const coords = points[point];

    target.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      detail: 1,
      clientX: coords.clientX,
      clientY: coords.clientY
    }));
  }, { targetId: elementId, point: pointName });
}

async function startStudyRuleDeck(page) {
  await page.evaluate(() => window.__kartoE2E.clearAllData());
  await page.evaluate((cards) => {
    return window.__kartoE2E.importLibraryPayload({
      schemaVersion: 2,
      decks: [
        {
          id: "deck_study_rules",
          name: "Study Rules",
          cards
        }
      ]
    });
  }, studyRuleCards);
  await expect(page.locator(".deck-tile[data-deck-id='deck_study_rules'] .deck-tile-name")).toContainText("Study Rules");
  await page.locator("[data-action='study'][data-deck-id='deck_study_rules']").click();
  await expect(page.locator("#studyScreen")).toHaveClass(/is-active/);

  const studyCard = page.locator("#studyCard");
  await expect.poll(async () => getStudyCardText(studyCard)).not.toBe("");
  return studyCard;
}

async function getCurrentStudyRuleCard(studyCard) {
  const frontText = await getStudyCardText(studyCard);
  const currentCard = getStudyRuleCardByFrontText(frontText);
  expect(currentCard).toBeTruthy();
  return currentCard;
}

async function expectStudyCardOnNextFront(studyCard, previousCard) {
  await expect.poll(async () => {
    const card = getStudyRuleCardByFrontText(await getStudyCardText(studyCard));
    return card && card.id !== previousCard.id ? card.id : null;
  }).not.toBeNull();
}

module.exports = {
  dispatchStudyEdgeClick,
  expectStudyCardOnNextFront,
  getCurrentStudyRuleCard,
  getStudyCardText,
  getStudyProgressEntry,
  getStudyRuleCardByFrontText,
  moveStudyPointerToTopEdge,
  startStudyRuleDeck,
  studyRuleCards
};
