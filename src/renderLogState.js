export function getRenderLogState(commandResults) {
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
      summary: "绘制后可拖动、缩放，并下载 GGB 或网页文件。",
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
      tone: "fail",
      summary: "未生成可见图形，请重新生成绘图方案",
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
