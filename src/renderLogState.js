export function getRenderLogState(commandResults, qualityReport = null) {
  const results = Array.isArray(commandResults) ? commandResults : [];
  const total = results.length;
  const failed = results.filter((entry) => !entry?.ok);
  const succeeded = total - failed.length;

  if (!total) {
    return {
      total,
      succeeded,
      failed: 0,
      tone: "idle",
      summary: "绘制后可拖动、缩放并播放动态演示。",
      defaultExpanded: false,
      visibleEntries: []
    };
  }

  if (qualityReport?.checked && !qualityReport.ok) {
    return {
      total,
      succeeded,
      failed: failed.length,
      tone: "ok",
      summary: "已完成绘制",
      defaultExpanded: false,
      visibleEntries: []
    };
  }

  if (failed.length) {
    if (succeeded > 0) {
      return {
        total,
        succeeded,
        failed: failed.length,
        tone: "ok",
        summary: "已完成绘制",
        defaultExpanded: false,
        visibleEntries: []
      };
    }

    return {
      total,
      succeeded,
      failed: failed.length,
      tone: "idle",
      summary: "正在检查绘图结果",
      defaultExpanded: false,
      visibleEntries: []
    };
  }

  return {
    total,
    succeeded,
    failed: 0,
    tone: "ok",
    summary: "已完成绘制",
    defaultExpanded: false,
    visibleEntries: []
  };
}
