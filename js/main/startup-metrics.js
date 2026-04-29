"use strict";

function createStartupMetricsTracker() {
  let startupMetrics = null;

  function beginStartupMetrics() {
    startupMetrics = {
      startedAt: Date.now(),
      checkpoints: []
    };
  }

  function recordStartupCheckpoint(name) {
    if (!startupMetrics) {
      return;
    }

    startupMetrics.checkpoints.push({
      name,
      elapsedMs: Date.now() - startupMetrics.startedAt
    });
  }

  function formatStartupCheckpointSummary() {
    if (!startupMetrics || startupMetrics.checkpoints.length === 0) {
      return "";
    }

    return startupMetrics.checkpoints
      .map((checkpoint) => `${checkpoint.name}=${checkpoint.elapsedMs}ms`)
      .join(", ");
  }

  function clearStartupMetrics() {
    startupMetrics = null;
  }

  return {
    beginStartupMetrics,
    clearStartupMetrics,
    formatStartupCheckpointSummary,
    recordStartupCheckpoint
  };
}

module.exports = {
  createStartupMetricsTracker
};
