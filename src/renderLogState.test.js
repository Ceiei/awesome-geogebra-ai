import { describe, expect, it } from "vitest";
import { getRenderLogState } from "./renderLogState.js";

describe("render log UI state", () => {
  it("uses a compact idle message before rendering", () => {
    expect(getRenderLogState([])).toMatchObject({
      tone: "idle",
      summary: "绘制后可拖动、缩放，并下载 GGB 或网页文件。",
      defaultExpanded: false,
      visibleEntries: []
    });
  });

  it("summarizes successful renders without showing command noise", () => {
    expect(getRenderLogState([
      { command: "A=(0,0)", ok: true },
      { command: "B=(1,0)", ok: true }
    ])).toMatchObject({
      tone: "ok",
      summary: "已完成绘制",
      defaultExpanded: false,
      visibleEntries: []
    });
  });

  it("does not expose individual command failures when a drawing was produced", () => {
    const failed = { command: "bad=Unknown()", ok: false };
    expect(getRenderLogState([
      { command: "A=(0,0)", ok: true },
      failed
    ])).toMatchObject({
      tone: "ok",
      summary: "已完成绘制",
      defaultExpanded: false,
      visibleEntries: []
    });
  });

  it("reports an unusable construction without exposing raw commands", () => {
    expect(getRenderLogState([
      { command: "bad=Unknown()", ok: false }
    ])).toMatchObject({
      tone: "fail",
      summary: "未生成可见图形，请重新生成绘图方案",
      defaultExpanded: false,
      visibleEntries: []
    });
  });
});
