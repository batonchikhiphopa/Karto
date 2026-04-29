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

test("desktop startup keeps window hidden until renderer is ready", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "karto-e2e-hidden-startup-"));
  let electronApp = null;
  let page;

  try {
    ({ electronApp, page } = await launchKarto({
      userDataDir,
      clearData: false,
      waitForReady: false,
      env: {
        KARTO_E2E_STARTUP_PREWARM_DELAY_MS: "1200"
      }
    }));

    await expect(page.locator("#bootScreen")).toBeVisible();
    expect(await hasVisibleKartoWindow(electronApp)).toBe(false);

    await page.waitForFunction(() => window.__kartoStartup?.ready === true);
    await expect(page.locator("#bootScreen")).toBeHidden();
    await expect.poll(() => hasVisibleKartoWindow(electronApp)).toBe(true);
  } finally {
    if (electronApp) {
      await closeKarto(electronApp, userDataDir);
    }
  }
});

test("desktop startup fully loads study cards before deck click", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "karto-e2e-preselect-"));
  let electronApp = null;
  let page;

  try {
    ({ electronApp, page } = await launchKarto({ userDataDir }));

    const cards = Array.from({ length: 6 }, (_, index) => ({
      id: `card_preselect_${index + 1}`,
      frontText: `preselect front ${index + 1}`,
      backText: `preselect back ${index + 1}`,
      image: createSvgDataUrl(`PRESELECT FULL ${index + 1}`, "#1d4ed8"),
      imageThumb: createSvgDataUrl(`PRESELECT THUMB ${index + 1}`, "#be123c"),
      imageSide: "front"
    }));

    await page.evaluate((payload) => window.__kartoE2E.importLibraryPayload(payload), {
      schemaVersion: 2,
      decks: [
        {
          id: "deck_preselect",
          name: "Preselect",
          cards
        }
      ]
    });

    await closeKarto(electronApp, userDataDir, { removeUserDataDir: false });
    electronApp = null;

    ({ electronApp, page } = await launchKarto({
      userDataDir,
      clearData: false,
      waitForReady: false,
      env: {
        KARTO_E2E_STARTUP_PREWARM_DELAY_MS: "450"
      }
    }));

    await expect(page.locator("#bootScreen")).toBeVisible();
    await page.waitForFunction(() => !!window.__kartoE2E);
    await expect(page.locator("#bootScreen")).toBeHidden();

    const loadedDeck = await page.evaluate(() => {
      const snapshot = window.__kartoE2E.snapshot();
      return snapshot.decks.decks.find((deck) => deck.id === "deck_preselect");
    });

    expect(loadedDeck.cardsHydrated).toBe(true);
    expect(loadedDeck.cards).toHaveLength(6);
    expect(loadedDeck.cards.every((card) => card.image && card.imageThumb)).toBe(true);

    await page.locator("[data-action='study'][data-deck-id='deck_preselect']").click();
    await expect(page.locator("#studyScreen")).toHaveClass(/is-active/);

    const studyCard = page.locator("#studyCard");
    for (let index = 0; index < loadedDeck.cards.length; index += 1) {
      await expect(studyCard).toContainText(loadedDeck.cards[index].frontText);
      await expect(page.locator(".study-card-img")).toHaveAttribute("src", loadedDeck.cards[index].imageThumb);

      if (index < loadedDeck.cards.length - 1) {
        await page.keyboard.press("ArrowRight");
      }
    }
  } finally {
    if (electronApp) {
      await closeKarto(electronApp, userDataDir);
    } else {
      fs.rmSync(userDataDir, {
        recursive: true,
        force: true
      });
    }
  }
});
