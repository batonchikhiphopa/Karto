const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { test, expect, _electron } = require("@playwright/test");

const projectRoot = path.resolve(__dirname, "..", "..", "..");

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

function normalizeCssValue(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

const textLimitMessagePattern =
  /Too much text\. Please add an additional side\.|Текста слишком много, пожалуйста, добавьте дополнительную сторону\.|Zu viel Text\. Bitte füge eine zusätzliche Seite hinzu\./;

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
  addCard,
  closeKarto,
  createDeck,
  createSvgDataUrl,
  dispatchStudyEdgeClick,
  expect,
  expectStudyCardOnNextFront,
  fs,
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
};
