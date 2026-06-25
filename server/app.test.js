import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("solve API", () => {
  const originalMock = process.env.USE_MOCK_AI;

  afterEach(() => {
    if (originalMock === undefined) {
      delete process.env.USE_MOCK_AI;
    } else {
      process.env.USE_MOCK_AI = originalMock;
    }
  });

  it("rejects empty requests", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp()).post("/api/solve").field("text", "");
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("请输入题目");
  });

  it("returns a normalized mock solve result", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/solve")
      .field("text", "Plot y = x^2 - 3x + 2 and mark roots");

    expect(response.status).toBe(200);
    expect(response.body.mathType).toBe("function");
    expect(response.body.ggbCommands.length).toBeGreaterThan(0);
    expect(response.body.rejectedCommands).toEqual([]);
  });

  it("rejects unsupported image MIME types", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/solve")
      .field("text", "Draw this")
      .attach("image", Buffer.from("not an image"), {
        filename: "problem.txt",
        contentType: "text/plain"
      });

    expect(response.status).toBe(415);
  });

  it("rejects command regeneration without construction steps", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp()).post("/api/commands").send({ constructionSteps: [] });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("构造步骤");
  });

  it("regenerates safe commands from edited construction steps", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/commands")
      .send({
        problemSummary: "构造三角形",
        mathType: "geometry",
        constructionSteps: ["放置 A、B、C 三点。", "连接三条边。"],
        viewport: { xmin: -5, xmax: 5, ymin: -4, ymax: 5 }
      });

    expect(response.status).toBe(200);
    expect(response.body.constructionSteps).toEqual(["放置 A、B、C 三点。", "连接三条边。"]);
    expect(response.body.ggbCommands).toContain("Polygon(A,B,C)");
  });
});
