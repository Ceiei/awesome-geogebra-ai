import { describe, expect, it, vi } from "vitest";
import { requestProblemSolution } from "./problemSolver.js";

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
