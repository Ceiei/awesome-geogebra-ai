import request from "supertest";
import { describe, expect, it } from "vitest";
import handler from "./[...path].js";

describe("Vercel API adapter", () => {
  it("normalizes Vercel catch-all paths to the existing API routes", async () => {
    const response = await request(handler).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, validatorVersion: expect.any(String) });
  });
});
