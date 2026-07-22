import { describe, expect, it } from "vitest";
import { buildSystemPrompt, getPromptProfileSummary } from "./promptProfiles.js";

describe("prompt profiles", () => {
  it("selects solid geometry rules for spatial problems", () => {
    const profile = getPromptProfileSummary({
      text: "在直三棱柱 ABC-A1B1C1 中证明线面平行并求距离。"
    });
    const prompt = buildSystemPrompt({
      text: "在直三棱柱 ABC-A1B1C1 中证明线面平行并求距离。"
    });

    expect(profile).toEqual({ id: "solid_geometry", subType: "solid_spatial_relation" });
    expect(prompt).toContain("PROFILE: solid geometry 3D teaching diagram.");
    expect(prompt).toContain("gray dashed segments for hidden or auxiliary edges");
    expect(prompt).toContain("filling at most 0.04");
  });

  it("selects analytic geometry conic rules for parabola locus problems", () => {
    const profile = getPromptProfileSummary({
      text: "已知抛物线 y²=4x，过点 T 的直线交抛物线于 A、B，求中点 M 的轨迹和三角形面积。"
    });
    const prompt = buildSystemPrompt({
      text: "已知抛物线 y²=4x，过点 T 的直线交抛物线于 A、B，求中点 M 的轨迹和三角形面积。"
    });

    expect(profile).toEqual({ id: "analytic_geometry", subType: "conic_parabola" });
    expect(prompt).toContain("PROFILE: analytic geometry and conic teaching diagram.");
    expect(prompt).toContain("TriangleFAB=Polygon(F,A,B)");
    expect(prompt).toContain("target triangle/quadrilateral must be a named Polygon");
  });

  it("selects function rules for interval extrema problems", () => {
    const profile = getPromptProfileSummary({
      text: "二次函数在区间上的最大值和最小值随端点变化。"
    });
    const prompt = buildSystemPrompt({
      text: "二次函数在区间上的最大值和最小值随端点变化。"
    });

    expect(profile).toEqual({ id: "function", subType: "function_interval_extrema" });
    expect(prompt).toContain("PROFILE: function graph teaching diagram.");
    expect(prompt).toContain("endpoint points on the graph");
  });

  it("uses edited construction steps when regenerating commands", () => {
    const profile = getPromptProfileSummary({
      mathType: "geometry",
      constructionSteps: [
        "绘制椭圆及两个焦点。",
        "让动点 P 在椭圆上运动，观察三角形面积变化。"
      ]
    });

    expect(profile).toEqual({ id: "analytic_geometry", subType: "conic_ellipse" });
  });
});
