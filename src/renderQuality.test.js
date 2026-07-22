import { describe, expect, it } from "vitest";
import { assessRenderQuality } from "./renderQuality.js";

function createApi({ defined = [], values = {}, points = {} } = {}) {
  const definedSet = new Set(defined);
  return {
    isDefined: (label) => definedSet.has(label),
    getValue: (label) => values[label],
    getXcoord: (label) => points[label]?.x,
    getYcoord: (label) => points[label]?.y
  };
}

describe("render quality assessment", () => {
  it("passes a complete non-degenerate construction", () => {
    const report = assessRenderQuality({
      api: createApi({
        defined: ["A", "B", "tri", "area"],
        values: { area: 2 },
        points: { A: { x: 0, y: 0 }, B: { x: 1, y: 1 } }
      }),
      commands: ["A=(0,0)", "B=(1,1)", "tri=Polygon(A,B,(0,2))", "area=Area(tri)"],
      commandResults: [
        { command: "A=(0,0)", ok: true },
        { command: "B=(1,1)", ok: true },
        { command: "tri=Polygon(A,B,(0,2))", ok: true },
        { command: "area=Area(tri)", ok: true }
      ],
      dynamicControls: [],
      objectNames: ["A", "B", "tri", "area"]
    });

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it("reports missing named objects", () => {
    const report = assessRenderQuality({
      api: createApi({ defined: ["A"] }),
      commands: ["A=(0,0)", "B=(1,1)", "AB=Segment(A,B)"],
      commandResults: [
        { command: "A=(0,0)", ok: true },
        { command: "B=(1,1)", ok: false },
        { command: "AB=Segment(A,B)", ok: false }
      ],
      dynamicControls: [],
      objectNames: ["A"]
    });

    expect(report.ok).toBe(false);
    expect(report.issues.join(" ")).toContain("缺少关键对象");
  });

  it("reports degenerate measurements", () => {
    const report = assessRenderQuality({
      api: createApi({ defined: ["tri", "area"], values: { area: 0 } }),
      commands: ["tri=Polygon(A,B,C)", "area=Area(tri)"],
      commandResults: [
        { command: "tri=Polygon(A,B,C)", ok: true },
        { command: "area=Area(tri)", ok: true }
      ],
      dynamicControls: [],
      objectNames: ["tri", "area"]
    });

    expect(report.ok).toBe(false);
    expect(report.issues.join(" ")).toContain("关键度量可能退化");
  });

  it("reports coincident intersection points", () => {
    const report = assessRenderQuality({
      api: createApi({
        defined: ["A", "B"],
        points: { A: { x: 1, y: 1 }, B: { x: 1, y: 1 } }
      }),
      commands: ["A=Intersect(C,l,1)", "B=Intersect(C,l,2)"],
      commandResults: [
        { command: "A=Intersect(C,l,1)", ok: true },
        { command: "B=Intersect(C,l,2)", ok: true }
      ],
      dynamicControls: [],
      objectNames: ["A", "B"]
    });

    expect(report.ok).toBe(false);
    expect(report.issues.join(" ")).toContain("交点疑似重合");
  });
});
