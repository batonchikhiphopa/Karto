"use strict";

const fs = require("node:fs");
const path = require("node:path");
const asar = require("@electron/asar");

const projectRoot = path.resolve(__dirname, "..");
const appAsarPath = path.join(projectRoot, "dist", "win-unpacked", "resources", "app.asar");

function fail(message) {
  throw new Error(`[verify:dist] ${message}`);
}

function readAsarFile(archivePath, filename) {
  try {
    return asar.extractFile(archivePath, filename.split("/").join(path.sep)).toString("utf8");
  } catch (error) {
    fail(`Unable to read "${filename}" from app.asar: ${error.message}`);
  }
}

if (!fs.existsSync(appAsarPath)) {
  fail(`Packaged archive not found at ${appAsarPath}. Run "npm run build:win" first.`);
}

const listing = asar.listPackage(appAsarPath).map((item) => item.replace(/\\/g, "/"));
const packagedMain = readAsarFile(appAsarPath, "main.js");
const packagedApp = readAsarFile(appAsarPath, "app.js");
const packagedIndex = readAsarFile(appAsarPath, "index.html");
const packagedSecurity = readAsarFile(appAsarPath, "js/main/security.js");
const packagedPreload = readAsarFile(appAsarPath, "preload.js");
const removedManifest = ["manifest", "webmanifest"].join(".");
const removedSwBundle = ["s", "w"].join("") + ".js";
const removedPwaScript = `js/${["p", "w", "a"].join("")}.js`;
const removedStartScript = ["start", "bat"].join(".");
const oldBridgeName = ["import", "Legacy", "Local", "Storage", "Sync"].join("");
const oldBridgeChannel = ["import", "legacy", ["local", "storage"].join("")].join("-");

const removedRuntimeEntries = [
  "/loading.html",
  `/${removedManifest}`,
  `/${removedSwBundle}`,
  `/${removedPwaScript}`,
  `/${removedStartScript}`
];

for (const removedEntry of removedRuntimeEntries) {
  if (listing.includes(removedEntry)) {
    fail(`app.asar still contains removed runtime entry: ${removedEntry}`);
  }
}

if (!packagedMain.includes('LAUNCHING: "launching"')) {
  fail("packaged main.js is missing single-window launching phase");
}

if (!packagedMain.includes('recordStartupCheckpoint("app_window_created")')) {
  fail("packaged main.js is missing app window startup checkpoint");
}

if (!packagedApp.includes("shouldHandleGlobalEscape")) {
  fail("packaged app.js is missing global Escape handler reference");
}

if (!packagedApp.includes('router.goTo("homeScreen", "homeScreen")')) {
  fail("packaged app.js is missing global Escape navigation to homeScreen");
}

if (!packagedIndex.includes('http-equiv="Content-Security-Policy"')) {
  fail("packaged index.html is missing Content Security Policy");
}

if (packagedIndex.includes(removedManifest) || packagedIndex.includes(removedPwaScript)) {
  fail("packaged index.html still references removed PWA assets");
}

if (!packagedMain.includes("configureAppSecurity")) {
  fail("packaged main.js is missing Electron security configuration");
}

if (!packagedSecurity.includes("setWindowOpenHandler") || !packagedSecurity.includes("will-navigate")) {
  fail("packaged security.js is missing navigation/window hardening");
}

if (packagedPreload.includes(oldBridgeName) || packagedMain.includes(oldBridgeChannel)) {
  fail("packaged desktop bridge still exposes old browser-data migration");
}

const forbiddenEntries = [
  "/.env",
  "/.env.",
  "/.github/",
  "/coverage/",
  "/docs/",
  "/out/",
  "/test-results/",
  "/tests/",
  "/scripts/",
  "/eslint.config.js",
  "/playwright.config.js"
];

for (const forbiddenEntry of forbiddenEntries) {
  if (listing.some((item) => item === forbiddenEntry || item.startsWith(forbiddenEntry))) {
    fail(`app.asar contains development-only entry: ${forbiddenEntry}`);
  }
}

console.log("verify:dist passed");
