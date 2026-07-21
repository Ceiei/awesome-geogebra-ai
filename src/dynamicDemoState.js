export function getDynamicDemoState({
  supportsRecording,
  directExport = false,
  hasRenderedCurrent,
  isPlaying,
  isRecording
}) {
  const canPlay = Boolean(hasRenderedCurrent);
  const canRecord = Boolean(supportsRecording && hasRenderedCurrent);
  const isBusy = Boolean(isPlaying || isRecording);

  return {
    canPlay,
    canRecord,
    play: {
      disabled: isBusy || !canPlay,
      text: isPlaying ? "播放中" : canPlay ? "播放演示" : "先绘制后播放",
      title: canPlay ? "自动拖动下方参数预览演示效果" : "先绘制到 GeoGebra 后再播放演示"
    },
    record: {
      disabled: isBusy || !canRecord,
      text: isRecording ? "录制中" : !supportsRecording ? "不支持录制" : canRecord ? "导出演示视频" : "先绘制后导出",
      title: supportsRecording
        ? canRecord
          ? directExport
            ? "直接生成 WebM 演示视频，无需屏幕录制授权"
            : "录制时请选择当前浏览器标签页"
          : "先绘制到 GeoGebra 后再导出演示视频"
        : "当前浏览器不支持直接录制演示视频"
    },
    reset: {
      disabled: isBusy || !canPlay
    },
    sliderDisabled: isBusy
  };
}
