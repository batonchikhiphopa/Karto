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

module.exports = {
  closeKarto,
  expect,
  fs,
  hasVisibleKartoWindow,
  launchKarto,
  os,
  path,
  projectRoot,
  test
};
