import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readingCategoryIds } from "../../../shared/reading";
import { esquireOfflineFallback } from "./reading.fallback";

describe("Esquire first-launch fallback", () => {
  it("contains exactly five unique articles", () => {
    assert.equal(esquireOfflineFallback.length, 5);
    assert.equal(new Set(esquireOfflineFallback.map((item) => item.originalUrl)).size, 5);
  });

  it("covers every German reading category", () => {
    const categories = new Set(esquireOfflineFallback.map((item) => item.categoryId));
    assert.deepEqual([...categories].sort(), [...readingCategoryIds].sort());
  });
});

