"use strict";

module.exports = {
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  reporter: [["list"]],
  workers: 1,
  use: {
    trace: "retain-on-failure"
  }
};
