const { expect } = require("./electron-app");

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

module.exports = {
  addCard,
  createDeck
};
