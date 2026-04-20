"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const electronPath = require("electron");

const nodeTests = [
  "tests/card-text-limits.test.js",
  "tests/data-model.test.js",
  "tests/image-utils.test.js",
  "tests/study-engine.test.js",
  "tests/app-state.test.js",
  "tests/i18n.test.js",
  "tests/global-shortcuts.test.js",
  "tests/api.test.js",
  "tests/export-import.test.js",
  "tests/static-quality.test.js",
  "tests/startup-verification.test.js",
  "tests/server.test.js"
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      ...options.env
    },
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  if (result.signal) {
    throw new Error(`Test process terminated with signal ${result.signal}`);
  }
}

nodeTests.forEach((testPath) => {
  run(process.execPath, [testPath]);
});

run(electronPath, ["tests/sqlite-repository.test.js"], {
  env: {
    ELECTRON_RUN_AS_NODE: "1"
  }
});
