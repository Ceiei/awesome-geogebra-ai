import { describe, expect, it } from "vitest";
import { enhanceSolidGeometryCommands } from "./solidGeometryEnhancer.js";

describe("solid geometry command enhancement", () => {
  const prismCommands = [
    "C=(0,0,0)", "A=(2,0,0)", "B=(0,2,0)",
    "C1=(0,0,2)", "A1=(2,0,2)", "B1=(0,2,2)",
    "D=Midpoint(A,B)", "E=Midpoint(A,C1)", "DE=Segment(D,E)",
    "plane1=Plane(C,B,C1)", "plane2=Plane(A,C,C1)"
  ];

  it("adds the missing triangular prism edges and subdued plane styling", () => {
    const commands = enhanceSolidGeometryCommands({ mathType: "solid_geometry", commands: prismCommands });

    expect(commands).toEqual(expect.arrayContaining([
      "edgeAB=Segment(A,B)", "edgeBC=Segment(B,C)", "edgeCA=Segment(C,A)",
      "edgeA1B1=Segment(A1,B1)", "edgeB1C1=Segment(B1,C1)", "edgeC1A1=Segment(C1,A1)",
      "edgeAA1=Segment(A,A1)", "edgeBB1=Segment(B,B1)", "edgeCC1=Segment(C,C1)",
      "SetVisible(plane1,false)", "SetVisible(plane2,false)",
      "faceplane1=Polygon(C,B,C1,B1)", "faceplane2=Polygon(A,C,C1,A1)",
      "SetFilling(faceplane1,0.04)", "SetFilling(faceplane2,0.04)",
      "ShowLabel(A,true)", "ShowLabel(B,true)", "ShowLabel(C,true)",
      "SetLineThickness(DE,5)"
    ]));
  });

  it("does not alter non-solid constructions", () => {
    expect(enhanceSolidGeometryCommands({ mathType: "geometry", commands: ["A=(0,0)"] })).toEqual(["A=(0,0)"]);
  });

  it("removes redundant text labels that duplicate point names", () => {
    const commands = enhanceSolidGeometryCommands({
      mathType: "solid_geometry",
      commands: [
        "A=(0,0,0)",
        "B1=(1,1,1)",
        "Text(\"A\", A, true)",
        "Text(\"B₁\", B1, true)",
        "Text(\"距离 = 2\", (2,2,2))"
      ]
    });

    expect(commands).not.toContain("Text(\"A\", A, true)");
    expect(commands).not.toContain("Text(\"B₁\", B1, true)");
    expect(commands).toContain("Text(\"距离 = 2\", (2,2,2))");
  });

  it("clamps solid face filling and removes duplicate unlabeled polygons", () => {
    const commands = enhanceSolidGeometryCommands({
      mathType: "solid_geometry",
      commands: [
        "A=(0,0,0)", "B=(1,0,0)", "C=(0,1,0)", "C1=(0,1,1)",
        "Polygon(B,C,C1)",
        "face1=Polygon(C1,C,B)",
        "SetFilling(face1,0.25)"
      ]
    });

    expect(commands).not.toContain("Polygon(B,C,C1)");
    expect(commands).toContain("face1=Polygon(C1,C,B)");
    expect(commands).toContain("SetFilling(face1,0.04)");
  });

  it("adds standard cube and square pyramid edge templates", () => {
    const cubeCommands = enhanceSolidGeometryCommands({
      mathType: "solid_geometry",
      commands: ["A=(0,0,0)", "B=(1,0,0)", "C=(1,1,0)", "D=(0,1,0)", "E=(0,0,1)", "F=(1,0,1)", "G=(1,1,1)", "H=(0,1,1)"]
    });
    expect(cubeCommands).toEqual(expect.arrayContaining(["edgeAB=Segment(A,B)", "edgeFG=Segment(F,G)", "edgeDH=Segment(D,H)"]));

    const pyramidCommands = enhanceSolidGeometryCommands({
      mathType: "solid_geometry",
      commands: ["A=(0,0,0)", "B=(1,0,0)", "C=(1,1,0)", "D=(0,1,0)", "S=(0.5,0.5,1)"]
    });
    expect(pyramidCommands).toEqual(expect.arrayContaining(["edgeAB=Segment(A,B)", "edgeSA=Segment(S,A)", "edgeSD=Segment(S,D)"]));
  });
});
