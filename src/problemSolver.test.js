import { describe, expect, it, vi } from "vitest";
import { requestProblemSolution } from "./problemSolver.js";

describe("problem solution request", () => {
  it("turns one image submission into recognition followed by text solving", async () => {
    const calls = [];
    const stages = [];
    const request = vi.fn(async (url, init) => {
      calls.push({
        url,
        text: init.body.get("text"),
        hasImage: init.body.has("image")
      });
      if (url === "/api/recognize") {
        return { recognizedText: "在空间中，二面角 C-AB-D 为 60°。" };
      }
      return { schemaVersion: 2, mathType: "solid_geometry", ggbCommands: ["A=(0,0,0)"] };
    });

    const result = await requestProblemSolution({
      image: new Blob(["image"], { type: "image/png" }),
      request,
      onStage: (stage) => stages.push(stage)
    });

    expect(stages).toEqual(["recognizing", "solving"]);
    expect(calls).toEqual([
      { url: "/api/recognize", text: "", hasImage: true },
      { url: "/api/solve", text: "在空间中，二面角 C-AB-D 为 60°。", hasImage: false }
    ]);
    expect(result.payload.mathType).toBe("solid_geometry");
  });

  it("uses one solve request for a text-only problem", async () => {
    const request = vi.fn(async () => ({ schemaVersion: 2, ggbCommands: ["A=(0,0)"] }));
    await requestProblemSolution({ text: "构造点 A", request });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe("/api/solve");
  });

  it("continues with supplied text when a compatible provider cannot process images", async () => {
    const request = vi.fn(async (url) => {
      if (url === "/api/recognize") throw new Error("模型不支持图片");
      return { schemaVersion: 2, mathType: "solid_geometry", ggbCommands: ["A=(0,0,0)"] };
    });

    const result = await requestProblemSolution({
      text: "在空间中，二面角 C-AB-D 为 60°。",
      image: new Blob(["image"], { type: "image/png" }),
      request
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(result.recognizedText).toContain("二面角");
    expect(result.payload.mathType).toBe("solid_geometry");
  });
});
