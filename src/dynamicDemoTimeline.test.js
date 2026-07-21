import { describe, expect, it } from "vitest";
import {
  createDynamicDemoPlan,
  getInitialDynamicControlValue,
  getSweepDurationMs,
  getSweepValue
} from "./dynamicDemoTimeline.js";

describe("dynamic demo timeline", () => {
  it("uses the midpoint as the default dynamic value", () => {
    expect(getInitialDynamicControlValue({ min: -3, max: 3 })).toBe(0);
    expect(getInitialDynamicControlValue({ min: 0, max: 5 })).toBe(2.5);
    expect(getInitialDynamicControlValue({ min: "bad", max: 5 })).toBe(0);
  });

  it("keeps single-parameter demos long enough for video export", () => {
    expect(getSweepDurationMs(1)).toBe(5200);
    expect(getSweepDurationMs(2)).toBe(3600);
    expect(getSweepDurationMs(0)).toBe(5200);
  });

  it("sweeps from min to max and back to min", () => {
    const control = { min: -3, max: 3 };

    expect(getSweepValue(control, 0)).toBe(-3);
    expect(getSweepValue(control, 0.25)).toBe(0);
    expect(getSweepValue(control, 0.5)).toBe(3);
    expect(getSweepValue(control, 0.75)).toBe(0);
    expect(getSweepValue(control, 1)).toBe(-3);
  });

  it("creates sequential demo steps with shared defaults", () => {
    expect(createDynamicDemoPlan([
      { name: "t", min: -2, max: 2 },
      { name: "k", min: 0, max: 4 }
    ])).toEqual({
      defaults: { t: 0, k: 2 },
      steps: [
        { control: { name: "t", min: -2, max: 2 }, durationMs: 3600 },
        { control: { name: "k", min: 0, max: 4 }, durationMs: 3600 }
      ]
    });
  });
});
