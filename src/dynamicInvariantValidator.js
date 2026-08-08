function sampleValues(control) {
  const min = Number(control?.min);
  const max = Number(control?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  return [...new Set([min, (min + max) / 2, max])];
}

export function validateDynamicInvariants({ api, controls, validateCurrentState }) {
  const nativeControls = (controls || []).filter((control) => {
    try {
      return control?.name && (typeof api?.isDefined !== "function" || api.isDefined(control.name));
    } catch {
      return false;
    }
  });
  if (!nativeControls.length) return { ok: true, status: "not_applicable", issues: [], samples: 0 };

  const originalValues = new Map(nativeControls.map((control) => [control.name, api.getValue?.(control.name)]));
  let samples = 0;
  const issues = [];

  try {
    for (const control of nativeControls) {
      for (const value of sampleValues(control)) {
        api.setValue?.(control.name, value);
        const report = validateCurrentState({ control, value });
        samples += 1;
        if (!report?.ok) {
          issues.push(...(report?.issues || []).map((issue) => ({
            ...issue,
            message: `${control.description || control.name}=${Number(value.toFixed(4))} 时：${issue.message || "动态约束不成立"}`
          })));
        }
      }
    }
  } finally {
    for (const [name, value] of originalValues) {
      if (Number.isFinite(value)) api.setValue?.(name, value);
    }
  }

  return {
    ok: issues.length === 0,
    status: issues.length ? "failed" : "passed",
    issues,
    samples
  };
}
