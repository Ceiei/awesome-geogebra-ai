import { describe, expect, it } from "vitest";
import { buildCommandSystemPrompt, buildPlanSystemPrompt, buildSystemPrompt, getPromptProfileSummary } from "./promptProfiles.js";

describe("prompt profiles", () => {
  it("explicitly requests json for providers that validate json_object messages", () => {
    expect(buildPlanSystemPrompt({ text: "绘制函数 y=x^2" })).toMatch(/\bjson\b/);
    expect(buildCommandSystemPrompt({ constructionSteps: [{ text: "绘制函数 y=x^2" }] })).toMatch(/\bjson\b/);
  });

  it("keeps the planning prompt focused on steps instead of command syntax", () => {
    const prompt = buildPlanSystemPrompt({ text: "已知椭圆上有动点 P" });
    expect(prompt).not.toContain("Allowed GeoGebra command names");
    expect(prompt).not.toContain("SetLineThickness");
    expect(prompt.length).toBeLessThan(1200);
  });

  it("distinguishes horizontal and vertical solid sections", () => {
    const prompt = buildCommandSystemPrompt({ constructionSteps: [{ text: "用垂直平面截正方体" }] });
    expect(prompt).toContain("horizontal section uses z=h");
    expect(prompt).toContain("vertical section uses x=s or y=s");
    expect(prompt).toContain("Never represent a vertical section as z=h");
  });

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

  it("selects the solid geometry profile for the uploaded dihedral-angle problem", () => {
    const text = "在空间中，A、B为两个定点，动点C到直线AB的距离为2，动点D到直线AB的距离为1。若二面角C-AB-D为60°，判断各选项。";
    const profile = getPromptProfileSummary({ text });
    const prompt = buildSystemPrompt({ text });

    expect(profile).toEqual({ id: "solid_geometry", subType: "solid_spatial_relation" });
    expect(prompt).toContain("AB is the common edge");
    expect(prompt).toContain("Do not replace it with the ordinary point angle CAD");
    expect(prompt).toContain("parameterize its axial position and radial angle with native GeoGebra Slider objects");
    expect(prompt).toContain("use one shared radial-angle slider theta");
    expect(prompt).toContain("Do not rely on frontend-only control names");
    expect(prompt).toContain("Do not add an Angle object");
  });

  it("infers the profile from an image instead of defaulting to plane geometry", () => {
    const profile = getPromptProfileSummary({ hasImage: true });
    const prompt = buildSystemPrompt({ hasImage: true });

    expect(profile).toEqual({ id: "image", subType: "infer_from_image" });
    expect(prompt).toContain("PROFILE: infer the teaching profile from the uploaded problem image.");
    expect(prompt).toContain("a dihedral angle");
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

  it("uses a compact command-only prompt for step regeneration", () => {
    const context = {
      mathType: "analytic_geometry",
      constructionSteps: ["创建动点 P。", "填充三角形 ABP。"]
    };
    const commandPrompt = buildCommandSystemPrompt(context);

    expect(commandPrompt).toContain("Use only the supplied edited steps");
    expect(commandPrompt).toContain("complete replacement command list");
    expect(commandPrompt).not.toContain("Return schemaVersion=2");
    expect(commandPrompt.length).toBeLessThan(buildSystemPrompt(context).length);
  });
});
