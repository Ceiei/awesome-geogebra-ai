import { describe, expect, it, vi } from "vitest";
import { executeGgbCommand, get3DCoordinateSystem } from "./ggbExecutor.js";

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

  it("handles captions and fixed-object settings through the Apps API", () => {
    const api = { isDefined: vi.fn(() => true), setCaption: vi.fn(), setFixed: vi.fn(), evalCommand: vi.fn() };

    expect(executeGgbCommand(api, 'SetCaption(A, "顶点 A")').ok).toBe(true);
    expect(executeGgbCommand(api, "SetFixed(A,true,false)").ok).toBe(true);
    expect(api.setCaption).toHaveBeenCalledWith("A", "顶点 A");
    expect(api.setFixed).toHaveBeenCalledWith("A", true, false);
    expect(api.evalCommand).not.toHaveBeenCalled();
  });

  it("reports styling failure when the referenced object is absent", () => {
    const api = { isDefined: vi.fn(() => false), setLabelStyle: vi.fn() };

    expect(executeGgbCommand(api, "SetLabelMode(missing,1)")).toEqual({ command: "SetLabelMode(missing,1)", ok: false });
  });

  it("sets an explicit z range for the 3D view", () => {
    expect(get3DCoordinateSystem({ xmin: -2, xmax: 5, ymin: -3, ymax: 8 })).toEqual([
      -2, 5, -3, 8, -8, 8, true
    ]);
  });
});
