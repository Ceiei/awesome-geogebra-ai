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
      "SetFilling(faceplane1,0.06)", "SetFilling(faceplane2,0.06)", "SetLineThickness(DE,5)"
    ]));
  });

  it("does not alter non-solid constructions", () => {
    expect(enhanceSolidGeometryCommands({ mathType: "geometry", commands: ["A=(0,0)"] })).toEqual(["A=(0,0)"]);
  });
});
