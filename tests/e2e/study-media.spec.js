const {
  addCard,
  closeKarto,
  createDeck,
  createSvgDataUrl,
  dispatchStudyEdgeClick,
  expect,
  fs,
  expectStudyCardOnNextFront,
  getCurrentStudyRuleCard,
  getStudyCardText,
  getStudyProgressEntry,
  getStudyRuleCardByFrontText,
  hasVisibleKartoWindow,
  launchKarto,
  moveStudyPointerToTopEdge,
  normalizeCssValue,
  os,
  path,
  projectRoot,
  startStudyRuleDeck,
  studyRuleCards,
  test,
  textLimitMessagePattern,
  writeSvgImageFile
} = require("./helpers/karto-e2e");

test("desktop study mode: first image card can use thumbnail without blocking", async () => {
  const { electronApp, page, userDataDir } = await launchKarto();

  try {
    const thumbImage = createSvgDataUrl("THUMB STUDY", "#a21caf");

    await page.evaluate((payload) => window.__kartoE2E.importLibraryPayload(payload), {
      schemaVersion: 2,
      decks: [
        {
          id: "deck_delayed_visual",
          name: "Delayed Visual",
          cards: [
            {
              id: "card_delayed_visual",
              frontText: "delayed image front",
              backText: "delayed image back",
              image: "",
              imageThumb: thumbImage,
              imageSide: "front"
            }
          ]
        }
      ]
    });

    await page.locator("[data-action='study'][data-deck-id='deck_delayed_visual']").click();
    await expect(page.locator("#studyScreen")).toHaveClass(/is-active/);

    const studyCard = page.locator("#studyCard");
    await expect(page.locator(".study-card-img")).toHaveAttribute("src", thumbImage);
    await studyCard.click();
    await expect(studyCard).toContainText("delayed image back");
  } finally {
    await closeKarto(electronApp, userDataDir);
  }
});

test("desktop study mode: image orientation controls media layout", async () => {
  const { electronApp, page, userDataDir } = await launchKarto();

  try {
    const portraitImage = createSvgDataUrl("PORTRAIT", "#7c3aed", 420, 720);
    const landscapeImage = createSvgDataUrl("LANDSCAPE", "#0f766e", 900, 420);

    await page.evaluate((payload) => window.__kartoE2E.importLibraryPayload(payload), {
      schemaVersion: 2,
      decks: [
        {
          id: "deck_portrait_layout",
          name: "Portrait Layout",
          cards: [
            {
              id: "card_portrait_layout",
              frontText: "portrait front",
              backText: "portrait back",
              image: portraitImage,
              imageThumb: portraitImage,
              imageSide: "front"
            }
          ]
        },
        {
          id: "deck_landscape_layout",
          name: "Landscape Layout",
          cards: [
            {
              id: "card_landscape_layout",
              frontText: "landscape front",
              backText: [
                "landscape answer with enough text to trigger the old side layout",
                "second line",
                "third line"
              ].join("\n"),
              image: landscapeImage,
              imageThumb: landscapeImage,
              imageSide: "back"
            }
          ]
        }
      ]
    });

    const studyCard = page.locator("#studyCard");
    await page.locator("[data-action='study'][data-deck-id='deck_portrait_layout']").click();
    await expect(page.locator("#studyScreen")).toHaveClass(/is-active/);
    await expect(page.locator(".study-card-img")).toHaveAttribute("src", portraitImage);
    await expect(studyCard).toHaveClass(/is-layout-side/);
    await expect(studyCard).not.toHaveClass(/is-layout-top/);

    await page.locator("#exitStudyBtn").click();
    await expect(page.locator("#homeScreen")).toHaveClass(/is-active/);

    await page.locator("[data-action='study'][data-deck-id='deck_landscape_layout']").click();
    await expect(page.locator("#studyScreen")).toHaveClass(/is-active/);
    await studyCard.click();
    await expect(page.locator(".study-card-img")).toHaveAttribute("src", landscapeImage);
    await expect(studyCard).toHaveClass(/is-layout-top/);
    await expect(studyCard).not.toHaveClass(/is-layout-side/);
  } finally {
    await closeKarto(electronApp, userDataDir);
  }
});

test("desktop study keeps short front text at original scale without scrollbar", async () => {
  const { electronApp, page, userDataDir } = await launchKarto();

  try {
    await createDeck(page, "Study Scale");
    await addCard(page, "allowed", "permitted");

    await page.locator("#startDeckStudyBtn").click();
    await expect(page.locator("#studyScreen")).toHaveClass(/is-active/);
    await expect(page.locator(".study-front-text")).toContainText("allowed");
    await expect(page.locator(".study-answer-progress")).toHaveCount(0);

    const frontMetrics = await page.locator(".study-front-text").evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        className: element.className,
        fontSize: Number.parseFloat(style.fontSize),
        overflowY: style.overflowY
      };
    });

    expect(frontMetrics.className).not.toContain("is-scrollable");
    expect(frontMetrics.overflowY).not.toBe("auto");
    expect(frontMetrics.fontSize).toBeGreaterThan(52);
  } finally {
    await closeKarto(electronApp, userDataDir);
  }
});

test("desktop study mode: revealed answers advance with the intended result", async () => {
  const { electronApp, page, userDataDir } = await launchKarto();

  try {
    let studyCard = await startStudyRuleDeck(page);
    let currentCard = await getCurrentStudyRuleCard(studyCard);

    await page.keyboard.press("ArrowRight");
    await expectStudyCardOnNextFront(studyCard, currentCard);
    await expect.poll(async () => {
      const entry = await getStudyProgressEntry(page, currentCard.id);
      return entry ? `${entry.lastResult}:${entry.correctCount}` : null;
    }).toBe("correct:1");

    const answeredCard = currentCard;
    currentCard = await getCurrentStudyRuleCard(studyCard);
    await page.keyboard.press("ArrowLeft");
    await expect(studyCard).toContainText(currentCard.backText);
    await page.keyboard.press("ArrowUp");
    await expect(studyCard).toContainText(answeredCard.frontText);
    expect(await getStudyProgressEntry(page, currentCard.id)).toBeNull();
    await expect.poll(async () => getStudyProgressEntry(page, answeredCard.id)).toBeNull();

    studyCard = await startStudyRuleDeck(page);
    currentCard = await getCurrentStudyRuleCard(studyCard);

    await page.keyboard.press("ArrowLeft");
    await expect(studyCard).toContainText(currentCard.backText);
    await studyCard.click();
    await expectStudyCardOnNextFront(studyCard, currentCard);
    await expect.poll(async () => {
      return (await getStudyProgressEntry(page, currentCard.id))?.lastResult || null;
    }).toBe("wrong");

    studyCard = await startStudyRuleDeck(page);
    currentCard = await getCurrentStudyRuleCard(studyCard);

    await page.keyboard.press("ArrowDown");
    await expect(studyCard).toContainText(currentCard.backText);
    await page.keyboard.press("ArrowRight");
    await expectStudyCardOnNextFront(studyCard, currentCard);
    await expect.poll(async () => {
      const entry = await getStudyProgressEntry(page, currentCard.id);
      return entry ? `${entry.lastResult}:${entry.correctCount}` : null;
    }).toBe("correct:1");

    studyCard = await startStudyRuleDeck(page);
    currentCard = await getCurrentStudyRuleCard(studyCard);

    await page.keyboard.press("ArrowLeft");
    await expect(studyCard).toContainText(currentCard.backText);
    await moveStudyPointerToTopEdge(page);
    await dispatchStudyEdgeClick(page, "unsureZone", "bottom");
    await expectStudyCardOnNextFront(studyCard, currentCard);
    await expect.poll(async () => {
      return (await getStudyProgressEntry(page, currentCard.id))?.lastResult || null;
    }).toBe("unsure");

    studyCard = await startStudyRuleDeck(page);
    currentCard = await getCurrentStudyRuleCard(studyCard);

    await studyCard.click();
    await expect(studyCard).toContainText(currentCard.backText);
    await dispatchStudyEdgeClick(page, "wrongZone", "left");
    await expectStudyCardOnNextFront(studyCard, currentCard);
    await expect.poll(async () => {
      return (await getStudyProgressEntry(page, currentCard.id))?.lastResult || null;
    }).toBe("wrong");

    studyCard = await startStudyRuleDeck(page);
    currentCard = await getCurrentStudyRuleCard(studyCard);

    await studyCard.click();
    await expect(studyCard).toContainText(currentCard.backText);
    await studyCard.click();
    await expect(studyCard).toContainText(currentCard.frontText);
    expect(await getStudyProgressEntry(page, currentCard.id)).toBeNull();
    await page.keyboard.press("ArrowDown");
    await expectStudyCardOnNextFront(studyCard, currentCard);
    await expect.poll(async () => {
      return (await getStudyProgressEntry(page, currentCard.id))?.lastResult || null;
    }).toBe("unsure");
  } finally {
    await closeKarto(electronApp, userDataDir);
  }
});
