import { describe, expect, it } from "vitest";
import { applyTeachingTheme } from "./teachingTheme.js";

describe("teaching theme", () => {
  it("renders visible 3D planes with very low opacity regardless of their label", () => {
    const commands = applyTeachingTheme([
      "p=Plane(A,B,C)",
      "SetFilling(p,0.4)"
    ], [{
      label: "p",
      objectType: "Plane",
      role: "original",
      visible: true
    }], { mathType: "solid_geometry" });

    expect(commands).toContain("SetFilling(p,0.045)");
    expect(commands).toContain("SetColor(p,148,163,184)");
    expect(commands).not.toContain("SetVisible(p,false)");
    expect(commands).toContain("ShowLabel(p,false)");
  });

  it("hides 3D measurement labels while keeping the angle object visible", () => {
    const commands = applyTeachingTheme([
      "angleValue=Angle(edge,p)"
    ], [{
      label: "angleValue",
      objectType: "Angle",
      role: "measurement",
      visible: true
    }], { mathType: "solid_geometry" });

    expect(commands).toContain("ShowLabel(angleValue,false)");
    expect(commands).not.toContain("SetVisible(angleValue,false)");
  });

  it("preserves an explicit hidden state for calculation planes", () => {
    const commands = applyTeachingTheme([
      "calcPlane=Plane(A,B,C)",
      "SetVisible(calcPlane,false)"
    ], [{
      label: "calcPlane",
      objectType: "Plane",
      role: "helper",
      visible: true
    }], { mathType: "solid_geometry" });

    expect(commands).toContain("SetVisible(calcPlane,false)");
  });

  it("keeps a solid-geometry target region visible enough for teaching", () => {
    const commands = applyTeachingTheme([
      "regionABC=Polygon(A,B,C)"
    ], [{
      label: "regionABC",
      objectType: "Polygon",
      role: "region",
      visible: true
    }], { mathType: "solid_geometry" });

    expect(commands).toContain("SetFilling(regionABC,0.14)");
  });
});
