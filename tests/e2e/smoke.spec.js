const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { test, expect, _electron } = require("@playwright/test");

const projectRoot = path.resolve(__dirname, "..", "..");

async function launchKarto(options = {}) {
  const userDataDir = options.userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), "karto-e2e-"));
  const electronApp = await _electron.launch({
    args: [projectRoot],
    cwd: projectRoot,
    env: {
      ...process.env,
      ...(options.env || {}),
      KARTO_E2E: "1",
      KARTO_USER_DATA_DIR: userDataDir,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true"
    }
  });

  const page = await electronApp.firstWindow();
  await page.waitForSelector("#appMain");
  if (options.waitForReady !== false) {
    await page.waitForFunction(() => window.__kartoStartup?.ready === true);
    await page.waitForFunction(() => !!window.__kartoE2E);
    if (options.clearData !== false) {
      await page.evaluate(() => window.__kartoE2E.clearAllData());
    }
  }

  return {
    electronApp,
    page,
    userDataDir
  };
}

async function closeKarto(electronApp, userDataDir, options = {}) {
  await electronApp.close();
  if (options.removeUserDataDir !== false) {
    fs.rmSync(userDataDir, {
      recursive: true,
      force: true
    });
  }
}

async function hasVisibleKartoWindow(electronApp) {
  return electronApp.evaluate(({ BrowserWindow }) => {
    return BrowserWindow.getAllWindows().some((window) => window.isVisible());
  });
}

async function createDeck(page, name) {
  await page.locator("[data-action='create-deck']").click();
  const nameInput = page.locator("[data-deck-name-input='true']");
  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);
  await nameInput.press("Enter");
  await expect(page.locator("#editDeckTitle")).toContainText(name);
}

async function addCard(page, front, back) {
  await page.locator("#editDeckCreateCardBtn").click();
  await expect(page.locator("#createCardScreen")).toHaveClass(/is-active/);
  await page.locator("#frontTextInput").fill(front);
  await page.locator("#backTextInput").fill(back);
  await page.locator("#saveCardBtn").click();
  await expect(page.locator("#editDeckScreen")).toHaveClass(/is-active/);
  await expect(page.locator("#editDeckCardList")).toContainText(front);
}

function createSvgDataUrl(label, color, width = 640, height = 420) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${color}"/><text x="40" y="${Math.round(height / 2)}" font-size="56" fill="white">${label}</text></svg>`
  )}`;
}

function writeSvgImageFile(directory, filename, label, color) {
  const filePath = path.join(directory, filename);
  fs.writeFileSync(
    filePath,
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="${color}"/><text x="120" y="520" font-size="120" fill="white">${label}</text></svg>`
  );
  return filePath;
}

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
    await expect(page.locator(".field-limit-tooltip.visible")).toContainText(
      /Too much text|Текста слишком много|Zu viel Text/
    );
    await page.locator("#backTextInput").fill("valid answer");
    await page.locator("#saveCardBtn").click();
    await expect(page.locator("#createCardScreen")).toHaveClass(/is-active/);

    await page.locator("#frontTextInput").fill("valid front");
    await page.locator("#backTextInput").fill(["b1", "b2", "b3", "b4", "b5", "b6"].join("\n"));
    await page.locator("#addExtraSideBtn").click();
    await page.locator("[data-extra-side-input]").fill(
      Array.from({ length: 14 }, (_, index) => `extra ${index + 1}`).join("\n")
    );
    await page.locator("#saveCardBtn").click();
    await expect(page.locator("#editDeckScreen")).toHaveClass(/is-active/);

    await page.locator("#editDeckCreateCardBtn").click();
    await expect(page.locator("#createCardScreen")).toHaveClass(/is-active/);
    await page.locator("#frontTextInput").fill("blocked extra");
    await page.locator("#backTextInput").fill("valid answer");
    await page.locator("#addExtraSideBtn").click();
    await page.locator("[data-extra-side-input]").fill(
      Array.from({ length: 15 }, (_, index) => `extra ${index + 1}`).join("\n")
    );
    await page.locator("#saveCardBtn").click();
    await expect(page.locator("#createCardScreen")).toHaveClass(/is-active/);
    await expect(page.locator("[data-extra-side-input]")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator(".field-limit-tooltip.visible")).toContainText(
      /Too much text|Текста слишком много|Zu viel Text/
    );
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
