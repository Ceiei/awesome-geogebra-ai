const DIAGNOSTICS_KEY = "ggb-ai-diagnostics-v1";

function sanitize(value) {
  const text = JSON.stringify(value ?? null)
    .replace(/\bsk-[A-Za-z0-9._-]{8,}\b/g, "[API_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  return JSON.parse(text);
}

export function recordDiagnostic(entry, storageRef = localStorage) {
  let current = [];
  try {
    current = JSON.parse(storageRef.getItem(DIAGNOSTICS_KEY) || "[]");
  } catch {
    current = [];
  }
  const safeEntry = sanitize({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
    problemText: undefined,
    image: undefined,
    apiKey: undefined
  });
  storageRef.setItem(DIAGNOSTICS_KEY, JSON.stringify([safeEntry, ...current].slice(0, 100)));
  return safeEntry;
}

export function readDiagnostics(storageRef = localStorage) {
  try {
    const parsed = JSON.parse(storageRef.getItem(DIAGNOSTICS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createDiagnosticReport(storageRef = localStorage) {
  return JSON.stringify({
    format: "geogebra-ai-diagnostics",
    version: 1,
    exportedAt: new Date().toISOString(),
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    entries: readDiagnostics(storageRef)
  }, null, 2);
}
