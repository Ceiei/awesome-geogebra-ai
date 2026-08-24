import { describe, expect, it } from "vitest";
import {
  buildSemanticConstruction,
  compileConstructionGraph,
  createMathematicalModel,
  diffMathematicalModels
} from "./constructionSemantics.js";

describe("generic construction semantics", () => {
  it("round-trips 2D, function, and 3D GeoGebra operations through one graph compiler", () => {
    const commands = [
      "a=2",
      "A=(0,0,0)",
      "f(x)=x^2-a",
      "plane1=Plane(A,(1,0,0),(0,1,0))",
      "ShowLabel(A,true)"
    ];
    const { constructionGraph } = buildSemanticConstruction({
      constructionSteps: ["定义参数、点、函数和平面。"],
      commands,
      mathType: "solid_geometry"
    });

    expect(compileConstructionGraph(constructionGraph)).toEqual({ commands, errors: [], ok: true });
  });

  it("detects a plane orientation edit without relying on a cube-specific template", () => {
    const horizontal = createMathematicalModel({
      constructionSteps: ["构造水平截面 z=h，并观察截面变化。"],
      mathType: "solid_geometry"
    });
    const arbitrary = createMathematicalModel({
      constructionSteps: ["构造任意截平面，用方位角和倾角改变方向。"],
      mathType: "solid_geometry"
    });

    const diff = diffMathematicalModels(horizontal, arbitrary);
    expect(diff.changed).toBe(true);
    expect(diff.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "orientation", before: ["horizontal"], after: ["arbitrary"] })
    ]));
  });

  it("detects relation, equation, target, and dimension changes across unrelated domains", () => {
    const cases = [
      ["作直线 l 平行于 AB。", "作直线 l 垂直于 AB。", "relation"],
      ["绘制函数 y=x^2。", "绘制函数 y=2*x^2。", "expression"],
      ["求三角形 ABC 的面积。", "求三角形 ABC 的周长。", "target"],
      ["在平面内作点 A。", "在空间中作点 A。", "dimension"]
    ];

    for (const [before, after, expectedCategory] of cases) {
      const diff = diffMathematicalModels(
        createMathematicalModel({ sourceText: before }),
        createMathematicalModel({ sourceText: after })
      );
      expect(diff.changed, `${before} -> ${after}`).toBe(true);
      expect(diff.changes.some((change) => change.category === expectedCategory), `${before} -> ${after}`).toBe(true);
    }
  });

  it("rejects duplicate typed outputs before commands reach GeoGebra", () => {
    const { constructionGraph } = buildSemanticConstruction({
      commands: ["A=(0,0)", "A=(1,1)"],
      constructionSteps: ["构造点 A。"]
    });
    const compiled = compileConstructionGraph(constructionGraph);
    expect(compiled.ok).toBe(false);
    expect(compiled.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "duplicate_output" })
    ]));
  });
});

