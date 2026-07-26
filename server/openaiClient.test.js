import { describe, expect, it } from "vitest";
import { assertPublicProviderUrl, normalizeBaseUrl, testProviderConnection } from "./openaiClient.js";

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

  it("accepts custom public OpenAI-compatible base URLs", () => {
    expect(normalizeBaseUrl("https://llm.example.com/v1/")).toBe("https://llm.example.com/v1");
  });

  it("rejects insecure or private base URLs", () => {
    expect(() => normalizeBaseUrl("http://api.deepseek.com")).toThrow("https");
    expect(() => normalizeBaseUrl("https://localhost/v1")).toThrow("内网");
    expect(() => normalizeBaseUrl("https://127.0.0.1/v1")).toThrow("内网");
    expect(() => normalizeBaseUrl("https://192.168.1.20/v1")).toThrow("内网");
    expect(() => normalizeBaseUrl("https://metadata.google.internal/v1")).toThrow("内网");
    expect(() => normalizeBaseUrl("https://user:pass@example.com/v1")).toThrow("账号");
  });

  it("rejects custom providers without an explicit model before sending a request", async () => {
    await expect(testProviderConnection({
      apiKey: "test-key",
      baseUrl: "https://llm.example.com/v1",
      model: ""
    })).rejects.toThrow("必须填写模型名");
  });

  it("rejects private provider targets before sending a request", async () => {
    await expect(assertPublicProviderUrl("https://127.0.0.1/v1")).rejects.toThrow("内网");
  });
});
