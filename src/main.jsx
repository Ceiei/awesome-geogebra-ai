import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileImage,
  History,
  Loader2,
  KeyRound,
  Maximize2,
  Minimize2,
  PencilRuler,
  Play,
  RefreshCw,
  Upload,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { executeGgbCommand, get3DCoordinateSystem } from "./ggbExecutor.js";
import { createHistoryCacheKey, findHistoryCacheHit } from "./historyCache.js";
import { enhanceSolidGeometryCommands } from "../shared/solidGeometryEnhancer.js";
import "./styles.css";

const HISTORY_KEY = "ggb-ai-history-v1";
const API_SETTINGS_STORAGE_KEY = "ggb-ai-provider-settings-v1";

const defaultApiSettings = {
  apiKey: "",
  baseUrl: "",
  model: ""
};

const providerPresets = [
  {
    id: "openai",
    name: "OpenAI 官方",
    baseUrl: "",
    model: "",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    note: "Base URL 留空；模型名可留空使用后端默认。"
  },
  {
    id: "aliyun",
    name: "阿里云百炼",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3-vl-plus",
    apiKeyUrl: "https://bailian.console.aliyun.com/",
    note: "默认使用支持图片理解的视觉模型 qwen3-vl-plus。"
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    note: "适合文字题；图片题需要换成支持视觉的供应商/模型。"
  },
  {
    id: "volcengine",
    name: "火山方舟",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-1-6-250615",
    apiKeyUrl: "https://console.volcengine.com/ark/",
    note: "模型名通常是方舟控制台里的模型或推理接入点名称。"
  },
  {
    id: "tencent",
    name: "腾讯混元",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    model: "hunyuan-turbos-latest",
    apiKeyUrl: "https://console.cloud.tencent.com/hunyuan",
    note: "使用腾讯混元 OpenAI 兼容接口。"
  },
  {
    id: "baidu",
    name: "百度千帆",
    baseUrl: "https://qianfan.baidubce.com/v2",
    model: "ernie-4.0-turbo-8k",
    apiKeyUrl: "https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application",
    note: "使用千帆 OpenAI 兼容接口。"
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-plus",
    apiKeyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    note: "如账号没有该模型权限，请换成控制台可用模型。"
  },
  {
    id: "moonshot",
    name: "月之暗面",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
    apiKeyUrl: "https://platform.moonshot.cn/console/api-keys",
    note: "适合文字题；视觉能力取决于所选模型。"
  },
  {
    id: "minimax",
    name: "MiniMax",
    baseUrl: "https://api.minimax.chat/v1",
    model: "MiniMax-Text-01",
    apiKeyUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    note: "使用 MiniMax OpenAI 兼容接口。"
  },
  {
    id: "siliconflow",
    name: "硅基流动",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "Qwen/Qwen2.5-7B-Instruct",
    apiKeyUrl: "https://cloud.siliconflow.cn/account/ak",
    note: "模型名需与硅基流动模型列表完全一致。"
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
    apiKeyUrl: "https://aistudio.google.com/apikey",
    note: "使用 Gemini 的 OpenAI 兼容入口。"
  }
];

const examples = [
  "绘制等腰三角形 ABC，其中 AB = AC，并画出顶角的角平分线。",
  "绘制函数 y = x^2 - 3x + 2，并标出它与 x 轴的交点。",
  "已知圆心 O 和圆上一点 A，绘制点 A 处的切线。",
  "用二维斜投影绘制正方体 ABCD-A'B'C'D'，标出体对角线 AC' 和底面对角线 AC。"
];

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeHistory(items) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 8)));
}

function readApiSettings() {
  try {
    return { ...defaultApiSettings, ...JSON.parse(localStorage.getItem(API_SETTINGS_STORAGE_KEY) || "{}") };
  } catch {
    return defaultApiSettings;
  }
}

function maskApiKey(apiKey) {
  if (!apiKey) return "未设置";
  if (apiKey.length <= 12) return "已设置";
  return `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`;
}

function formatMathType(mathType) {
  const labels = {
    geometry: "平面几何",
    function: "函数图像",
    analytic_geometry: "解析几何",
    solid_geometry: "立体几何"
  };
  return labels[mathType] || "数学绘图";
}

function GeoGebraCanvas({ result, renderRequest }) {
  const containerRef = useRef(null);
  const shellRef = useRef(null);
  const appletRef = useRef(null);
  const [status, setStatus] = useState("正在加载 GeoGebra...");
  const [commandResults, setCommandResults] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState("2d");
  const [appletReadyVersion, setAppletReadyVersion] = useState(0);

  function resizeApplet() {
    const container = containerRef.current;
    const api = appletRef.current;
    const shell = shellRef.current;
    if (!container || !shell || !api) return;

    const shellStyle = window.getComputedStyle(shell);
    const width = shell.clientWidth - parseFloat(shellStyle.paddingLeft) - parseFloat(shellStyle.paddingRight);
    const height = shell.clientHeight - parseFloat(shellStyle.paddingTop) - parseFloat(shellStyle.paddingBottom);
    if (width < 1 || height < 1) return;

    try {
      const nextWidth = Math.floor(width);
      const nextHeight = Math.floor(height);
      api.setSize(nextWidth, nextHeight);
      api.refreshViews();
    } catch {
      // The applet can briefly reject resize calls during its own initialization.
    }
  }

  useEffect(() => {
    let cancelled = false;

    function injectApplet() {
      if (cancelled || !containerRef.current || appletRef.current) return;
      if (!window.GGBApplet) {
        setStatus("GeoGebra 脚本仍在加载...");
        return;
      }

      const bounds = shellRef.current.getBoundingClientRect();
      const params = {
        id: "ggbApplet",
        appName: viewMode === "3d" ? "3d" : "classic",
        width: Math.max(1, Math.floor(bounds.width)),
        height: Math.max(1, Math.floor(bounds.height)),
        showToolBar: true,
        showAlgebraInput: true,
        showMenuBar: false,
        showZoomButtons: true,
        enableLabelDrags: true,
        enableShiftDragZoom: true,
        useBrowserForJS: false,
        appletOnLoad: (api) => {
          appletRef.current = api;
          setStatus("已就绪");
          setAppletReadyVersion((version) => version + 1);
          try {
            resizeApplet();
            api.setAxesVisible(true, true);
            api.setCoordSystem(-8, 8, -6, 6);
          } catch {
            // GeoGebra can report ready before every view API is available.
          }
        }
      };

      const applet = new window.GGBApplet(params, true);
      applet.inject("ggb-canvas");
    }

    injectApplet();
    const timer = window.setInterval(injectApplet, 500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      appletRef.current = null;
      if (containerRef.current) containerRef.current.replaceChildren();
    };
  }, [viewMode]);

  useEffect(() => {
    const handleWindowResize = () => resizeApplet();
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  useEffect(() => {
    if (!renderRequest || !result || !appletRef.current) return;

    const api = appletRef.current;
    const nextCommandResults = [];
    let objectNames = [];
    let repaintingPaused = false;

    try {
      api.setRepaintingActive(false);
      repaintingPaused = true;
      api.setErrorDialogsActive(false);
      api.newConstruction();

      if (viewMode !== "3d") api.setPerspective?.("G");

      if (viewMode === "3d") {
        try {
          api.setCoordSystem(...get3DCoordinateSystem(result.viewport));
        } catch {
          // Continue with GeoGebra's default 3D view when a build does not expose the 3D overload.
        }
        try {
          api.setAxesVisible?.(3, true, true, true);
          api.setGridVisible?.(3, true);
        } catch {
          // Axis and grid styling must not prevent the construction from rendering.
        }
      } else {
        api.setCoordSystem(
          result.viewport.xmin,
          result.viewport.xmax,
          result.viewport.ymin,
          result.viewport.ymax
        );
      }

      const commandsToRender = enhanceSolidGeometryCommands({
        mathType: result.mathType,
        commands: result.ggbCommands
      });
      for (const command of commandsToRender) {
        nextCommandResults.push(executeGgbCommand(api, command));
      }

      objectNames = typeof api.getAllObjectNames === "function" ? api.getAllObjectNames() : [];
      for (const objectName of objectNames) {
        api.setVisible?.(objectName, true);
      }
      setCommandResults(nextCommandResults);
      setStatus(objectNames.length || nextCommandResults.some((item) => item.ok) ? "已绘制" : "未生成可见对象");
    } catch (error) {
      setStatus(error.message || "GeoGebra 绘制失败");
      setCommandResults(nextCommandResults);
    } finally {
      try {
        if (repaintingPaused) api.setRepaintingActive(true);
        api.refreshViews();
      } catch {
        // Do not overwrite a more specific drawing status when the final refresh is unavailable.
      }
    }
  }, [renderRequest, result, viewMode, appletReadyVersion]);

  useEffect(() => {
    const resizeTimer = window.setTimeout(resizeApplet, 50);
    if (!isFullscreen) {
      return () => window.clearTimeout(resizeTimer);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setIsFullscreen(false);
    }

    document.body.classList.add("canvas-fullscreen-active");
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(resizeTimer);
      document.body.classList.remove("canvas-fullscreen-active");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  function resetCanvas() {
    if (!appletRef.current) return;
    appletRef.current.newConstruction();
    appletRef.current.setCoordSystem(-8, 8, -6, 6);
    setCommandResults([]);
    setStatus("已就绪");
  }

  function changeZoom(direction) {
    if (!appletRef.current) return;

    try {
      appletRef.current.evalCommand(direction === "in" ? "ZoomIn(1.2)" : "ZoomOut(1.2)");
      appletRef.current.refreshViews();
    } catch {
      setStatus("缩放操作暂不可用");
    }
  }

  return (
    <section className={`panel canvas-panel${isFullscreen ? " canvas-panel-fullscreen" : ""}`}>
      <div className="panel-header">
        <div>
          <h2>GeoGebra 画布</h2>
          <p>{status}</p>
        </div>
        <div className="canvas-actions">
          <div className="view-mode-switch" role="group" aria-label="GeoGebra 视图模式">
            <button
              className={viewMode === "2d" ? "is-selected" : ""}
              type="button"
              onClick={() => setViewMode("2d")}
              aria-pressed={viewMode === "2d"}
            >
              2D
            </button>
            <button
              className={viewMode === "3d" ? "is-selected" : ""}
              type="button"
              onClick={() => setViewMode("3d")}
              aria-pressed={viewMode === "3d"}
            >
              3D
            </button>
          </div>
          <button className="icon-button canvas-zoom-control" type="button" onClick={() => changeZoom("in")} title="放大画布">
            <ZoomIn size={17} />
          </button>
          <button className="icon-button canvas-zoom-control" type="button" onClick={() => changeZoom("out")} title="缩小画布">
            <ZoomOut size={17} />
          </button>
          <button
            className="icon-button canvas-fullscreen-control"
            type="button"
            onClick={() => setIsFullscreen((value) => !value)}
            title={isFullscreen ? "退出全屏调试" : "全屏调试画布"}
          >
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
          <button className="icon-button canvas-reset-control" type="button" onClick={resetCanvas} title="重置画布">
            <RefreshCw size={17} />
          </button>
        </div>
      </div>
      <div className="ggb-shell" ref={shellRef}>
        <div id="ggb-canvas" ref={containerRef} />
      </div>
      <div className="render-log">
        <span>{commandResults.length ? "绘制日志" : "绘制后可以直接在 GeoGebra 中拖动点和图形。"}</span>
        {commandResults.slice(-5).map((entry) => (
          <span className={entry.ok ? "log-ok" : "log-fail"} key={entry.command}>
            {entry.ok ? "成功" : "失败"}: {entry.command}
          </span>
        ))}
      </div>
    </section>
  );
}

function ApiKeySettings() {
  const [settings, setSettings] = useState(() => readApiSettings());
  const [isOpen, setIsOpen] = useState(false);
  const [draftSettings, setDraftSettings] = useState(settings);

  function persistSettings(nextSettings) {
    if (nextSettings.apiKey || nextSettings.baseUrl || nextSettings.model) {
      localStorage.setItem(API_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
    } else {
      localStorage.removeItem(API_SETTINGS_STORAGE_KEY);
    }
  }

  function saveSettings() {
    const nextSettings = {
      apiKey: draftSettings.apiKey.trim(),
      baseUrl: draftSettings.baseUrl.trim(),
      model: draftSettings.model.trim()
    };
    persistSettings(nextSettings);
    setSettings(nextSettings);
    setIsOpen(false);
  }

  function updateDraft(field, value) {
    setDraftSettings((current) => ({ ...current, [field]: value }));
  }

  function applyProviderPreset(provider) {
    setDraftSettings((current) => ({
      ...current,
      baseUrl: provider.baseUrl,
      model: provider.model
    }));
  }

  return (
    <div className="api-key-entry">
      <button
        className={`api-key-status-button${settings.apiKey ? " is-configured" : " is-missing"}`}
        type="button"
        onClick={() => {
          setDraftSettings(settings);
          setIsOpen(true);
        }}
      >
        <KeyRound size={15} />
        {settings.apiKey ? "已设置 API KEY" : "请设置 API KEY"}
      </button>

      {isOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <section
            className="api-settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="api-settings-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 id="api-settings-title">选择 API 平台</h2>
                <p>选择后会自动填写兼容地址和默认模型。</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setIsOpen(false)} title="关闭设置">
                <X size={17} />
              </button>
            </div>
            <label className="api-key-input-label" htmlFor="api-key-input">
              API Key
              <input
                id="api-key-input"
                value={draftSettings.apiKey}
                onChange={(event) => updateDraft("apiKey", event.target.value)}
                placeholder="粘贴所选平台的 API Key"
                type="password"
                autoComplete="off"
                spellCheck="false"
              />
            </label>
            <div className="provider-preset-list" aria-label="供应商预设">
              {providerPresets.map((provider) => (
                <article
                  key={provider.id}
                  className={`provider-preset${draftSettings.baseUrl === provider.baseUrl ? " provider-preset-selected" : ""}`}
                >
                  <div>
                    <strong>{provider.name}</strong>
                    <small>{provider.model || "后端默认模型"}</small>
                  </div>
                  <p>{provider.note}</p>
                  <div className="provider-actions">
                    <button type="button" onClick={() => applyProviderPreset(provider)}>选择</button>
                    <a href={provider.apiKeyUrl} target="_blank" rel="noreferrer">
                      申请 Key <ExternalLink size={13} />
                    </a>
                  </div>
                </article>
              ))}
            </div>
            <details className="advanced-settings">
              <summary>高级配置：Base URL 与模型名</summary>
              <label htmlFor="base-url-input">Base URL</label>
              <input
                id="base-url-input"
                value={draftSettings.baseUrl}
                onChange={(event) => updateDraft("baseUrl", event.target.value)}
                placeholder="默认由平台预设填写"
                type="url"
                autoComplete="off"
                spellCheck="false"
              />
              <label htmlFor="model-input">模型名</label>
              <input
                id="model-input"
                value={draftSettings.model}
                onChange={(event) => updateDraft("model", event.target.value)}
                placeholder="默认由平台预设填写"
                type="text"
                autoComplete="off"
                spellCheck="false"
              />
            </details>
            <p className="modal-note">图片题需要选择支持视觉输入的模型。非 OpenAI 官方 Key 必须配套其平台的地址和模型，避免返回 401。</p>
            <div className="api-key-actions">
              <button className="secondary-button" type="button" onClick={() => setDraftSettings(defaultApiSettings)}>
                清空
              </button>
              <button className="primary-button compact" type="button" onClick={saveSettings}>
                保存
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

async function createImageFingerprint(file) {
  if (!file) return "";

  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function InputPanel({ onSolved, onReuseHistory, history, activeText, setActiveText }) {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function handleImage(file) {
    setError("");
    setNotice("");
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("仅支持 PNG、JPEG 和 WebP 图片。");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("图片大小不能超过 8 MB。");
      return;
    }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function handleTextPaste(event) {
    const imageItem = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith("image/"));
    const pastedImage = imageItem?.getAsFile();

    if (!pastedImage) return;

    event.preventDefault();
    handleImage(pastedImage);
  }

  function clearImage() {
    setImage(null);
    setImagePreview("");
  }

  function getVisionModelError() {
    if (!image) return "";

    const model = readApiSettings().model.trim().toLowerCase();
    const textOnlyModels = new Set([
      "qwen-plus",
      "deepseek-chat",
      "deepseek-reasoner",
      "moonshot-v1-8k",
      "minimax-text-01",
      "qwen/qwen2.5-7b-instruct",
      "glm-4-plus"
    ]);

    return textOnlyModels.has(model)
      ? `当前模型“${model}”不支持图片理解。请在 API 设置中换用视觉模型后重试。`
      : "";
  }

  async function submitProblem(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!activeText.trim() && !image) {
      setError("请输入题目文字或上传题目图片。");
      return;
    }

    const visionModelError = getVisionModelError();
    if (visionModelError) {
      setError(visionModelError);
      return;
    }

    setIsSubmitting(true);
    try {
      const imageFingerprint = await createImageFingerprint(image);
      const cacheKey = createHistoryCacheKey({ text: activeText, imageFingerprint });
      const cachedItem = findHistoryCacheHit(history, cacheKey, { text: activeText, hasImage: Boolean(image) });
      if (cachedItem) {
        onReuseHistory(cachedItem);
        setNotice("已读取本地历史解析结果，未重复调用模型。");
        return;
      }

      const form = new FormData();
      form.append("text", activeText);
      if (image) form.append("image", image);
      const apiSettings = readApiSettings();
      const headers = {};
      if (apiSettings.apiKey) headers["X-OpenAI-API-Key"] = apiSettings.apiKey;
      if (apiSettings.baseUrl) headers["X-OpenAI-Base-URL"] = apiSettings.baseUrl;
      if (apiSettings.model) headers["X-OpenAI-Model"] = apiSettings.model;
      const response = await fetch("/api/solve", { method: "POST", body: form, headers });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "解析请求失败。");
      }
      onSolved(payload, {
        promptText: activeText,
        imageName: image?.name || null,
        imagePreview,
        imageFingerprint,
        cacheKey
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel input-panel">
      <div className="brand-row">
        <div className="brand-identity">
          <div className="brand-mark">
            <PencilRuler size={20} />
          </div>
          <div>
            <h1>GeoGebra <span>AI</span></h1>
            <p>数学绘图工作台</p>
          </div>
        </div>
        <ApiKeySettings />
      </div>

      <form className="problem-form" onSubmit={submitProblem}>
        <label htmlFor="problem-text">题目</label>
        <textarea
          id="problem-text"
          value={activeText}
          onChange={(event) => setActiveText(event.target.value)}
          onPaste={handleTextPaste}
          placeholder="输入文字，或直接粘贴题目图片..."
        />
        <p className="paste-hint">支持直接粘贴 PNG、JPEG 或 WebP 题目图片</p>

        <div className="example-list">
          {examples.slice(0, 2).map((example) => (
            <button className="example-chip" key={example} type="button" onClick={() => setActiveText(example)}>
              {example}
            </button>
          ))}
        </div>

        <label className="upload-zone">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => handleImage(event.target.files?.[0])}
          />
          <Upload size={18} />
          <span>{image ? image.name : "上传题目图片"}</span>
        </label>

        {imagePreview ? (
          <div className="image-preview">
            <img src={imagePreview} alt="已上传题目预览" />
            <button
              type="button"
              className="icon-button preview-remove"
              onClick={clearImage}
              title="移除图片"
            >
              <X size={16} />
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="error-box">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        {notice ? <div className="success-box"><CheckCircle2 size={16} /><span>{notice}</span></div> : null}

        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="spin" size={18} /> : <ChevronRight size={18} />}
          {isSubmitting ? "正在理解题目" : "解析题目"}
        </button>
      </form>
    </section>
  );
}

function PreviewPanel({ result, history, onRender, onSelectHistory, onOpenCommands, onOpenHistory }) {
  const commandCount = result?.ggbCommands?.length || 0;

  return (
    <section className="panel preview-panel">
      <div className="panel-header">
        <div>
          <h2>AI 绘图方案</h2>
          <p>{result ? `${commandCount} 条安全命令已就绪` : "提交题目后生成绘图方案"}</p>
        </div>
        <Braces size={20} />
      </div>

      {result ? (
        <div className="plan-stack">
          <div className="summary-card">
            <span className="type-badge">{formatMathType(result.mathType)}</span>
            <h3>{result.problemSummary || "未返回题目摘要"}</h3>
            {result.followupQuestion ? <p className="followup">{result.followupQuestion}</p> : null}
          </div>

          <div className="steps-block">
            <h3>构造步骤</h3>
            <ol>
              {result.constructionSteps.slice(0, 3).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>

          {result.warnings.length ? (
            <div className="warning-box">
              <AlertTriangle size={16} />
              <div>
                {result.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="command-block">
            <div className="block-heading">
              <h3>GeoGebra 命令</h3>
              <span>{commandCount}</span>
            </div>
            <button className="command-preview-button" type="button" onClick={onOpenCommands}>
              查看命令
            </button>
          </div>

          {result.rejectedCommands?.length ? (
            <div className="rejected-block">
              <h3>已拦截的命令</h3>
              {result.rejectedCommands.map((entry, index) => (
                <p key={`${entry.command}-${index}`}>
                  {entry.command || "命令"}：{entry.reason}
                </p>
              ))}
            </div>
          ) : null}

          <button className="primary-button render-button" type="button" onClick={onRender} disabled={!commandCount}>
            <Play size={18} />
            绘制到 GeoGebra
          </button>
        </div>
      ) : (
        <div className="empty-state">
          <FileImage size={30} />
          <p>AI 会先理解题目、选择视野范围，并准备可编辑的 GeoGebra 命令；确认后才会绘制。</p>
        </div>
      )}

      <div className="history-block">
        <div className="block-heading">
          <h3>最近记录</h3>
          <button className="quiet-icon-button" type="button" onClick={onOpenHistory} title="查看全部记录">
            <History size={16} />
          </button>
        </div>
        {history.length ? (
          history.slice(0, 2).map((item) => (
            <button className="history-item" key={item.id} type="button" onClick={() => onSelectHistory(item)}>
              <CheckCircle2 size={15} />
              <span>{item.result.problemSummary || item.promptText || "已保存绘图"}</span>
            </button>
          ))
        ) : (
          <p className="muted">首次解析后，本地历史会显示在这里。</p>
        )}
      </div>
    </section>
  );
}

function DialogFrame({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="workspace-dialog" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} title="关闭">
            <X size={17} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function CommandDialog({ result, onClose }) {
  if (!result) return null;

  return (
    <DialogFrame title="GeoGebra 命令" onClose={onClose}>
      <pre className="dialog-code">{result.ggbCommands.join("\n")}</pre>
    </DialogFrame>
  );
}

function HistoryDialog({ history, onSelect, onClose }) {
  return (
    <DialogFrame title="全部记录" onClose={onClose}>
      <div className="dialog-history-list">
        {history.length ? history.map((item) => (
          <button
            className="history-item"
            key={item.id}
            type="button"
            onClick={() => {
              onSelect(item);
              onClose();
            }}
          >
            <CheckCircle2 size={15} />
            <span>{item.result.problemSummary || item.promptText || "已保存绘图"}</span>
          </button>
        )) : <p className="muted">暂无历史记录。</p>}
      </div>
    </DialogFrame>
  );
}

function App() {
  const [activeText, setActiveText] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(() => readHistory());
  const [renderRequest, setRenderRequest] = useState(0);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  const latestResult = useMemo(() => result, [result]);

  function handleSolved(nextResult, metadata) {
    setResult(nextResult);
    const historyItem = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...metadata,
      result: nextResult
    };
    const nextHistory = [historyItem, ...history].slice(0, 8);
    setHistory(nextHistory);
    writeHistory(nextHistory);
  }

  function selectHistory(item) {
    setActiveText(item.promptText || "");
    setResult(item.result);
  }

  return (
    <main className="app-shell">
      <InputPanel
        activeText={activeText}
        setActiveText={setActiveText}
        history={history}
        onSolved={handleSolved}
        onReuseHistory={selectHistory}
      />
      <PreviewPanel
        result={latestResult}
        history={history}
        onRender={() => setRenderRequest((value) => value + 1)}
        onSelectHistory={selectHistory}
        onOpenCommands={() => setIsCommandOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />
      <GeoGebraCanvas result={latestResult} renderRequest={renderRequest} />
      {isCommandOpen ? <CommandDialog result={latestResult} onClose={() => setIsCommandOpen(false)} /> : null}
      {isHistoryOpen ? <HistoryDialog history={history} onSelect={selectHistory} onClose={() => setIsHistoryOpen(false)} /> : null}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
