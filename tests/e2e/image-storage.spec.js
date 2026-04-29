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

test("desktop image storage: local uploads and old imports export lightweight media", async () => {
  const { electronApp, page, userDataDir } = await launchKarto();

  try {
    await createDeck(page, "Light Images");
    await page.locator("#editDeckCreateCardBtn").click();
    await expect(page.locator("#createCardScreen")).toHaveClass(/is-active/);
    await page.locator("#frontTextInput").fill("light front");
    await page.locator("#backTextInput").fill("light back");
    await page.locator("#imageSideFrontBtn").click();
    await page.locator("#imageFileInput").setInputFiles(
      writeSvgImageFile(userDataDir, "local-upload.svg", "LOCAL ORIGINAL", "#0f766e")
    );
    await expect.poll(() => page.locator("#imageInput").inputValue()).toContain("data:image/jpeg");
    await page.locator("#saveCardBtn").click();
    await expect(page.locator("#editDeckScreen")).toHaveClass(/is-active/);
    await page.waitForTimeout(250);

    let exportedPayload = await page.evaluate(() => window.__kartoE2E.exportLibraryPayload());
    let exportedCard = exportedPayload.decks[0].cards[0];
    expect(exportedCard.image).toContain("data:image/jpeg");
    expect(exportedCard.imageThumb).toContain("data:image/jpeg");
    expect(exportedCard.imageStudy).toBe("");

    await page.locator("#startDeckStudyBtn").click();
    await expect(page.locator("#studyScreen")).toHaveClass(/is-active/);
    await expect(page.locator(".study-card-img")).toHaveAttribute("src", exportedCard.imageThumb);

    const oldFullImage = createSvgDataUrl("OLD FULL", "#1d4ed8");
    const oldStudyImage = createSvgDataUrl("OLD STUDY", "#15803d");
    const oldThumbImage = createSvgDataUrl("OLD THUMB", "#be123c");

    await page.evaluate(() => window.__kartoE2E.clearAllData());
    await page.evaluate((payload) => window.__kartoE2E.importLibraryPayload(payload), {
      schemaVersion: 2,
      decks: [
        {
          id: "deck_old_media",
          name: "Old Media",
          cards: [
            {
              id: "card_old_media",
              frontText: "old front",
              backText: "old back",
              image: oldFullImage,
              imageThumb: oldThumbImage,
              imageStudy: oldStudyImage,
              imageSide: "front"
            }
          ]
        }
      ]
    });

    exportedPayload = await page.evaluate(() => window.__kartoE2E.exportLibraryPayload());
    exportedCard = exportedPayload.decks[0].cards[0];
    expect(exportedCard.image).toBe(oldStudyImage);
    expect(exportedCard.imageThumb).toBe(oldThumbImage);
    expect(exportedCard.imageStudy).toBe("");
  } finally {
    await closeKarto(electronApp, userDataDir);
  }
});
