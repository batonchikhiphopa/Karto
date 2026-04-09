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
    return asar.extractFile(archivePath, filename).toString("utf8");
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

if (listing.includes("/loading.html")) {
  fail("app.asar still contains removed loading.html");
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

console.log("verify:dist passed");
