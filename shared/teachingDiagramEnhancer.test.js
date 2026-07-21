import { describe, expect, it } from "vitest";
import { AREA_FILLING, enhanceTeachingDiagramCommands } from "./teachingDiagramEnhancer.js";

describe("teaching diagram command enhancement", () => {
  it("highlights polygon regions used for area calculations", () => {
    const commands = enhanceTeachingDiagramCommands({
      mathType: "analytic_geometry",
      commands: [
        "A=(-2,0)",
        "B=(2,0)",
        "P=(t,t^2/2)",
        "tri=Polygon(A,B,P)",
        "area=Area(tri)"
      ]
    });

    expect(commands).toEqual(expect.arrayContaining([
      `SetFilling(tri,${AREA_FILLING})`,
      "SetColor(tri,96,165,250)",
      "SetLineThickness(tri,3)",
      "SetLayer(tri,0)"
    ]));
  });

  it("overrides weak AI styling on target area polygons", () => {
    const commands = enhanceTeachingDiagramCommands({
      mathType: "analytic_geometry",
      commands: [
        "A=(-2,0)",
        "B=(2,0)",
        "P=(t,t^2/2)",
        "TriangleABP=Polygon(A,B,P)",
        "SetFilling(TriangleABP,0)",
        "SetColor(TriangleABP,200,200,200)",
        "AreaABP=Area(TriangleABP)"
      ]
    });

    expect(commands).not.toContain("SetFilling(TriangleABP,0)");
    expect(commands).not.toContain("SetColor(TriangleABP,200,200,200)");
    expect(commands).toEqual(expect.arrayContaining([
      `SetFilling(TriangleABP,${AREA_FILLING})`,
      "SetColor(TriangleABP,96,165,250)",
      "SetLineThickness(TriangleABP,3)",
      "SetLayer(TriangleABP,0)"
    ]));
  });

  it("highlights a polygon when area is computed from points", () => {
    const commands = enhanceTeachingDiagramCommands({
      mathType: "analytic_geometry",
      commands: [
        "A=(-2,0)",
        "B=(2,0)",
        "P=(t,t^2/2)",
        "TriangleABP=Polygon(A,B,P)",
        "AreaABP=Area(A,B,P)"
      ]
    });

    expect(commands).toContain(`SetFilling(TriangleABP,${AREA_FILLING})`);
  });

  it("styles area height and base helper segments for clearer teaching diagrams", () => {
    const commands = enhanceTeachingDiagramCommands({
      mathType: "analytic_geometry",
      commands: [
        "A=(-2,0)",
        "B=(2,0)",
        "P=(t,t^2/2)",
        "H=(t,0)",
        "tri=Polygon(A,B,P)",
        "h=Segment(P,H)",
        "base=Segment(A,B)",
        "SetColor(h,200,200,200)",
        "SetLineStyle(h,0)",
        "area=Area(tri)"
      ]
    });

    expect(commands).not.toContain("SetColor(h,200,200,200)");
    expect(commands).not.toContain("SetLineStyle(h,0)");
    expect(commands).toEqual(expect.arrayContaining([
      "SetColor(h,37,99,235)",
      "SetLineStyle(h,2)",
      "SetLineThickness(h,3)",
      "SetColor(base,31,41,55)",
      "SetLineThickness(base,4)"
    ]));
  });

  it("styles secant, tangent, and slope helper lines for dynamic slope demonstrations", () => {
    const commands = enhanceTeachingDiagramCommands({
      mathType: "analytic_geometry",
      commands: [
        "f(x)=x^2",
        "A=(0,0)",
        "P=(t,t^2)",
        "secant=Line(A,P)",
        "tangent=Line(P,Q)",
        "slopeLine=Segment(P,R)",
        "SetColor(secant,200,200,200)",
        "SetLineThickness(tangent,1)"
      ]
    });

    expect(commands).not.toContain("SetColor(secant,200,200,200)");
    expect(commands).not.toContain("SetLineThickness(tangent,1)");
    expect(commands).toEqual(expect.arrayContaining([
      "SetColor(secant,37,99,235)",
      "SetLineStyle(secant,2)",
      "SetLineThickness(secant,3)",
      "SetColor(tangent,220,38,38)",
      "SetLineStyle(tangent,0)",
      "SetLineThickness(tangent,4)",
      "SetColor(slopeLine,124,58,237)",
      "SetLineStyle(slopeLine,2)",
      "SetLineThickness(slopeLine,3)"
    ]));
  });

  it("styles locus and path helpers for dynamic trajectory demonstrations", () => {
    const commands = enhanceTeachingDiagramCommands({
      mathType: "analytic_geometry",
      commands: [
        "f(x)=x^2",
        "P=(t,t^2)",
        "Q=(0,0)",
        "path=Locus(P,Q)",
        "SetColor(path,200,200,200)",
        "SetLineThickness(path,1)"
      ]
    });

    expect(commands).not.toContain("SetColor(path,200,200,200)");
    expect(commands).not.toContain("SetLineThickness(path,1)");
    expect(commands).toEqual(expect.arrayContaining([
      "SetColor(path,13,148,136)",
      "SetLineThickness(path,4)"
    ]));
  });

  it("styles labeled equation lines in line-family demonstrations", () => {
    const commands = enhanceTeachingDiagramCommands({
      mathType: "analytic_geometry",
      commands: [
        "k=Slider(-3,3,0.1)",
        "b=Slider(-1,3,0.1)",
        "l: y=k*x+b",
        "SetColor(l,200,200,200)",
        "SetLineThickness(l,1)"
      ]
    });

    expect(commands).not.toContain("SetColor(l,200,200,200)");
    expect(commands).not.toContain("SetLineThickness(l,1)");
    expect(commands).toEqual(expect.arrayContaining([
      "SetColor(l,37,99,235)",
      "SetLineThickness(l,4)"
    ]));
  });

  it("leaves solid geometry styling to the solid enhancer", () => {
    expect(enhanceTeachingDiagramCommands({
      mathType: "solid_geometry",
      commands: ["tri=Polygon(A,B,C)", "area=Area(tri)"]
    })).toEqual(["tri=Polygon(A,B,C)", "area=Area(tri)"]);
  });
});
