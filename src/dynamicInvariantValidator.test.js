import { describe, expect, it } from "vitest";
import { validateDynamicInvariants } from "./dynamicInvariantValidator.js";

describe("dynamic invariant validator", () => {
  it("samples native sliders and restores their original values", () => {
    const values = { theta: 12 };
    const api = {
      isDefined: (name) => name === "theta",
      getValue: (name) => values[name],
      setValue: (name, value) => { values[name] = value; }
    };
    const visited = [];

    const report = validateDynamicInvariants({
      api,
      controls: [{ name: "theta", description: "旋转", min: -180, max: 180 }],
      validateCurrentState: () => {
        visited.push(values.theta);
        return { ok: true, issues: [] };
      }
    });

    expect(report).toMatchObject({ ok: true, samples: 3 });
    expect(visited).toEqual([-180, 0, 180]);
    expect(values.theta).toBe(12);
  });

  it("reports the slider state that violates a constraint", () => {
    const values = { u: 1 };
    const api = {
      isDefined: () => true,
      getValue: (name) => values[name],
      setValue: (name, value) => { values[name] = value; }
    };

    const report = validateDynamicInvariants({
      api,
      controls: [{ name: "u", description: "点 C 沿 AB 的位置", min: 0, max: 4 }],
      validateCurrentState: () => values.u === 4
        ? { ok: false, issues: [{ message: "距离不成立" }] }
        : { ok: true, issues: [] }
    });

    expect(report.ok).toBe(false);
    expect(report.issues[0].message).toContain("点 C 沿 AB 的位置=4");
    expect(values.u).toBe(1);
  });
});
