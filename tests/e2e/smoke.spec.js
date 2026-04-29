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

test("desktop smoke: create cards, study back, export/import", async () => {
  const { electronApp, page, userDataDir } = await launchKarto();

  try {
    await createDeck(page, "E2E Deck");
    await addCard(page, "alpha", "first answer");
    await addCard(page, "beta", "second answer");

    await page.locator("#startDeckStudyBtn").click();
    await expect(page.locator("#studyScreen")).toHaveClass(/is-active/);

    const studyCard = page.locator("#studyCard");
    const firstFront = (await studyCard.innerText()).trim();
    expect(firstFront.length).toBeGreaterThan(0);

    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await studyCard.innerText()).trim()).not.toBe(firstFront);

    await page.keyboard.press("ArrowUp");
    await expect(studyCard).toContainText(firstFront);

    const exportedPayload = await page.evaluate(() => window.__kartoE2E.exportLibraryPayload());
    expect(exportedPayload.decks).toHaveLength(1);
    expect(exportedPayload.decks[0].cards).toHaveLength(2);

    await page.evaluate(() => window.__kartoE2E.clearAllData());
    await expect(page.locator(".deck-tile-name")).toHaveCount(0);

    const importResult = await page.evaluate((payload) => {
      return window.__kartoE2E.importLibraryPayload(payload);
    }, exportedPayload);
    expect(importResult.addedCount).toBe(1);
    await expect(page.locator(".deck-tile-name")).toContainText("E2E Deck");

    const fullImage = createSvgDataUrl("FULL", "#0f766e");
    const thumbImage = createSvgDataUrl("THUMB", "#be123c");
    const bigDeckCards = Array.from({ length: 8 }, (_, index) => ({
      id: `card_big_${index + 1}`,
      frontText: `big front ${index + 1}`,
      backText: `big back ${index + 1}`,
      image: createSvgDataUrl(`BIGFULL${index + 1}`, "#1d4ed8"),
      imageThumb: createSvgDataUrl(`BIGTHUMB${index + 1}`, "#9333ea"),
      imageSide: "front"
    }));
    const visualPayload = {
      schemaVersion: 2,
      decks: [
        {
          id: "deck_visual",
          name: "Visual Deck",
          cards: [
            {
              id: "card_visual",
              frontText: "image front",
              backText: "image back",
              image: fullImage,
              imageThumb: thumbImage,
              imageSide: "front"
            }
          ]
        },
        {
          id: "deck_big",
          name: "Big Visual Deck",
          cards: bigDeckCards
        }
      ]
    };

    await page.evaluate(() => window.__kartoE2E.clearAllData());
    await page.evaluate((payload) => window.__kartoE2E.importLibraryPayload(payload), visualPayload);
    await expect(page.locator(".deck-tile[data-deck-id='deck_visual'] .deck-tile-name")).toContainText("Visual Deck");
    await expect(page.locator(".deck-tile[data-deck-id='deck_visual'] .deck-media-image.is-active")).toHaveAttribute("src", thumbImage);

    const bigDeckSrc = await page.locator(".deck-tile[data-deck-id='deck_big'] .deck-media-image.is-active").getAttribute("src");
    expect(bigDeckSrc).toContain("BIGTHUMB");

    const homeSnapshot = await page.evaluate(() => window.__kartoE2E.snapshot());
    expect(homeSnapshot.homeMediaCache.deck_visual.images).toContain(thumbImage);
    expect(homeSnapshot.homeMediaCache.deck_big.images).toHaveLength(8);

    const retainedSrc = await page.evaluate(() => {
      const tile = document.querySelector(".deck-tile[data-deck-id='deck_visual']");
      tile.dataset.probe = "kept";
      return tile.querySelector(".deck-media-image.is-active").getAttribute("src");
    });
    await page.locator(".sidebar-link[data-nav='libraryScreen']").click();
    await expect(page.locator("#libraryScreen")).toHaveClass(/is-active/);
    await page.locator(".sidebar-link[data-nav='homeScreen']").click();
    await expect(page.locator(".deck-tile[data-deck-id='deck_visual'][data-probe='kept']")).toHaveCount(1);
    await expect(page.locator(".deck-tile[data-deck-id='deck_visual'] .deck-media-image.is-active")).toHaveAttribute("src", retainedSrc);

    await page.locator("[data-action='study'][data-deck-id='deck_visual']").click();
    await expect(page.locator("#studyScreen")).toHaveClass(/is-active/);
    await expect(page.locator(".study-card-img")).toHaveAttribute("src", thumbImage);

    const visualExport = await page.evaluate(() => window.__kartoE2E.exportLibraryPayload());
    expect(visualExport.decks.find((deck) => deck.id === "deck_visual").cards[0].imageThumb).toBe(thumbImage);
    expect(visualExport.decks.some((deck) => Object.hasOwn(deck, "homeMediaCache"))).toBe(false);
  } finally {
    await closeKarto(electronApp, userDataDir);
  }
});
