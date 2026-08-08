import { describe, expect, it } from "vitest";
import { normalizeSolveResult } from "./solveSchema.js";

describe("solve result normalization", () => {
  it("keeps valid dynamic controls for slider-based demonstrations", () => {
    const result = normalizeSolveResult({
      problemSummary: "动点面积演示",
      mathType: "analytic_geometry",
      constructionSteps: ["创建滑动条 t。", "定义动点 P。"],
      ggbCommands: [
        "t=Slider(-3,3,0.1,1,180,false,true,false,false)",
        "P=(t,t^2)"
      ],
      dynamicControls: [
        { name: "t", description: "控制动点横坐标", min: -3, max: 3, step: 0.1 }
      ],
      viewport: { xmin: -4, xmax: 4, ymin: -1, ymax: 8 },
      warnings: [],
      followupQuestion: null
    });

    expect(result.dynamicControls).toEqual([
      { name: "t", description: "控制动点横坐标", min: -3, max: 3, step: 0.1 }
    ]);
    expect(result.ggbCommands).toContain("t=Slider(-3,3,0.1,1,180,false,true,false,false)");
  });

  it("derives dynamic controls from slider commands when the model omits them", () => {
    const result = normalizeSolveResult({
      problemSummary: "动点面积演示",
      mathType: "analytic_geometry",
      constructionSteps: ["创建滑动条 t。", "定义动点 P。"],
      ggbCommands: [
        "t=Slider(-3,3,0.1,1,180,false,true,false,false)",
        "P=(t,t^2/2)"
      ],
      dynamicControls: [],
      viewport: { xmin: -4, xmax: 4, ymin: -1, ymax: 8 },
      warnings: [],
      followupQuestion: null
    });

    expect(result.dynamicControls).toEqual([
      { name: "t", description: "动点 P 的位置", min: -3, max: 3, step: 0.1 }
    ]);
  });

  it("normalizes style commands that target anonymous construction expressions", () => {
    const result = normalizeSolveResult({
      problemSummary: "垂线样式",
      mathType: "analytic_geometry",
      constructionSteps: ["作 PH 垂线。"],
      ggbCommands: [
        "P=(0,1)",
        "H=(0,0)",
        "h=Segment(P,H)",
        "SetLineThickness(Segment(P, H), 2)"
      ],
      dynamicControls: [],
      viewport: { xmin: -4, xmax: 4, ymin: -1, ymax: 4 },
      warnings: [],
      followupQuestion: null
    });

    expect(result.rejectedCommands).toEqual([]);
    expect(result.ggbCommands).toEqual(expect.arrayContaining([
      "h=Segment(P,H)",
      "SetLineThickness(h,3)"
    ]));
    expect(result.ggbCommands).not.toContain("SetLineThickness(Segment(P, H), 2)");
  });

  it("accepts an object-shaped manifest returned by a non-strict provider", () => {
    const result = normalizeSolveResult({
      recognizedProblemText: "在空间中构造公共棱 AB。",
      problemSummary: "二面角示意图",
      mathType: "solid_geometry",
      constructionSteps: "构造点 A、B 并连接公共棱。",
      objectManifest: {
        A: { teacherName: "点 A", objectType: "Point", dependencies: "B" },
        commonEdge: { teacherName: "公共棱 AB", objectType: "Segment" }
      },
      ggbCommands: [
        "A=(0,0,0)",
        "B=(4,0,0)",
        "commonEdge=Segment(A,B)"
      ],
      warnings: "",
      followupQuestion: null
    });

    expect(result.constructionSteps).toHaveLength(1);
    expect(result.objectManifest).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "A", teacherName: "点 A", dependencies: ["B"] }),
      expect.objectContaining({ label: "commonEdge", teacherName: "公共棱 AB" })
    ]));
  });

  it("accepts a manifest nested under an objects field", () => {
    const result = normalizeSolveResult({
      problemSummary: "构造线段",
      mathType: "geometry",
      constructionSteps: ["连接 A、B。"],
      objectManifest: {
        objects: [{ label: "edge", teacherName: "线段 AB" }]
      },
      ggbCommands: ["A=(0,0)", "B=(2,0)", "edge=Segment(A,B)"],
      warnings: "模型给出简化图",
      followupQuestion: null
    });

    expect(result.objectManifest).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "edge", teacherName: "线段 AB" })
    ]));
    expect(result.warnings).toEqual(["模型给出简化图"]);
  });

  it("normalizes multiline commands returned as text by a compatible provider", () => {
    const result = normalizeSolveResult({
      problemSummary: "构造三角形",
      mathType: "geometry",
      constructionSteps: "依次构造 A、B、C 并连接。",
      ggbCommands: "```ggb\nA=(0,0)\nB=(2,0)\nC=(1,2)\ntri=Polygon(A,B,C)\n```",
      objectManifest: {},
      warnings: null
    });

    expect(result.rejectedCommands).toEqual([]);
    expect(result.ggbCommands).toEqual(expect.arrayContaining([
      "A=(0,0)",
      "B=(2,0)",
      "C=(1,2)",
      "tri=Polygon(A,B,C)"
    ]));
  });

  it("unwraps a solve result nested in a provider data envelope", () => {
    const result = normalizeSolveResult({
      data: {
        problemSummary: "构造线段 AB",
        mathType: "geometry",
        constructionSteps: ["构造 A、B 并连接。"],
        ggbCommands: { commands: ["A=(0,0)", "B=(2,0)", "edge=Segment(A,B)"] }
      }
    });

    expect(result.problemSummary).toBe("构造线段 AB");
    expect(result.ggbCommands).toEqual(expect.arrayContaining([
      "A=(0,0)",
      "B=(2,0)",
      "edge=Segment(A,B)"
    ]));
  });

  it("classifies visible geometric planes as helpers rather than hidden calculations", () => {
    const result = normalizeSolveResult({
      problemSummary: "显示二面角的两个半平面",
      mathType: "solid_geometry",
      constructionSteps: ["构造平面 alpha。"],
      ggbCommands: [
        "A=(0,0,0)", "B=(2,0,0)", "C=(0,1,0)",
        "alpha=Plane(A,B,C)"
      ]
    });

    expect(result.objectManifest).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "alpha", role: "helper", objectType: "Plane" })
    ]));
  });
});
