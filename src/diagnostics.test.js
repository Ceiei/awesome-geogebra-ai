import { describe, expect, it } from "vitest";
import { createDiagnosticReport, recordDiagnostic } from "./diagnostics.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value)
  };
}

describe("privacy-safe diagnostics", () => {
  it("removes problem content and API credentials", () => {
    const storage = memoryStorage();
    recordDiagnostic({
      traceId: "trace-1",
      problemText: "私密题目",
      apiKey: "sk-secretsecret",
      error: "Bearer sk-secretsecret"
    }, storage);
    const report = createDiagnosticReport(storage);
    expect(report).not.toContain("私密题目");
    expect(report).not.toContain("sk-secretsecret");
    expect(report).toContain("[API_KEY]");
  });
});
