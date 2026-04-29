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

test("desktop cards can add and study additional sides", async () => {
  const { electronApp, page, userDataDir } = await launchKarto();

  try {
    await createDeck(page, "Extra Sides");
    await page.locator("#editDeckCreateCardBtn").click();
    await expect(page.locator("#createCardScreen")).toHaveClass(/is-active/);
    await expect(page.locator("#addExtraSideBtn")).toContainText(/Add additional side|Добавить дополнительную сторону/);
    await expect(page.locator(".field-counter")).toHaveCount(0);
    await expect(page.locator(".field-limit-row")).toHaveCount(0);
    await page.locator("#frontTextInput").fill("multi side front");
    await page.locator("#backTextInput").fill("first additional side");
    await page.locator("#addExtraSideBtn").click();
    await page.locator("[data-extra-side-input]").fill("second additional side");
    await page.locator("#saveCardBtn").click();
    await expect(page.locator("#editDeckScreen")).toHaveClass(/is-active/);

    const exportedPayload = await page.evaluate(() => window.__kartoE2E.exportLibraryPayload());
    expect(exportedPayload.decks[0].cards[0].extraSides).toEqual([
      expect.objectContaining({ text: "second additional side" })
    ]);

    await page.locator("#startDeckStudyBtn").click();
    await expect(page.locator("#studyScreen")).toHaveClass(/is-active/);
    const studyCard = page.locator("#studyCard");
    await expect(studyCard).toContainText("multi side front");
    await studyCard.click();
    await expect(studyCard).toContainText("first additional side");
    await expect(page.locator(".study-answer-progress")).toContainText("1 / 2");
    await studyCard.click();
    await expect(studyCard).toContainText("second additional side");
    await expect(page.locator(".study-answer-progress")).toContainText("2 / 2");
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => {
      const payload = await page.evaluate(() => window.__kartoE2E.snapshot());
      return Object.values(payload.studyProgress)[0]?.lastResult || null;
    }).toBe("correct");
  } finally {
    await closeKarto(electronApp, userDataDir);
  }
});

test("desktop card form shows text limit message only after hard limit", async () => {
  const { electronApp, page, userDataDir } = await launchKarto();

  try {
    await createDeck(page, "Limit Tooltips");
    await page.locator("#editDeckCreateCardBtn").click();
    await expect(page.locator("#createCardScreen")).toHaveClass(/is-active/);
    await expect(page.locator(".field-counter")).toHaveCount(0);
    await expect(page.locator(".field-limit-row")).toHaveCount(0);

    await page.locator("#frontTextInput").fill("a".repeat(81));
    await expect(page.locator("#frontTextInput")).not.toHaveClass(/is-limit-warning/);
    await expect(page.locator(".field-limit-tooltip.visible")).toHaveCount(0);

    await page.locator("#frontTextInput").fill("a".repeat(121));
    await expect(page.locator("#frontTextInput")).toHaveClass(/is-limit-error/);
    await expect(page.locator("#frontTextInput")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator(".field-limit-tooltip.visible")).toContainText(textLimitMessagePattern);
    await page.locator("#backTextInput").fill("valid answer");
    await page.locator("#saveCardBtn").click();
    await expect(page.locator("#createCardScreen")).toHaveClass(/is-active/);

    await page.locator("#frontTextInput").fill("valid front");
    await page.locator("#backTextInput").fill(["b1", "b2", "b3", "b4", "b5", "b6"].join("\n"));
    await page.locator("#addExtraSideBtn").click();
    await page.locator("[data-extra-side-input]").fill(
      Array.from({ length: 9 }, (_, index) => `extra ${index + 1}`).join("\n")
    );
    await page.locator("#saveCardBtn").click();
    await expect(page.locator("#editDeckScreen")).toHaveClass(/is-active/);

    await page.locator("#editDeckCreateCardBtn").click();
    await expect(page.locator("#createCardScreen")).toHaveClass(/is-active/);
    await page.locator("#frontTextInput").fill("blocked extra");
    await page.locator("#backTextInput").fill("valid answer");
    await page.locator("#addExtraSideBtn").click();
    await page.locator("[data-extra-side-input]").fill(
      Array.from({ length: 10 }, (_, index) => `extra ${index + 1}`).join("\n")
    );
    await page.locator("#saveCardBtn").click();
    await expect(page.locator("#createCardScreen")).toHaveClass(/is-active/);
    await expect(page.locator("[data-extra-side-input]")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator(".field-limit-tooltip.visible")).toContainText(textLimitMessagePattern);
  } finally {
    await closeKarto(electronApp, userDataDir);
  }
});
