const GGB_MIME_TYPE = "application/vnd.geogebra.file";
const HTML_MIME_TYPE = "text/html;charset=utf-8";

export function getGgbBase64(api) {
  if (!api || typeof api.getBase64 !== "function") {
    throw new Error("GeoGebra 画布尚未准备完成");
  }

  const exported = api.getBase64();
  if (typeof exported !== "string" || !exported.trim()) {
    throw new Error("当前构造无法导出");
  }

  return exported.replace(/^data:[^;]+;base64,/i, "").replace(/\s/g, "");
}

export function createGgbFilename(date = new Date()) {
  return `geogebra-ai-${date.toISOString().slice(0, 10)}.ggb`;
}

export function createGgbWebFilename(date = new Date()) {
  return `geogebra-ai-${date.toISOString().slice(0, 10)}.html`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeCommands(commands) {
  return Array.isArray(commands)
    ? commands.map((command) => String(command).trim()).filter(Boolean)
    : [];
}

function stringifyForScript(value) {
  return JSON.stringify(value).replaceAll("</", "<\\/");
}

export function createGgbWebPage(base64, { title = "GeoGebra AI 构造", appName = "classic", commands = [] } = {}) {
  const safeTitle = escapeHtml(title);
  const safeBase64 = stringifyForScript(base64);
  const safeAppName = appName === "3d" ? "3d" : "classic";
  const normalizedCommands = normalizeCommands(commands);
  const safeCommands = stringifyForScript(normalizedCommands);
  const shouldReplayCommands = normalizedCommands.length > 0;
  const constructionSource = shouldReplayCommands ? "" : `ggbBase64: ${safeBase64},`;
  const replayScript = shouldReplayCommands
    ? `
      const commands = ${safeCommands};
      try {
        api.setErrorDialogsActive?.(false);
      } catch {}
      for (const command of commands) {
        try {
          api.evalCommand(command);
        } catch (error) {
          console.warn("GeoGebra command failed", command, error);
        }
      }
      try {
        api.refreshViews?.();
      } catch {}`
    : "";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <script src="https://www.geogebra.org/apps/deployggb.js"></script>
  <style>
    html, body, #ggb-container { width: 100%; height: 100%; margin: 0; }
    body { overflow: hidden; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    #ggb-container { display: grid; place-items: stretch; }
    .fallback { padding: 24px; color: #344054; }
  </style>
</head>
<body>
  <div id="ggb-container"><p class="fallback">正在加载 GeoGebra...</p></div>
  <script>
    const parameters = {
      id: "ggbApplet",
      appName: "${safeAppName}",
      language: "zh-CN",
      ${constructionSource}
      width: Math.max(1, window.innerWidth),
      height: Math.max(1, window.innerHeight),
      showToolBar: true,
      showAlgebraInput: true,
      showMenuBar: false,
      showZoomButtons: true,
      enableLabelDrags: true,
      enableShiftDragZoom: true,
      appletOnLoad: (api) => {${replayScript}
      }
    };

    const applet = new GGBApplet(parameters, true);
    applet.inject("ggb-container");

    window.addEventListener("resize", () => {
      const api = window.ggbApplet;
      if (api && typeof api.setSize === "function") {
        api.setSize(Math.max(1, window.innerWidth), Math.max(1, window.innerHeight));
      }
    });
  </script>
</body>
</html>`;
}

function downloadBlob(blob, filename, { documentRef = document, urlRef = URL } = {}) {
  const objectUrl = urlRef.createObjectURL(blob);
  const link = documentRef.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";
  documentRef.body.append(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => urlRef.revokeObjectURL(objectUrl), 0);
}

export function downloadGgbConstruction(api, browserRefs) {
  const base64 = getGgbBase64(api);
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  downloadBlob(new Blob([bytes], { type: GGB_MIME_TYPE }), createGgbFilename(), browserRefs);
}

export function downloadGgbWebPage(api, options = {}, browserRefs) {
  const commands = normalizeCommands(options.commands);
  const base64 = commands.length ? "" : getGgbBase64(api);
  const html = createGgbWebPage(base64, options);
  downloadBlob(new Blob([html], { type: HTML_MIME_TYPE }), createGgbWebFilename(), browserRefs);
}
