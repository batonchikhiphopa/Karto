"use strict";

const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

let loadedEnvPath = null;

function collectEnvCandidatePaths(options = {}) {
  const candidates = [
    options.envPath,
    process.env.KARTO_ENV_PATH,
    process.env.PORTABLE_EXECUTABLE_DIR
      ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, ".env")
      : null,
    process.execPath
      ? path.join(path.dirname(process.execPath), ".env")
      : null,
    typeof process.cwd === "function"
      ? path.join(process.cwd(), ".env")
      : null,
    path.join(__dirname, ".env")
  ];

  const uniquePaths = new Set();
  const resolvedPaths = [];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "string") {
      continue;
    }

    const resolvedPath = path.resolve(candidate);
    if (uniquePaths.has(resolvedPath)) {
      continue;
    }

    uniquePaths.add(resolvedPath);
    resolvedPaths.push(resolvedPath);
  }

  return resolvedPaths;
}

function loadEnvironment(options = {}) {
  for (const envPath of collectEnvCandidatePaths(options)) {
    if (!fs.existsSync(envPath)) {
      continue;
    }

    if (loadedEnvPath === envPath) {
      return envPath;
    }

    dotenv.config({
      path: envPath,
      override: false
    });

    loadedEnvPath = envPath;
    return envPath;
  }

  return null;
}

module.exports = {
  collectEnvCandidatePaths,
  loadEnvironment
};
