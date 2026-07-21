export function getInitialDynamicControlValue(control) {
  const min = Number(control?.min);
  const max = Number(control?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  return Number(((min + max) / 2).toFixed(4));
}

export function getSweepDurationMs(controlCount) {
  return Math.max(2800, Math.min(5200, Number(controlCount) > 1 ? 3600 : 6000));
}

export function getSweepValue(control, progress) {
  const min = Number(control?.min);
  const max = Number(control?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

  const safeProgress = Math.min(1, Math.max(0, Number(progress) || 0));
  const phase = safeProgress <= 0.5 ? safeProgress * 2 : (1 - safeProgress) * 2;
  return Number((min + (max - min) * phase).toFixed(4));
}

export function createDynamicDemoPlan(controls) {
  const usableControls = Array.isArray(controls) ? controls : [];
  const defaults = Object.fromEntries(
    usableControls.map((control) => [control.name, getInitialDynamicControlValue(control)])
  );
  const sweepDurationMs = getSweepDurationMs(usableControls.length);

  return {
    defaults,
    steps: usableControls.map((control) => ({
      control,
      durationMs: sweepDurationMs
    }))
  };
}
