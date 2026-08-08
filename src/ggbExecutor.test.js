import { describe, expect, it, vi } from "vitest";
import {
  apply3DCanvasPresentation,
  executeGgbCommand,
  getAngleDependencyLabels,
  get3DAutoZoomFactor,
  get3DCoordinateSystem,
  getExplicitlyHiddenObjectLabels,
  isInfinite3DPlane
} from "./ggbExecutor.js";

describe("GeoGebra command executor", () => {
  it("normalizes command brackets before evaluation", () => {
    const api = { evalCommand: vi.fn(() => true) };

    expect(executeGgbCommand(api, "Angle[vDE,n1]")).toEqual({ command: "Angle(vDE,n1)", ok: true });
    expect(api.evalCommand).toHaveBeenCalledWith("Angle(vDE,n1)");
  });

  it("uses the Apps API for label styling after the object exists", () => {
    const api = {
      isDefined: vi.fn(() => true),
      setLabelStyle: vi.fn(),
      setLabelVisible: vi.fn(),
      evalCommand: vi.fn()
    };

    expect(executeGgbCommand(api, "SetLabelMode[D,1]")).toEqual({ command: "SetLabelMode(D,1)", ok: true });
    expect(api.setLabelStyle).toHaveBeenCalledWith("D", 1);
    expect(api.setLabelVisible).toHaveBeenCalledWith("D", true);
    expect(api.evalCommand).not.toHaveBeenCalled();
  });

  it("uses the Apps API to hide a calculation-only plane", () => {
    const api = { isDefined: vi.fn(() => true), setVisible: vi.fn(), evalCommand: vi.fn() };

    expect(executeGgbCommand(api, "SetVisible(plane1,false)")).toEqual({ command: "SetVisible(plane1,false)", ok: true });
    expect(api.setVisible).toHaveBeenCalledWith("plane1", false);
    expect(api.evalCommand).not.toHaveBeenCalled();
  });

  it("handles GeoGebra named and hexadecimal colors through the Apps API", () => {
    const api = { isDefined: vi.fn(() => true), setColor: vi.fn(), evalCommand: vi.fn() };

    expect(executeGgbCommand(api, 'SetColor(A, "Red")')).toEqual({ command: 'SetColor(A, "Red")', ok: true });
    expect(executeGgbCommand(api, 'SetColor(B, "#80FF0000")')).toEqual({ command: 'SetColor(B, "#80FF0000")', ok: true });
    expect(api.setColor).toHaveBeenNthCalledWith(1, "A", 255, 0, 0);
    expect(api.setColor).toHaveBeenNthCalledWith(2, "B", 255, 0, 0);
    expect(api.evalCommand).not.toHaveBeenCalled();
  });

  it("handles captions, layers, and fixed-object settings through the Apps API", () => {
    const api = {
      isDefined: vi.fn(() => true),
      setCaption: vi.fn(),
      setFixed: vi.fn(),
      setLayer: vi.fn(),
      evalCommand: vi.fn()
    };

    expect(executeGgbCommand(api, 'SetCaption(A, "顶点 A")').ok).toBe(true);
    expect(executeGgbCommand(api, "SetLayer(A,0)").ok).toBe(true);
    expect(executeGgbCommand(api, "SetFixed(A,true,false)").ok).toBe(true);
    expect(api.setCaption).toHaveBeenCalledWith("A", "顶点 A");
    expect(api.setLayer).toHaveBeenCalledWith("A", 0);
    expect(api.setFixed).toHaveBeenCalledWith("A", true, false);
    expect(api.evalCommand).not.toHaveBeenCalled();
  });

  it("reports styling failure when the referenced object is absent", () => {
    const api = { isDefined: vi.fn(() => false), setLabelStyle: vi.fn() };

    expect(executeGgbCommand(api, "SetLabelMode(missing,1)")).toEqual({ command: "SetLabelMode(missing,1)", ok: false });
  });

  it("extracts objects that should remain hidden after rendering", () => {
    expect([...getExplicitlyHiddenObjectLabels([
      "SetVisible(vertical,false)",
      "SetVisible[xAxisLine,false]",
      "SetVisible(P,true)"
    ])]).toEqual(["vertical", "xAxisLine"]);
  });

  it("extracts planes and lines used by 3D angle constructions", () => {
    expect([...getAngleDependencyLabels([
      "angleValue=Angle(edgeAB,plane1)",
      "other=Distance(A,B)"
    ])]).toEqual(["edgeAB", "plane1"]);
  });

  it("sets an explicit z range for the 3D view", () => {
    expect(get3DCoordinateSystem({ xmin: -2, xmax: 5, ymin: -3, ymax: 8 })).toEqual([
      -2, 5, -3, 8, -8, 8, true
    ]);
  });

  it("fits the 3D view to numeric construction points", () => {
    expect(get3DCoordinateSystem(
      { xmin: -20, xmax: 20, ymin: -20, ymax: 20 },
      ["A=(0,0,0)", "B=(4,0,0)", "C=(0,2,2)"]
    )).toEqual([-1.4, 5.4, -1, 3, -1, 3, true]);
  });

  it("zooms dynamic 3D constructions that cannot be fitted from literal points", () => {
    expect(get3DAutoZoomFactor([
      "A=(0,0,0)",
      "B=(5,0,0)",
      "C=(u,2,0)",
      "D=(v,0.5,0.866025)"
    ])).toBe(3);
    expect(get3DAutoZoomFactor([
      "A=(0,0,0)",
      "B=(5,0,0)",
      "C=(2,2,0)"
    ])).toBe(1);
  });

  it("uses a quiet 3D canvas outside the full editor", () => {
    const api = {
      setAxesVisible: vi.fn(),
      setGridVisible: vi.fn(),
      setVisible: vi.fn(),
      getObjectType: vi.fn((label) => label === "p" ? "plane3d" : "segment")
    };

    apply3DCanvasPresentation(api);
    expect(api.setAxesVisible).toHaveBeenCalledWith(3, true, true, true);
    expect(api.setGridVisible).toHaveBeenCalledWith(3, false);
    expect(api.setVisible).toHaveBeenCalledWith("xOyPlane", false);
    expect(isInfinite3DPlane(api, "p")).toBe(true);
    expect(isInfinite3DPlane(api, "edge")).toBe(false);
  });
});
