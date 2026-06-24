import { describe, expect, it } from "vitest";
import { normalizeViewport, validateGgbCommand, validateGgbCommands } from "./ggbValidation.js";

describe("GeoGebra command validation", () => {
  it("allows MVP construction commands and simple assignments", () => {
    expect(validateGgbCommand("A=(-3,0)").ok).toBe(true);
    expect(validateGgbCommand("P=(0,0,3)").ok).toBe(true);
    expect(validateGgbCommand("a=2").ok).toBe(true);
    expect(validateGgbCommand("b=2*sqrt(2)").ok).toBe(true);
    expect(validateGgbCommand("A=(2*sqrt(2), 0, 0)").ok).toBe(true);
    expect(validateGgbCommand("B=(a/2, cos(45°), pi)").ok).toBe(true);
    expect(validateGgbCommand("f(x)=x^2-3*x+2").ok).toBe(true);
    expect(validateGgbCommand("l=AngleBisector(A,C,B)").ok).toBe(true);
    expect(validateGgbCommand("Prism(Polygon(A,B,C,D), 4)").ok).toBe(true);
    expect(validateGgbCommand("Sphere(P, 3)").ok).toBe(true);
    expect(validateGgbCommand("SetColor(l, 220, 38, 38)").ok).toBe(true);
    expect(validateGgbCommand('SetColor(l, "Red")').ok).toBe(true);
    expect(validateGgbCommand('Text["距离 = " + dist, (3, 3, 2)]')).toEqual({
      ok: true,
      command: 'Text("距离 = " + dist, (3, 3, 2))'
    });
  });

  it("rejects unsupported or script-like commands", () => {
    expect(validateGgbCommand("Delete(A)").ok).toBe(false);
    expect(validateGgbCommand("RunClickScript(A, \"alert(1)\")").ok).toBe(false);
    expect(validateGgbCommand("Button(\"go\")").ok).toBe(false);
    expect(validateGgbCommand("A=(0,0); Delete(A)").ok).toBe(false);
    expect(validateGgbCommand("A=(Execute(\"Delete(A)\"),0,0)").ok).toBe(false);
    expect(validateGgbCommand("A=(UnknownCommand(1),0,0)").ok).toBe(false);
    expect(validateGgbCommand("unsafe=RunClickScript(A, \"x\")").ok).toBe(false);
  });

  it("deduplicates accepted commands and reports rejected ones", () => {
    const result = validateGgbCommands(["A=(0,0)", "A=(0,0)", "Delete(A)"]);
    expect(result.validCommands).toEqual(["A=(0,0)"]);
    expect(result.rejectedCommands).toHaveLength(1);
  });

  it("normalizes invalid viewport values", () => {
    expect(normalizeViewport({ xmin: 4, xmax: -4, ymin: -1, ymax: 1 })).toEqual({
      xmin: -8,
      xmax: 8,
      ymin: -6,
      ymax: 6
    });
  });
});
