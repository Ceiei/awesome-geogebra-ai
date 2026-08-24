import { describe, expect, it, vi } from "vitest";
import { requestProblemPlan, requestProblemSolution } from "./problemSolver.js";

describe("problem solution request", () => {
  it("handles image recognition and solving in one model request", async () => {
    const calls = [];
    const stages = [];
    const request = vi.fn(async (url, init) => {
      calls.push({
        url,
        text: init.body.get("text"),
        hasImage: init.body.has("image")
      });
      return {
        schemaVersion: 2,
        recognizedProblemText: "在空间中，二面角 C-AB-D 为 60°。",
        mathType: "solid_geometry",
        ggbCommands: ["A=(0,0,0)"]
      };
    });

    const result = await requestProblemSolution({
      image: new Blob(["image"], { type: "image/png" }),
      request,
      onStage: (stage) => stages.push(stage)
    });

    expect(stages).toEqual(["solving_image"]);
    expect(calls).toEqual([
      { url: "/api/solve", text: "", hasImage: true }
    ]);
    expect(result.payload.mathType).toBe("solid_geometry");
  });

  it("uses one solve request for a text-only problem", async () => {
    const request = vi.fn(async () => ({ schemaVersion: 2, ggbCommands: ["A=(0,0)"] }));
    await requestProblemSolution({ text: "构造点 A", request });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe("/api/solve");
  });

  it("marks an explicit reparse so the server bypasses templates and caches", async () => {
    const request = vi.fn(async () => ({ schemaVersion: 2, ggbCommands: ["A=(0,0)"] }));
    await requestProblemSolution({ text: "重新分析这道题", forceReparse: true, request });
    expect(request.mock.calls[0][1].body.get("forceReparse")).toBe("1");
  });

  it("requests construction steps without requesting commands", async () => {
    const request = vi.fn(async () => ({
      recognizedProblemText: "构造三角形 ABC",
      mathType: "geometry",
      constructionSteps: [{ id: "step-1", text: "放置 A、B、C。", objectLabels: ["A", "B", "C"], stage: 1 }]
    }));
    const result = await requestProblemPlan({ text: "构造三角形 ABC", request });
    expect(request.mock.calls[0][0]).toBe("/api/plan");
    expect(result.payload).not.toHaveProperty("ggbCommands");
  });

  it("sends supplied OCR text together with the image as a correction hint", async () => {
    const request = vi.fn(async () => ({
      schemaVersion: 2,
      recognizedProblemText: "在空间中，二面角 C-AB-D 为 60°。",
      mathType: "solid_geometry",
      ggbCommands: ["A=(0,0,0)"]
    }));

    const result = await requestProblemSolution({
      text: "在空间中，二面角 C-AB-D 为 60°。",
      image: new Blob(["image"], { type: "image/png" }),
      request
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][1].body.get("text")).toContain("二面角");
    expect(request.mock.calls[0][1].body.has("image")).toBe(true);
    expect(result.recognizedText).toContain("二面角");
    expect(result.payload.mathType).toBe("solid_geometry");
  });
});
