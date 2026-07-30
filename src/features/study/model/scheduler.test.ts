import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultProgress, isDue, scheduleAnswer } from "./scheduler";

describe("study scheduler", () => {
  const now = new Date("2026-07-29T12:00:00.000Z");

  it("shows unseen cards immediately", () => {
    assert.equal(isDue(defaultProgress("card-1", "deck-1"), now), true);
  });

  it("schedules a correct first answer for tomorrow", () => {
    const next = scheduleAnswer(defaultProgress("card-1", "deck-1"), "correct", now);
    assert.equal(next.seenCount, 1);
    assert.equal(next.correctCount, 1);
    assert.equal(next.intervalDays, 1);
    assert.equal(next.dueAt, "2026-07-30T12:00:00.000Z");
  });

  it("resets a forgotten card to one day and records a lapse", () => {
    const current = {
      ...defaultProgress("card-1", "deck-1"),
      seenCount: 4,
      correctCount: 3,
      intervalDays: 12,
      dueAt: "2026-07-28T12:00:00.000Z"
    };
    const next = scheduleAnswer(current, "wrong", now);
    assert.equal(next.intervalDays, 1);
    assert.equal(next.lapseCount, 1);
    assert.equal(next.easeFactor, 2.25);
  });
});

