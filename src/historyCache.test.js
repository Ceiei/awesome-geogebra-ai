import { describe, expect, it } from "vitest";
import { createHistoryCacheKey, findHistoryCacheHit, normalizeProblemText } from "./historyCache.js";

describe("history cache", () => {
  it("normalizes whitespace before creating a cache key", () => {
    expect(normalizeProblemText("  绘制\n三角形  ABC ")).toBe("绘制 三角形 ABC");
    expect(createHistoryCacheKey({ text: "绘制 三角形 ABC" })).toBe(
      createHistoryCacheKey({ text: "绘制\n三角形 ABC" })
    );
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

    expect(findHistoryCacheHit(history, cacheKey, { text: "已知 三角形 ABC", hasImage: false })?.id).toBe("legacy");
  });
});
