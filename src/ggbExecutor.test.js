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
