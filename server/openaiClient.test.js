import { describe, expect, it } from "vitest";
import { normalizeBaseUrl } from "./openaiClient.js";

describe("OpenAI compatible provider URLs", () => {
  it("accepts registered provider base URLs", () => {
    expect(normalizeBaseUrl("https://api.deepseek.com/")).toBe("https://api.deepseek.com");
    expect(normalizeBaseUrl("https://ark.cn-beijing.volces.com/api/v3/")).toBe(
      "https://ark.cn-beijing.volces.com/api/v3"
    );
    expect(normalizeBaseUrl("https://generativelanguage.googleapis.com/v1beta/openai")).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai"
    );
  });

  it("rejects unknown or insecure base URLs", () => {
    expect(() => normalizeBaseUrl("https://example.com/v1")).toThrow("已登记");
    expect(() => normalizeBaseUrl("http://api.deepseek.com")).toThrow("https");
  });
});
