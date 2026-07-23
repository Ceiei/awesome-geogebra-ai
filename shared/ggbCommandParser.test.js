import { describe, expect, it } from "vitest";
import { analyzeGgbCommands, labelAnonymousConstructions, normalizeAnonymousStyleTargets, parseGgbCommand } from "./ggbCommandParser.js";

describe("GeoGebra command parser", () => {
  it("parses 3D points and construction dependencies", () => {
    expect(parseGgbCommand("A=(a,0,2)")).toMatchObject({
      kind: "point",
      label: "A",
      dependencies: ["a"]
    });
    expect(parseGgbCommand("plane1=Plane(A,B,C)")).toMatchObject({
      kind: "construction",
      label: "plane1",
      commandName: "Plane",
      dependencies: ["A", "B", "C"]
    });
  });

  it("splits anonymous style targets into named objects", () => {
    expect(normalizeAnonymousStyleTargets([
      "P=(0,2)",
      "H=(0,0)",
      "SetLineThickness(Segment(P,H),2)"
    ])).toEqual([
      "P=(0,2)",
      "H=(0,0)",
      "segment1=Segment(P,H)",
      "SetLineThickness(segment1,2)"
    ]);
  });

  it("detects references before definition", () => {
    const report = analyzeGgbCommands(["AB=Segment(A,B)", "A=(0,0)", "B=(1,0)"]);
    expect(report.ok).toBe(false);
    expect(report.unresolved.map((item) => item.label)).toEqual(expect.arrayContaining(["A", "B"]));
  });

  it("assigns stable labels to standalone construction commands", () => {
    expect(labelAnonymousConstructions([
      "A=(0,0)",
      "B=(1,0)",
      "Segment(A,B)",
      "Polygon(A,B,(0,1))"
    ])).toEqual([
      "A=(0,0)",
      "B=(1,0)",
      "segment1=Segment(A,B)",
      "region1=Polygon(A,B,(0,1))"
    ]);
  });
});
