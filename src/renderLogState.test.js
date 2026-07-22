import { describe, expect, it } from "vitest";
import { getRenderLogState } from "./renderLogState.js";

describe("render log UI state", () => {
  it("uses a compact idle message before rendering", () => {
    expect(getRenderLogState([])).toMatchObject({
      tone: "idle",
      summary: "绘制后可拖动、缩放并播放动态演示。",
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

  it("keeps quality warnings internal", () => {
    expect(getRenderLogState([
      { command: "A=(0,0)", ok: true }
    ], {
      checked: true,
      ok: false,
      issues: ["缺少关键对象：B"]
    })).toMatchObject({
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
      tone: "idle",
      summary: "正在检查绘图结果",
      defaultExpanded: false,
      visibleEntries: []
    });
  });
});
