import { describe, expect, it } from "vitest";
import { getDynamicDemoState } from "./dynamicDemoState.js";

describe("dynamic demo UI state", () => {
  it("requires a current GeoGebra render before playback or export", () => {
    expect(getDynamicDemoState({
      supportsRecording: true,
      hasRenderedCurrent: false,
      isPlaying: false,
      isRecording: false
    })).toMatchObject({
      canPlay: false,
      canRecord: false,
      play: { disabled: true, text: "先绘制后播放" },
      record: { disabled: true, text: "先绘制后导出" },
      reset: { disabled: true },
      sliderDisabled: false
    });
  });

  it("enables playback and export after the current construction is rendered", () => {
    expect(getDynamicDemoState({
      supportsRecording: true,
      hasRenderedCurrent: true,
      isPlaying: false,
      isRecording: false
    })).toMatchObject({
      canPlay: true,
      canRecord: true,
      play: { disabled: false, text: "播放演示" },
      record: { disabled: false, text: "导出演示视频" },
      reset: { disabled: false },
      sliderDisabled: false
    });
  });

  it("explains direct video export when GeoGebra frame capture is available", () => {
    const state = getDynamicDemoState({
      supportsRecording: true,
      directExport: true,
      hasRenderedCurrent: true,
      isPlaying: false,
      isRecording: false
    });

    expect(state.record).toMatchObject({
      disabled: false,
      text: "导出演示视频",
      title: "直接生成 WebM 演示视频，无需屏幕录制授权"
    });
  });

  it("locks manual controls while preview playback is running", () => {
    expect(getDynamicDemoState({
      supportsRecording: true,
      hasRenderedCurrent: true,
      isPlaying: true,
      isRecording: false
    })).toMatchObject({
      play: { disabled: true, text: "播放中" },
      record: { disabled: true, text: "导出演示视频" },
      reset: { disabled: true },
      sliderDisabled: true
    });
  });

  it("reports unsupported recording without blocking playback", () => {
    expect(getDynamicDemoState({
      supportsRecording: false,
      hasRenderedCurrent: true,
      isPlaying: false,
      isRecording: false
    })).toMatchObject({
      canPlay: true,
      canRecord: false,
      play: { disabled: false, text: "播放演示" },
      record: { disabled: true, text: "不支持录制" }
    });
  });
});
