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
});
