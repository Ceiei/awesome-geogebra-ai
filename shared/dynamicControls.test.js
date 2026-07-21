import { describe, expect, it } from "vitest";
import { extractSliderControls, mergeDynamicControls } from "./dynamicControls.js";

describe("dynamic control extraction", () => {
  it("infers a moving point control from Slider commands", () => {
    expect(extractSliderControls([
      "t=Slider(-3,3,0.1,1,180,false,true,false,false)",
      "P=(t,t^2/2)"
    ])).toEqual([
      { name: "t", description: "动点 P 的位置", min: -3, max: 3, step: 0.1 }
    ]);
  });

  it("keeps model-provided teacher-facing descriptions when merging", () => {
    expect(mergeDynamicControls({
      commands: ["t=Slider(-3,3,0.1)", "P=(t,t^2/2)"],
      dynamicControls: [
        { name: "t", description: "切点位置", min: -3, max: 3, step: 0.1 }
      ]
    })).toEqual([
      { name: "t", description: "切点位置", min: -3, max: 3, step: 0.1 }
    ]);
  });

  it("supports legacy Slider(label, min, max, step) commands from edited input", () => {
    expect(extractSliderControls([
      "Slider(t, -2, 2, 0.5, 1, false, true, false, false)",
      "P=(t,t^2)"
    ])).toEqual([
      { name: "t", description: "动点 P 的位置", min: -2, max: 2, step: 0.5 }
    ]);
  });

  it("infers tangent point controls from Tangent helper commands", () => {
    expect(extractSliderControls([
      "t=Slider(-2.5,2.5,0.1)",
      "P=(t,t^2)",
      "f(x)=x^2",
      "tangent=Tangent(P,f)"
    ])).toEqual([
      { name: "t", description: "切点 P 的位置", min: -2.5, max: 2.5, step: 0.1 }
    ]);
  });

  it("parses pi-based slider ranges for angle demonstrations", () => {
    expect(extractSliderControls([
      "theta=Slider(-π,2*pi,pi/6)",
      "P=(cos(theta),sin(theta))"
    ])).toEqual([
      { name: "theta", description: "角度", min: -Math.PI, max: 2 * Math.PI, step: Math.PI / 6 }
    ]);
  });

  it("infers slope and intercept controls from common parameter names", () => {
    expect(extractSliderControls([
      "k=Slider(-3,3,0.1)",
      "b=Slider(-2,2,0.1)",
      "line=Line((0,b),(1,k+b))"
    ])).toEqual([
      { name: "k", description: "直线斜率", min: -3, max: 3, step: 0.1 },
      { name: "b", description: "直线截距", min: -2, max: 2, step: 0.1 }
    ]);
  });
});
