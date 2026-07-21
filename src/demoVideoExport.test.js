import { describe, expect, it } from "vitest";
import {
  createDemoVideoBlob,
  createDemoVideoFilename,
  getDemoRecordingChecklist,
  getDemoRecordingErrorMessage,
  getGgbPngDataUrl,
  getSupportedDemoVideoMimeType,
  normalizePngDataUrl
} from "./demoVideoExport.js";

describe("dynamic demo video export helpers", () => {
  it("creates a stable demo video filename", () => {
    expect(createDemoVideoFilename(new Date("2026-06-24T12:34:56.000Z"))).toBe(
      "geogebra-ai-demo-2026-06-24-12-34-56.webm"
    );
  });

  it("builds a video blob from non-empty recorder chunks", async () => {
    const blob = createDemoVideoBlob([
      new Blob([]),
      new Blob(["abc"], { type: "video/webm" })
    ], "video/webm;codecs=vp9");

    expect(blob.type).toBe("video/webm;codecs=vp9");
    expect(await blob.text()).toBe("abc");
  });

  it("selects the best supported webm mime type", () => {
    expect(getSupportedDemoVideoMimeType({
      isTypeSupported: (mimeType) => mimeType === "video/webm;codecs=vp9"
    })).toBe("video/webm;codecs=vp9");
    expect(getSupportedDemoVideoMimeType({ isTypeSupported: () => false })).toBe("video/webm");
  });

  it("normalizes GeoGebra PNG frame data", () => {
    expect(normalizePngDataUrl("abc")).toBe("data:image/png;base64,abc");
    expect(normalizePngDataUrl("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
    expect(() => normalizePngDataUrl("")).toThrow("没有返回");
  });

  it("reads GeoGebra PNG frames from direct and callback APIs", async () => {
    await expect(getGgbPngDataUrl({
      getPNGBase64: () => "abc"
    })).resolves.toBe("data:image/png;base64,abc");

    await expect(getGgbPngDataUrl({
      getPNGBase64: (...args) => {
        const callback = args.find((arg) => typeof arg === "function");
        if (callback) callback("def");
      }
    })).resolves.toBe("data:image/png;base64,def");
  });

  it("rejects empty recorder output", () => {
    expect(() => createDemoVideoBlob([], "video/webm")).toThrow("未录制到有效视频");
    expect(() => createDemoVideoBlob([new Blob([])], "video/webm")).toThrow("未录制到有效视频");
  });

  it("keeps actionable recording error messages", () => {
    expect(getDemoRecordingErrorMessage({ name: "NotAllowedError" })).toBe("已取消录制，未生成视频");
    expect(getDemoRecordingErrorMessage({ name: "NotFoundError" })).toContain("没有可录制");
    expect(getDemoRecordingErrorMessage({ name: "NotReadableError" })).toContain("重新选择当前标签页");
    expect(getDemoRecordingErrorMessage(new Error("未录制到有效视频，请重新选择当前浏览器标签页录制。"))).toBe(
      "未录制到有效视频，请重新选择当前浏览器标签页录制。"
    );
    expect(getDemoRecordingErrorMessage(null)).toBe("录制演示视频失败");
  });

  it("describes the screen-recording preparation steps for teachers", () => {
    expect(getDemoRecordingChecklist()).toEqual(expect.arrayContaining([
      expect.stringContaining("当前网页或浏览器标签页"),
      expect.stringContaining("自动播放"),
      expect.stringContaining(".webm")
    ]));
  });
});
