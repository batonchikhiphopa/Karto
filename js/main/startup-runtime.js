"use strict";

function createStartupRuntime(options) {
  const {
    STARTUP_RENDERER_POLL_INTERVAL_MS,
    STARTUP_RENDERER_SCRIPT,
    evaluateVerificationResult,
    formatFailedAttemptLog,
    makePreview,
    recordStartupCheckpoint
  } = options;

  function waitWithinDeadline(promise, deadlineAt) {
    const remaining = Math.max(0, deadlineAt - Date.now());
    if (remaining === 0) {
      return Promise.resolve({
        ok: false,
        reason: "timeout",
        error: new Error("Startup deadline expired before operation could begin.")
      });
    }

    return Promise.race([
      promise.then(
        (value) => ({ ok: true, value }),
        (error) => ({ ok: false, reason: "error", error })
      ),
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: false,
            reason: "timeout",
            error: new Error("Startup operation timed out.")
          });
        }, remaining);
      })
    ]);
  }

  function wait(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  function getActiveWebContents(window) {
    if (!window || window.isDestroyed()) {
      return null;
    }

    const contents = window.webContents;
    if (!contents || contents.isDestroyed()) {
      return null;
    }

    return contents;
  }

  function stopPendingNavigation(window) {
    const contents = getActiveWebContents(window);
    if (!contents) {
      return;
    }

    try {
      if (contents.isLoading()) {
        contents.stop();
      }
    } catch {
      // A destroyed webContents can throw between the guard and stop().
    }
  }

  function createMainFrameAttemptWatcher(window, action, attemptLabel) {
    const contents = getActiveWebContents(window);
    if (!contents) {
      return Promise.resolve({
        ok: false,
        error: new Error("Window was closed before navigation could start.")
      });
    }

    return new Promise((resolve) => {
      let settled = false;
      const cleanup = () => {
        contents.removeListener("did-finish-load", handleFinishLoad);
        contents.removeListener("did-fail-load", handleFailLoad);
        contents.removeListener("render-process-gone", handleRenderProcessGone);
        contents.removeListener("destroyed", handleDestroyed);
      };
      const settle = (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };
      const handleFinishLoad = () => {
        settle({ ok: true });
      };
      const handleFailLoad = (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame) return;
        settle({
          ok: false,
          error: new Error(
            `${attemptLabel} failed to load ${validatedURL || "main frame"}: ` +
              `${errorDescription || "unknown error"} (${errorCode})`
          )
        });
      };
      const handleRenderProcessGone = (_event, details) => {
        settle({
          ok: false,
          error: new Error(`${attemptLabel} renderer process gone: ${JSON.stringify(details)}`)
        });
      };
      const handleDestroyed = () => {
        settle({
          ok: false,
          error: new Error(`${attemptLabel} window was destroyed during navigation.`)
        });
      };

      contents.once("did-finish-load", handleFinishLoad);
      contents.on("did-fail-load", handleFailLoad);
      contents.once("render-process-gone", handleRenderProcessGone);
      contents.once("destroyed", handleDestroyed);

      try {
        Promise.resolve(action()).catch((error) => {
          settle({ ok: false, error });
        });
      } catch (error) {
        settle({ ok: false, error });
      }
    });
  }

  async function runRendererVerificationPolling(window, deadlineAt) {
    let lastEvaluation = null;
    let lastError = null;

    while (Date.now() < deadlineAt) {
      const contents = getActiveWebContents(window);
      if (!contents) {
        return {
          ok: false,
          evaluation: lastEvaluation,
          error: new Error("Window closed before renderer verification completed.")
        };
      }

      try {
        const value = await contents.executeJavaScript(STARTUP_RENDERER_SCRIPT, true);
        const evaluation = evaluateVerificationResult(value);
        lastEvaluation = evaluation;

        if (evaluation.ok) {
          return { ok: true, evaluation };
        }
      } catch (error) {
        lastError = error;
      }

      await wait(STARTUP_RENDERER_POLL_INTERVAL_MS);
    }

    return {
      ok: false,
      evaluation: lastEvaluation,
      error: lastError || new Error("Renderer verification timed out.")
    };
  }

  async function runVerificationAttempt(window, attemptNumber, action, url) {
    const attemptLabel = `attempt ${attemptNumber}`;
    const deadlineAt = Date.now() + options.STARTUP_VERIFY_TIMEOUT_MS;
    recordStartupCheckpoint(`${attemptLabel}:start`);

    const navigationResult = await waitWithinDeadline(
      createMainFrameAttemptWatcher(window, action, attemptLabel),
      deadlineAt
    );

    if (!navigationResult.ok) {
      stopPendingNavigation(window);
      return {
        ok: false,
        attemptNumber,
        url,
        phase: "navigation",
        error: navigationResult.error
      };
    }

    recordStartupCheckpoint(`${attemptLabel}:navigation`);
    const rendererResult = await runRendererVerificationPolling(window, deadlineAt);
    recordStartupCheckpoint(`${attemptLabel}:renderer`);

    if (!rendererResult.ok) {
      return {
        ok: false,
        attemptNumber,
        url,
        phase: "renderer",
        error: rendererResult.error,
        evaluation: rendererResult.evaluation
      };
    }

    return {
      ok: true,
      attemptNumber,
      url,
      evaluation: rendererResult.evaluation
    };
  }

  function createStartupVerificationError(evaluations, url) {
    const details = evaluations
      .map((evaluation) => formatFailedAttemptLog({
        attempt: evaluation.attemptNumber,
        elapsedMs: 0,
        evaluation: evaluation.evaluation,
        url,
        error: evaluation.error
      }))
      .join("\n\n");
    const error = new Error(
      `Startup verification failed for ${url}.\n\n${details}`
    );
    error.evaluations = evaluations;
    return error;
  }

  return {
    createStartupVerificationError,
    getActiveWebContents,
    runVerificationAttempt,
    stopPendingNavigation
  };
}

module.exports = {
  createStartupRuntime
};
