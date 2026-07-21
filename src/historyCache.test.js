import { describe, expect, it } from "vitest";
import {
  HISTORY_CACHE_VERSION,
  createHistoryCacheKey,
  findHistoryCacheHit,
  normalizeProblemText,
  readHistoryItems
} from "./historyCache.js";

describe("history cache", () => {
  it("normalizes whitespace before creating a cache key", () => {
    expect(normalizeProblemText("  绘制\n三角形  ABC ")).toBe("绘制 三角形 ABC");
    expect(createHistoryCacheKey({ text: "绘制 三角形 ABC" })).toBe(
      createHistoryCacheKey({ text: "绘制\n三角形 ABC" })
    );
    expect(JSON.parse(createHistoryCacheKey({ text: "绘制 三角形 ABC" })).version).toBe(HISTORY_CACHE_VERSION);
  });

  it("matches a history item only when its image fingerprint also matches", () => {
    const matchingKey = createHistoryCacheKey({ text: "题目", imageFingerprint: "same-image" });
    const history = [{ id: "match", cacheKey: matchingKey }, {
      id: "different-image",
      cacheKey: createHistoryCacheKey({ text: "题目", imageFingerprint: "other-image" })
    }];

    expect(findHistoryCacheHit(history, matchingKey, { text: "题目", hasImage: true })?.id).toBe("match");
  });

  it("uses legacy text-only history without matching image-based entries", () => {
    const history = [{ id: "legacy", promptText: "  已知  三角形 ABC  " }, {
      id: "legacy-image",
      promptText: "已知 三角形 ABC",
      imageName: "problem.png"
    }];
    const cacheKey = createHistoryCacheKey({ text: "已知 三角形 ABC" });

    expect(findHistoryCacheHit(history, cacheKey, { text: "已知 三角形 ABC", hasImage: false })).toBeNull();
  });

  it("does not reuse stale versioned cache entries automatically", () => {
    const staleKey = JSON.stringify({ version: HISTORY_CACHE_VERSION - 1, text: "题目", imageFingerprint: "" });
    const cacheKey = createHistoryCacheKey({ text: "题目" });
    const history = [{ id: "stale", cacheKey: staleKey, promptText: "题目" }];

    expect(findHistoryCacheHit(history, cacheKey, { text: "题目", hasImage: false })).toBeNull();
  });

  it("reads current history first and falls back to legacy history for manual selection", () => {
    const storage = new Map([
      ["current", JSON.stringify([{ id: "new", promptText: "新题" }])],
      ["legacy", JSON.stringify([{ id: "old", promptText: "旧题" }, { id: "new", promptText: "重复题" }])]
    ]);
    const storageRef = { getItem: (key) => storage.get(key) ?? null };

    expect(readHistoryItems(storageRef, {
      primaryKey: "current",
      legacyKeys: ["legacy"],
      limit: 8
    }).map((item) => item.id)).toEqual(["new", "old"]);
  });
});
