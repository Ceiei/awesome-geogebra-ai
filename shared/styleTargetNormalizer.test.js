import { describe, expect, it } from "vitest";
import { normalizeStyleCommandTargets } from "./styleTargetNormalizer.js";

describe("GeoGebra style target normalization", () => {
  it("rewrites styles on anonymous segments to an existing matching label", () => {
    expect(normalizeStyleCommandTargets([
      "P=(0,1)",
      "H=(0,0)",
      "h=Segment(P,H)",
      "SetLineThickness(Segment(P, H), 2)",
      "SetColor(Segment(P,H),37,99,235)"
    ])).toEqual([
      "P=(0,1)",
      "H=(0,0)",
      "h=Segment(P,H)",
      "SetLineThickness(h,2)",
      "SetColor(h,37,99,235)"
    ]);
  });

  it("creates a named object before styling an anonymous construction target", () => {
    expect(normalizeStyleCommandTargets([
      "A=(0,0)",
      "B=(1,0)",
      "C=(0,1)",
      "SetFilling(Polygon(A,B,C),0.35)"
    ])).toEqual([
      "A=(0,0)",
      "B=(1,0)",
      "C=(0,1)",
      "stylePolygon1=Polygon(A,B,C)",
      "SetFilling(stylePolygon1,0.35)"
    ]);
  });

  it("normalizes square-bracket style syntax before repairing anonymous targets", () => {
    expect(normalizeStyleCommandTargets([
      "P=(0,1)",
      "H=(0,0)",
      "SetLineThickness[Segment(P,H),2]"
    ])).toEqual([
      "P=(0,1)",
      "H=(0,0)",
      "styleSegment1=Segment(P,H)",
      "SetLineThickness(styleSegment1,2)"
    ]);
  });

  it("avoids generated labels that already exist later in the command list", () => {
    expect(normalizeStyleCommandTargets([
      "P=(0,1)",
      "H=(0,0)",
      "SetLineThickness(Segment(P,H),2)",
      "styleSegment1=Segment(A,B)"
    ])).toEqual([
      "P=(0,1)",
      "H=(0,0)",
      "styleSegment2=Segment(P,H)",
      "SetLineThickness(styleSegment2,2)",
      "styleSegment1=Segment(A,B)"
    ]);
  });
});
