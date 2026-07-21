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
    return {
      total,
      succeeded,
      failed: failed.length,
      tone: "fail",
      summary: `已执行 ${total} 条命令，失败 ${failed.length} 条`,
      defaultExpanded: true,
      visibleEntries: failed
    };
  }

  return {
    total,
    succeeded,
    failed: 0,
    tone: "ok",
    summary: `已执行 ${total} 条命令，全部成功`,
    defaultExpanded: false,
    visibleEntries: []
  };
}
