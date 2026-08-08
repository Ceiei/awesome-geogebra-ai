import { describe, expect, it } from "vitest";
import { parseApiResponse } from "./apiClient.js";

describe("API response parsing", () => {
  it("returns a JSON payload", async () => {
    const payload = await parseApiResponse(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));
    expect(payload).toEqual({ ok: true });
  });

  it("keeps a JSON API error readable", async () => {
    await expect(parseApiResponse(new Response(JSON.stringify({ error: "模型不支持图片" }), {
      status: 400
    }), "解析失败。"))
      .rejects.toThrow("模型不支持图片");
  });

  it("does not expose a JSON syntax error for a deployment failure", async () => {
    await expect(parseApiResponse(new Response("An error occurred with your deployment", {
      status: 500
    }), "解析失败。"))
      .rejects.toThrow("解析服务发生异常，请稍后重试。");
  });

  it("reports an invalid successful response without leaking HTML", async () => {
    await expect(parseApiResponse(new Response("<html>unexpected</html>", {
      status: 200
    })))
      .rejects.toThrow("解析服务返回了无法识别的数据");
  });
});
