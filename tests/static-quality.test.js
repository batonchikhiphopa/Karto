const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function testRendererHasContentSecurityPolicy() {
  const indexHtml = readProjectFile("index.html");

  assert.match(indexHtml, /http-equiv="Content-Security-Policy"/);
  assert.match(indexHtml, /object-src 'none'/);
  assert.match(indexHtml, /frame-ancestors 'none'/);
}

function testMainProcessRegistersSecurityHardening() {
  const main = readProjectFile("main.js");
  const security = readProjectFile("js/main/security.js");

  assert.match(main, /configureAppSecurity/);
  assert.match(security, /setWindowOpenHandler/);
  assert.match(security, /will-navigate/);
  assert.match(security, /setPermissionRequestHandler/);
  assert.match(security, /setPermissionCheckHandler/);
}

function testStartupRetryUsesFreshUrlNavigation() {
  const main = readProjectFile("main.js");

  assert.match(main, /discardStartupWindow/);
  assert.match(main, /retry_window_created/);
  assert.match(main, /stopPendingNavigation/);
  assert.doesNotMatch(main, /reloadIgnoringCache/);
}

function testRendererBootstrapDoesNotUseSyncDesktopIpc() {
  const indexHtml = readProjectFile("index.html");

  assert.doesNotMatch(indexHtml, /getBootstrapSettingsSync/);
}

function testSettingsDoNotWriteLegacyAutoGermanArticleKey() {
  const settingsView = readProjectFile("js/views/settings-view.js");
  const browserStorageName = ["local", "Storage"].join("");

  assert.doesNotMatch(
    settingsView,
    new RegExp(`${browserStorageName}\\.setItem\\(["']autoGermanArticle["']`)
  );
  assert.doesNotMatch(settingsView, /saveSettingSync\(["']autoGermanArticle["']/);
}

function testRemovedDesktopOnlyArtifactsStayRemoved() {
  const removedFiles = [
    ["manifest", "webmanifest"].join("."),
    ["s", "w"].join("") + ".js",
    path.join("js", ["p", "w", "a"].join("") + ".js"),
    ["start", "bat"].join(".")
  ];

  removedFiles.forEach((relativePath) => {
    assert.equal(fs.existsSync(path.join(projectRoot, relativePath)), false);
  });

  const indexHtml = readProjectFile("index.html");
  removedFiles.forEach((relativePath) => {
    assert.equal(indexHtml.includes(relativePath.replace(/\\/g, "/")), false);
  });
}

function testLegacyMigrationBridgeIsRemoved() {
  const appState = readProjectFile("js/app-state.js");
  const bridge = readProjectFile("js/main/data-bridge.js");
  const preload = readProjectFile("preload.js");
  const repository = readProjectFile("js/sqlite-repository.js");
  const legacyImportName = ["import", "Legacy", "Local", "Storage"].join("");
  const legacySettingName = ["legacy", "Migration", "Completed"].join("");

  [appState, bridge, preload, repository].forEach((contents) => {
    assert.equal(contents.includes(legacyImportName), false);
    assert.equal(contents.includes(legacySettingName), false);
  });
}

function testRendererUsesDesktopPersistenceOnly() {
  const appState = readProjectFile("js/app-state.js");
  const i18n = readProjectFile("i18n.js");
  const indexHtml = readProjectFile("index.html");
  const browserStorageName = ["local", "Storage"].join("");

  [appState, i18n, indexHtml].forEach((contents) => {
    assert.equal(contents.includes(browserStorageName), false);
  });
}

function testImageUtilitiesLoadBeforeViews() {
  const indexHtml = readProjectFile("index.html");
  const imageUtilsIndex = indexHtml.indexOf('src="js/image-utils.js"');
  const homeViewIndex = indexHtml.indexOf('src="js/views/home-view.js"');
  const cardFormViewIndex = indexHtml.indexOf('src="js/views/card-form-view.js"');

  assert.ok(imageUtilsIndex > -1);
  assert.ok(imageUtilsIndex < homeViewIndex);
  assert.ok(imageUtilsIndex < cardFormViewIndex);
}

function testHomeSlideshowDoesNotClearImageSources() {
  const homeView = readProjectFile("js/views/home-view.js");

  assert.doesNotMatch(homeView, /removeAttribute\(["']src["']\)/);
}

function testHomeTilesUseKeyedEagerRendering() {
  const homeView = readProjectFile("js/views/home-view.js");

  assert.match(homeView, /tileRecords/);
  assert.match(homeView, /loading:\s*"eager"/);
  assert.match(homeView, /fetchpriority:\s*"high"/);
  assert.doesNotMatch(homeView, /clearElement\(grid\)/);
}

function testStudyViewUsesWindowedInvisibleMediaPreparation() {
  const studyView = readProjectFile("js/views/study-view.js");

  assert.match(studyView, /STUDY_PRELOAD_WINDOW\s*=\s*5/);
  assert.match(studyView, /showCurrentCardWhenReady/);
  assert.match(studyView, /loadCardMedia/);
  assert.doesNotMatch(studyView, /warmStudyImages/);
  assert.doesNotMatch(studyView, /getAllStudyImageUrls/);
  assert.doesNotMatch(studyView, /study-card-loading/);
}

function testPackageVersionMetadataAndScripts() {
  const pkg = JSON.parse(readProjectFile("package.json"));
  const lock = JSON.parse(readProjectFile("package-lock.json"));

  assert.equal(pkg.version, "1.5.1");
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.repository.type, "git");
  assert.ok(pkg.scripts.lint);
  assert.ok(pkg.scripts["test:e2e"]);
  assert.ok(pkg.scripts.audit);
  assert.ok(pkg.scripts["test:all"]);
  assert.equal(Object.hasOwn(pkg.scripts, ["dev", "server"].join("-")), false);
}

testRendererHasContentSecurityPolicy();
testMainProcessRegistersSecurityHardening();
testStartupRetryUsesFreshUrlNavigation();
testRendererBootstrapDoesNotUseSyncDesktopIpc();
testSettingsDoNotWriteLegacyAutoGermanArticleKey();
testRemovedDesktopOnlyArtifactsStayRemoved();
testLegacyMigrationBridgeIsRemoved();
testRendererUsesDesktopPersistenceOnly();
testImageUtilitiesLoadBeforeViews();
testHomeSlideshowDoesNotClearImageSources();
testHomeTilesUseKeyedEagerRendering();
testStudyViewUsesWindowedInvisibleMediaPreparation();
testPackageVersionMetadataAndScripts();

console.log("static quality tests passed");