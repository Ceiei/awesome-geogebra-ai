import { describe, expect, it } from "vitest";
import {
  applySpatialPointControl,
  getSpatialPointControlValues,
  projectPointToLineDistance
} from "./geometryInteraction.js";

describe("geometry interaction constraints", () => {
  it("projects a dragged 3D point onto the requested cylindrical locus", () => {
    const projected = projectPointToLineDistance({
      point: [2, 3, 4],
      lineStart: [0, 0, 0],
      lineEnd: [5, 0, 0],
      distance: 2
    });

    expect(projected[0]).toBeCloseTo(2);
    expect(Math.hypot(projected[1], projected[2])).toBeCloseTo(2);
  });

  it("uses a stable perpendicular direction when dragged onto the axis", () => {
    const projected = projectPointToLineDistance({
      point: [3, 0, 0],
      lineStart: [0, 0, 0],
      lineEnd: [5, 0, 0],
      distance: 1
    });

    expect(projected[0]).toBeCloseTo(3);
    expect(Math.hypot(projected[1], projected[2])).toBeCloseTo(1);
  });

  it("moves a constrained point axially and rotates it around the line", () => {
    const lineStart = [0, 0, 0];
    const lineEnd = [5, 0, 0];
    const axial = applySpatialPointControl({
      point: [2, 2, 0], lineStart, lineEnd, distance: 2, kind: "axial", value: 3
    });
    const rotated = applySpatialPointControl({
      point: axial, lineStart, lineEnd, distance: 2, kind: "rotation", value: 90
    });

    expect(axial).toEqual([3, 2, 0]);
    expect(rotated[0]).toBeCloseTo(3);
    expect(rotated[1]).toBeCloseTo(0);
    expect(rotated[2]).toBeCloseTo(2);
    expect(getSpatialPointControlValues({ point: rotated, lineStart, lineEnd })).toEqual({
      axial: 3,
      rotation: 90
    });
  });
});
