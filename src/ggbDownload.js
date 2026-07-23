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

function filenameStem(title) {
  const normalized = String(title || "geogebra-ai")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
  return normalized || "geogebra-ai";
}

export function createGgbFilename(date = new Date(), title = "") {
  return `${filenameStem(title)}-${date.toISOString().slice(0, 10)}.ggb`;
}

export function createGgbWebFilename(date = new Date(), title = "") {
  return `${filenameStem(title)}-${date.toISOString().slice(0, 10)}.html`;
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

export function createGgbWebPage(base64, {
  title = "GeoGebra AI 构造",
  appName = "classic",
  commands = [],
  problemText = "",
  constructionSteps = [],
  dynamicControls = [],
  objectManifest = []
} = {}) {
  const safeTitle = escapeHtml(title);
  const safeBase64 = stringifyForScript(base64);
  const safeAppName = appName === "3d" ? "3d" : "classic";
  const safeProblemText = escapeHtml(problemText);
  const safeSteps = (constructionSteps || []).map((step) => escapeHtml(typeof step === "string" ? step : step?.text || ""));
  const safeControls = stringifyForScript(dynamicControls || []);
  const safeManifest = stringifyForScript(objectManifest || []);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <script src="https://www.geogebra.org/apps/deployggb.js"></script>
  <style>
    html, body { width: 100%; height: 100%; margin: 0; }
    body { display:grid; grid-template-rows:auto minmax(0,1fr) auto; overflow: hidden; background: #f8fafc; color:#182033; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    header { display:flex; align-items:center; justify-content:space-between; gap:16px; min-height:52px; padding:8px 16px; border-bottom:1px solid #d9e1ec; background:#fff; }
    header h1 { margin:0; font-size:18px; } header p { margin:3px 0 0; color:#667085; font-size:12px; max-width:70vw; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    #ggb-container { width:100%; min-height:0; }
    #ggb-container { display: grid; place-items: stretch; }
    #controls { display:grid; gap:8px; padding:10px 16px; border-top:1px solid #d9e1ec; background:#fff; }
    .control { display:grid; grid-template-columns:160px minmax(120px,1fr) 64px; align-items:center; gap:10px; font-size:13px; }
    .steps { display:flex; gap:6px; } button { min-height:32px; border:1px solid #d9e1ec; border-radius:6px; padding:0 10px; background:#fff; cursor:pointer; }
    .fallback { padding: 24px; color: #344054; }
  </style>
</head>
<body>
  <header>
    <div><h1>${safeTitle}</h1><p>${safeProblemText}</p></div>
    <div class="steps">
      <button id="previous-step" type="button">上一步</button>
      <button id="next-step" type="button">下一步</button>
      <button id="reset-view" type="button">复位</button>
    </div>
  </header>
  <div id="ggb-container"><p class="fallback">正在加载 GeoGebra...</p></div>
  <div id="controls"></div>
  <script>
    const constructionSteps = ${stringifyForScript(safeSteps)};
    const dynamicControls = ${safeControls};
    const objectManifest = ${safeManifest};
    let currentStage = Math.min(1, constructionSteps.length);
    let appletApi = null;

    function applyStage() {
      if (!appletApi) return;
      for (const object of objectManifest) {
        try {
          appletApi.setVisible(object.label, Number(object.stage || 1) <= currentStage && object.visible !== false);
        } catch {}
      }
      appletApi.refreshViews?.();
    }

    function buildControls() {
      const root = document.getElementById("controls");
      root.replaceChildren();
      for (const control of dynamicControls) {
        const row = document.createElement("label");
        row.className = "control";
        const name = document.createElement("span");
        name.textContent = control.description || control.label || control.name;
        const input = document.createElement("input");
        input.type = "range"; input.min = control.min; input.max = control.max; input.step = control.step;
        input.value = Number.isFinite(Number(control.defaultValue)) ? control.defaultValue : (Number(control.min) + Number(control.max)) / 2;
        const output = document.createElement("output");
        output.textContent = input.value;
        input.addEventListener("input", () => {
          output.textContent = input.value;
          appletApi?.setValue?.(control.name, Number(input.value));
          appletApi?.refreshViews?.();
        });
        row.append(name, input, output);
        root.append(row);
      }
      root.hidden = dynamicControls.length === 0;
    }

    const parameters = {
      id: "ggbApplet",
      appName: "${safeAppName}",
      language: "zh-CN",
      ggbBase64: ${safeBase64},
      width: Math.max(1, document.getElementById("ggb-container").clientWidth),
      height: Math.max(1, document.getElementById("ggb-container").clientHeight),
      showToolBar: false,
      showAlgebraInput: false,
      showMenuBar: false,
      showZoomButtons: true,
      enableLabelDrags: true,
      enableShiftDragZoom: true,
      appletOnLoad: (api) => {
        appletApi = api;
        buildControls();
        currentStage = Math.max(1, constructionSteps.length);
        applyStage();
      }
    };

    const applet = new GGBApplet(parameters, true);
    applet.inject("ggb-container");
    document.getElementById("previous-step").addEventListener("click", () => { currentStage = Math.max(1, currentStage - 1); applyStage(); });
    document.getElementById("next-step").addEventListener("click", () => { currentStage = Math.min(Math.max(1, constructionSteps.length), currentStage + 1); applyStage(); });
    document.getElementById("reset-view").addEventListener("click", () => { currentStage = Math.max(1, constructionSteps.length); applyStage(); appletApi?.refreshViews?.(); });

    window.addEventListener("resize", () => {
      const api = window.ggbApplet;
      if (api && typeof api.setSize === "function") {
        const container = document.getElementById("ggb-container");
        api.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight));
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

export function downloadGgbConstruction(api, options = {}, browserRefs) {
  const base64 = getGgbBase64(api);
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  downloadBlob(new Blob([bytes], { type: GGB_MIME_TYPE }), createGgbFilename(new Date(), options.title), browserRefs);
}

export function downloadGgbWebPage(api, options = {}, browserRefs) {
  const base64 = getGgbBase64(api);
  const html = createGgbWebPage(base64, options);
  downloadBlob(new Blob([html], { type: HTML_MIME_TYPE }), createGgbWebFilename(new Date(), options.title), browserRefs);
}
