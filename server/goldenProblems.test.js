import { describe, expect, it } from "vitest";
import { goldenProblems, summarizeGoldenProblems } from "./goldenProblems.js";

describe("100-problem regression benchmark", () => {
  it("keeps the required category distribution", () => {
    expect(summarizeGoldenProblems()).toMatchObject({
      total: 100,
      byType: {
        geometry: 25,
        function: 25,
        analytic_geometry: 35,
        solid_geometry: 15
      }
    });
  });

  it("contains image, dynamic, region, and relation expectations", () => {
    const summary = summarizeGoldenProblems();
    expect(summary.imageCount).toBeGreaterThanOrEqual(20);
    expect(summary.dynamicCount).toBeGreaterThanOrEqual(25);
    expect(summary.regionFillCount).toBeGreaterThanOrEqual(15);
    expect(goldenProblems.every((problem) => (
      problem.text
      && problem.requiredLabels.length
      && problem.requiredRelations.length
      && problem.forbiddenObjectTypes.length
    ))).toBe(true);
  });

  it("uses unique stable fixture ids", () => {
    expect(new Set(goldenProblems.map((problem) => problem.id)).size).toBe(100);
  });
});
