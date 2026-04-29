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

test("desktop home dark theme keeps tile hover restrained", async () => {
  const { electronApp, page, userDataDir } = await launchKarto();

  try {
    await page.evaluate((payload) => window.__kartoE2E.importLibraryPayload(payload), {
      schemaVersion: 2,
      decks: [
        {
          id: "deck_dark_hover",
          name: "Dark Hover",
          cards: [
            {
              id: "card_dark_hover",
              frontText: "hover front",
              backText: "hover back",
              image: createSvgDataUrl("HOVER", "#0f766e")
            }
          ]
        }
      ]
    });

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });

    const deckTile = page.locator(".deck-tile[data-deck-id='deck_dark_hover']");
    await expect(deckTile).toBeVisible();
    await deckTile.hover();
    await expect(deckTile.locator(".tile-action").first()).toHaveCSS("opacity", "1");

    const deckHover = await page.evaluate(() => {
      const tile = document.querySelector(".deck-tile[data-deck-id='deck_dark_hover']");
      const rootStyle = getComputedStyle(document.documentElement);
      const tileStyle = getComputedStyle(tile);

      return {
        borderColor: tileStyle.borderColor,
        borderStrong: rootStyle.getPropertyValue("--border-strong"),
        accent: rootStyle.getPropertyValue("--accent")
      };
    });

    expect(normalizeCssValue(deckHover.borderColor)).toBe(normalizeCssValue(deckHover.borderStrong));
    expect(normalizeCssValue(deckHover.borderColor)).not.toBe(normalizeCssValue(deckHover.accent));

    const createTile = page.locator(".create-tile");
    await expect(createTile).toBeVisible();
    await createTile.hover();

    const createHover = await page.evaluate(() => {
      const tile = document.querySelector(".create-tile");
      const rootStyle = getComputedStyle(document.documentElement);
      const tileStyle = getComputedStyle(tile);
      const probe = document.createElement("div");
      probe.style.color = rootStyle.getPropertyValue("--accent-bg").trim();
      document.body.appendChild(probe);
      const accentBg = getComputedStyle(probe).color;
      probe.remove();

      return {
        borderColor: tileStyle.borderColor,
        borderStrong: rootStyle.getPropertyValue("--border-strong"),
        backgroundImage: tileStyle.backgroundImage,
        accentBg
      };
    });

    expect(normalizeCssValue(createHover.borderColor)).toBe(normalizeCssValue(createHover.borderStrong));
    expect(normalizeCssValue(createHover.backgroundImage)).not.toContain(normalizeCssValue(createHover.accentBg));
  } finally {
    await closeKarto(electronApp, userDataDir);
  }
});
