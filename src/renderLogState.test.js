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
      summary: "已执行 2 条命令，全部成功",
      defaultExpanded: false,
      visibleEntries: []
    });
  });

  it("expands failed commands by default", () => {
    const failed = { command: "bad=Unknown()", ok: false };
    expect(getRenderLogState([
      { command: "A=(0,0)", ok: true },
      failed
    ])).toMatchObject({
      tone: "fail",
      summary: "已执行 2 条命令，失败 1 条",
      defaultExpanded: true,
      visibleEntries: [failed]
    });
  });
});
