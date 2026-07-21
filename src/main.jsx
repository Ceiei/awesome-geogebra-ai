import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
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
  Video,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { executeGgbCommand, get3DCoordinateSystem, getExplicitlyHiddenObjectLabels } from "./ggbExecutor.js";
import {
  createDemoVideoBlob,
  createDemoVideoFilename,
  getDemoRecordingChecklist,
  getDemoRecordingErrorMessage,
  getGgbPngDataUrl,
  getSupportedDemoVideoMimeType
} from "./demoVideoExport.js";
import { getDynamicDemoState } from "./dynamicDemoState.js";
import {
  createDynamicDemoPlan,
  getInitialDynamicControlValue,
  getSweepValue
} from "./dynamicDemoTimeline.js";
import { downloadGgbConstruction, downloadGgbWebPage } from "./ggbDownload.js";
import { getRenderLogState } from "./renderLogState.js";
import { createHistoryCacheKey, findHistoryCacheHit, readHistoryItems } from "./historyCache.js";
import { mergeDynamicControls } from "../shared/dynamicControls.js";
import { enhanceSolidGeometryCommands } from "../shared/solidGeometryEnhancer.js";
import {
  AREA_FILLING,
  enhanceTeachingDiagramCommands,
  getHighlightedAreaPolygonLabels
} from "../shared/teachingDiagramEnhancer.js";
import "./styles.css";

const HISTORY_KEY = "ggb-ai-history-v4";
const LEGACY_HISTORY_KEYS = ["ggb-ai-history-v3", "ggb-ai-history-v2", "ggb-ai-history-v1"];
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
  "设点 P 在抛物线 y=x^2/2 上运动，观察三角形 ABP 的面积变化。",
  "点 P 在抛物线 y=x^2/2 上运动，取 AP 中点 M，观察 M 的轨迹。"
];

function readHistory() {
  return readHistoryItems(localStorage, {
    primaryKey: HISTORY_KEY,
    legacyKeys: LEGACY_HISTORY_KEYS,
    limit: 8
  });
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

function getFreePointLabels(commands) {
  return Array.from(new Set(
    commands
      .map((command) => String(command).match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*\(\s*[^,]+\s*,/))
      .filter(Boolean)
      .map((match) => match[1])
  ));
}

function formatControlValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "");
  return Number(number.toFixed(4)).toString();
}

function formatDynamicControlLabel(control) {
  const description = String(control.description || "");
  const movingPoint = description.match(/动点\s*([A-Za-z][A-Za-z0-9_]*)/);
  if (movingPoint) return `动点${movingPoint[1]}`;
  if (/斜率|slope/i.test(description)) return "斜率";
  if (/截距|intercept/i.test(description)) return "截距";
  if (/角|旋转|angle/i.test(description)) return "角度";
  return description || control.name;
}

function sleep(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("演示帧加载失败"));
    image.src = dataUrl;
  });
}

async function drawGgbFrameToCanvas(api, canvas) {
  const image = await loadImageFromDataUrl(await getGgbPngDataUrl(api));
  const width = Math.max(1, image.naturalWidth || image.width);
  const height = Math.max(1, image.naturalHeight || image.height);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
}

function applyDynamicVisualFixes(api, { areaLabels = [], dynamicControls = [] }) {
  for (const control of dynamicControls) {
    try {
      api.setVisible?.(control.name, false);
    } catch {
      // GeoGebra may reject visibility changes while a slider is still being created.
    }
  }

  for (const label of areaLabels) {
    try {
      api.setVisible?.(label, true);
      api.setLayer?.(label, 0);
      api.setFilling?.(label, AREA_FILLING);
      api.setColor?.(label, 96, 165, 250);
      api.setLineThickness?.(label, 3);
    } catch {
      // The command list already contains the same styling; this only reinforces it after repaint.
    }
  }
}

function getRenderSignature(result, viewMode) {
  if (!result) return "";
  return JSON.stringify({
    viewMode,
    mathType: result.mathType,
    commands: result.ggbCommands || [],
    dynamicControls: result.dynamicControls || [],
    viewport: result.viewport || null
  });
}

function GeoGebraCanvas({ result, renderRequest }) {
  const containerRef = useRef(null);
  const shellRef = useRef(null);
  const appletRef = useRef(null);
  const demoRunRef = useRef(0);
  const [status, setStatus] = useState("正在加载 GeoGebra...");
  const [commandResults, setCommandResults] = useState([]);
  const [isRenderLogExpanded, setIsRenderLogExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState("2d");
  const [appletReadyVersion, setAppletReadyVersion] = useState(0);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [dynamicValues, setDynamicValues] = useState({});
  const [isRecordingDemo, setIsRecordingDemo] = useState(false);
  const [isRecordGuideOpen, setIsRecordGuideOpen] = useState(false);
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);
  const [lastRenderedSignature, setLastRenderedSignature] = useState("");
  const [demoFocusControl, setDemoFocusControl] = useState(null);
  const currentRenderSignature = getRenderSignature(result, viewMode);
  const supportsFrameVideoExport = Boolean(
    appletRef.current?.getPNGBase64
    && typeof HTMLCanvasElement !== "undefined"
    && HTMLCanvasElement.prototype.captureStream
    && typeof MediaRecorder !== "undefined"
  );
  const supportsScreenRecording = Boolean(navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== "undefined");
  const supportsDemoRecording = supportsFrameVideoExport || supportsScreenRecording;
  const demoState = getDynamicDemoState({
    supportsRecording: supportsDemoRecording,
    directExport: supportsFrameVideoExport,
    hasRenderedCurrent: Boolean(commandResults.length && lastRenderedSignature === currentRenderSignature),
    isPlaying: isPlayingDemo,
    isRecording: isRecordingDemo
  });
  const canPlayDemo = demoState.canPlay;
  const demoFocusLabel = demoFocusControl ? formatDynamicControlLabel(demoFocusControl) : "";
  const demoFocusValue = demoFocusControl
    ? dynamicValues[demoFocusControl.name] ?? getInitialDynamicControlValue(demoFocusControl)
    : undefined;
  const renderLogState = getRenderLogState(commandResults);
  const shouldShowRenderLogDetails = isRenderLogExpanded || renderLogState.defaultExpanded;
  const renderLogEntries = renderLogState.defaultExpanded ? renderLogState.visibleEntries : commandResults.slice(-8);

  useEffect(() => {
    demoRunRef.current += 1;
    setIsPlayingDemo(false);
    setIsRecordingDemo(false);
    setIsRecordGuideOpen(false);
    setDemoFocusControl(null);
    const nextValues = {};
    for (const control of result?.dynamicControls || []) {
      nextValues[control.name] = getInitialDynamicControlValue(control);
    }
    setDynamicValues(nextValues);
  }, [result, viewMode]);

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
    demoRunRef.current += 1;
    setIsPlayingDemo(false);
    setIsRecordingDemo(false);
    setIsRecordGuideOpen(false);
    setDemoFocusControl(null);

    const api = appletRef.current;
    const nextCommandResults = [];
    let objectNames = [];
    let repaintingPaused = false;
    let areaHighlightLabels = [];
    const dynamicControls = result.dynamicControls || [];

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

      const commandsToRender = enhanceTeachingDiagramCommands({
        mathType: result.mathType,
        commands: enhanceSolidGeometryCommands({
          mathType: result.mathType,
          commands: result.ggbCommands
        })
      });
      const hiddenObjectLabels = getExplicitlyHiddenObjectLabels(commandsToRender);
      areaHighlightLabels = getHighlightedAreaPolygonLabels({ mathType: result.mathType, commands: commandsToRender });
      for (const command of commandsToRender) {
        nextCommandResults.push(executeGgbCommand(api, command));
      }

      objectNames = typeof api.getAllObjectNames === "function" ? api.getAllObjectNames() : [];
      for (const objectName of objectNames) {
        if (hiddenObjectLabels.has(objectName)) continue;
        api.setVisible?.(objectName, true);
      }
      applyDynamicVisualFixes(api, { areaLabels: areaHighlightLabels, dynamicControls });
      for (const pointLabel of getFreePointLabels(commandsToRender)) {
        try {
          api.setFixed?.(pointLabel, false, true);
        } catch {
          // Some GeoGebra builds reject fixed-state changes for dependent objects.
        }
      }
      api.setMode?.(0);
      for (const control of dynamicControls) {
        const value = getInitialDynamicControlValue(control);
        try {
          api.setValue?.(control.name, value);
        } catch {
          // Keep the construction usable even if a generated slider name is missing.
        }
      }
      const hasRenderedObject = Boolean(objectNames.length || nextCommandResults.some((item) => item.ok));
      setCommandResults(nextCommandResults);
      setIsRenderLogExpanded(false);
      setLastRenderedSignature(hasRenderedObject ? currentRenderSignature : "");
      setStatus(hasRenderedObject ? "已绘制" : "未生成可见对象");
    } catch (error) {
      setStatus(error.message || "GeoGebra 绘制失败");
      setCommandResults(nextCommandResults);
      setIsRenderLogExpanded(false);
      setLastRenderedSignature("");
    } finally {
      try {
        if (repaintingPaused) api.setRepaintingActive(true);
        applyDynamicVisualFixes(api, { areaLabels: areaHighlightLabels, dynamicControls });
        api.refreshViews();
        window.setTimeout(() => {
          applyDynamicVisualFixes(api, { areaLabels: areaHighlightLabels, dynamicControls });
          api.refreshViews?.();
        }, 120);
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
    demoRunRef.current += 1;
    setIsPlayingDemo(false);
    setIsRecordingDemo(false);
    setIsRecordGuideOpen(false);
    setDemoFocusControl(null);
    appletRef.current.newConstruction();
    appletRef.current.setCoordSystem(-8, 8, -6, 6);
    setCommandResults([]);
    setIsRenderLogExpanded(false);
    setLastRenderedSignature("");
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

  function updateDynamicControl(control, rawValue) {
    const value = Number(rawValue);
    setDynamicValues((current) => ({ ...current, [control.name]: value }));

    try {
      appletRef.current?.setValue?.(control.name, value);
      appletRef.current?.refreshViews?.();
      setStatus(`已更新参数 ${control.name}=${value}`);
    } catch {
      setStatus(`参数 ${control.name} 暂不可用，请先绘制图像`);
    }
  }

  function resetDynamicControls() {
    const controls = result?.dynamicControls || [];
    if (!controls.length) return;

    const nextValues = {};
    for (const control of controls) {
      const value = getInitialDynamicControlValue(control);
      nextValues[control.name] = value;
      try {
        appletRef.current?.setValue?.(control.name, value);
      } catch {
        // A missing generated slider should not block resetting the rest.
      }
    }
    setDynamicValues(nextValues);
    appletRef.current?.refreshViews?.();
    setStatus("动态演示已复位");
  }

  function setDynamicControlValues(values) {
    const api = appletRef.current;

    setDynamicValues((current) => ({ ...current, ...values }));
    for (const [name, value] of Object.entries(values)) {
      try {
        api?.setValue?.(name, value);
      } catch {
        // Continue updating other generated controls when one slider is missing.
      }
    }
    api?.refreshViews?.();
  }

  function createDemoRunToken() {
    demoRunRef.current += 1;
    return demoRunRef.current;
  }

  function isDemoRunCurrent(token) {
    return demoRunRef.current === token;
  }

  async function sweepDynamicControl(control, durationMs, token) {
    const start = performance.now();

    return new Promise((resolve) => {
      function frame(now) {
        if (!isDemoRunCurrent(token)) {
          resolve(false);
          return;
        }

        const progress = Math.min(1, (now - start) / durationMs);
        const value = getSweepValue(control, progress);
        if (value !== null) setDynamicControlValues({ [control.name]: value });

        if (progress < 1) {
          window.requestAnimationFrame(frame);
        } else {
          resolve(true);
        }
      }

      window.requestAnimationFrame(frame);
    });
  }

  async function playDynamicDemoSequence(controls, token) {
    const plan = createDynamicDemoPlan(controls);
    const { defaults } = plan;
    setDynamicControlValues(defaults);
    await sleep(300);
    if (!isDemoRunCurrent(token)) return false;

    for (const { control, durationMs } of plan.steps) {
      const label = formatDynamicControlLabel(control);
      if (!isDemoRunCurrent(token)) return false;
      setDynamicControlValues(defaults);
      setDemoFocusControl(control);
      setStatus(`正在演示：${label}`);
      await sleep(250);
      if (!isDemoRunCurrent(token)) return false;
      const didFinishSweep = await sweepDynamicControl(control, durationMs, token);
      if (!didFinishSweep) return false;
      await sleep(250);
    }

    if (!isDemoRunCurrent(token)) return false;
    setDemoFocusControl(null);
    setDynamicControlValues(defaults);
    return true;
  }

  async function previewDynamicDemo() {
    const controls = result?.dynamicControls || [];
    if (!controls.length || isPlayingDemo || isRecordingDemo) return;
    if (!appletRef.current) {
      setStatus("请先等待 GeoGebra 画布加载完成");
      return;
    }
    if (!canPlayDemo) {
      setStatus("当前方案尚未绘制，请先点击“绘制到 GeoGebra”");
      return;
    }

    const token = createDemoRunToken();
    try {
      setIsPlayingDemo(true);
      setStatus("正在播放动态演示...");
      const didFinish = await playDynamicDemoSequence(controls, token);
      setStatus(didFinish ? "动态演示播放完成" : "动态演示已取消");
    } catch {
      setStatus("播放动态演示失败");
    } finally {
      if (isDemoRunCurrent(token)) {
        setIsPlayingDemo(false);
        setDemoFocusControl(null);
      }
    }
  }

  async function exportDynamicDemoFromFrames() {
    const controls = result?.dynamicControls || [];
    const api = appletRef.current;
    if (!controls.length || isPlayingDemo || isRecordingDemo || !api?.getPNGBase64) return false;
    if (!canPlayDemo) {
      setStatus("当前方案尚未绘制，请先点击“绘制到 GeoGebra”");
      return true;
    }
    if (typeof HTMLCanvasElement === "undefined" || !HTMLCanvasElement.prototype.captureStream || typeof MediaRecorder === "undefined") {
      return false;
    }

    const wasFullscreen = isFullscreen;
    const token = createDemoRunToken();
    const canvas = document.createElement("canvas");
    const chunks = [];
    let stream;
    let recorder;

    try {
      setIsRecordingDemo(true);
      setIsFullscreen(true);
      setStatus("正在生成动态演示视频...");
      await sleep(220);
      resizeApplet();

      const plan = createDynamicDemoPlan(controls);
      setDynamicControlValues(plan.defaults);
      await sleep(180);
      await drawGgbFrameToCanvas(api, canvas);

      stream = canvas.captureStream(20);
      const mimeType = getSupportedDemoVideoMimeType(MediaRecorder);
      recorder = new MediaRecorder(stream, { mimeType });
      const stopped = new Promise((resolve) => {
        recorder.onstop = resolve;
      });
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.start(250);

      for (const { control, durationMs } of plan.steps) {
        if (!isDemoRunCurrent(token)) return true;

        const label = formatDynamicControlLabel(control);
        setDemoFocusControl(control);
        setStatus(`正在生成演示：${label}`);
        const frameCount = Math.max(24, Math.min(72, Math.round(durationMs / 120)));

        for (let frameIndex = 0; frameIndex <= frameCount; frameIndex += 1) {
          if (!isDemoRunCurrent(token)) return true;
          const progress = frameIndex / frameCount;
          const value = getSweepValue(control, progress);
          if (value !== null) setDynamicControlValues({ [control.name]: value });
          await sleep(45);
          await drawGgbFrameToCanvas(api, canvas);
        }
      }

      setDemoFocusControl(null);
      setDynamicControlValues(plan.defaults);
      await sleep(180);
      await drawGgbFrameToCanvas(api, canvas);

      recorder.stop();
      await stopped;
      downloadBlob(createDemoVideoBlob(chunks, recorder.mimeType || getSupportedDemoVideoMimeType(MediaRecorder)), createDemoVideoFilename());
      resetDynamicControls();
      setStatus("已导出演示视频");
      return true;
    } catch (error) {
      setStatus(getDemoRecordingErrorMessage(error));
      return true;
    } finally {
      if (recorder?.state === "recording") recorder.stop();
      stream?.getTracks().forEach((track) => track.stop());
      if (isDemoRunCurrent(token)) {
        setIsRecordingDemo(false);
        setDemoFocusControl(null);
      }
      if (!wasFullscreen) setIsFullscreen(false);
    }
  }

  async function recordDynamicDemo() {
    const controls = result?.dynamicControls || [];
    if (!controls.length || isPlayingDemo || isRecordingDemo) return;
    if (!canPlayDemo) {
      setStatus("当前方案尚未绘制，请先点击“绘制到 GeoGebra”");
      return;
    }
    if (supportsFrameVideoExport && await exportDynamicDemoFromFrames()) return;
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") {
      setStatus("当前浏览器不支持直接录制演示视频");
      return;
    }

    setIsRecordGuideOpen(true);
  }

  async function startDynamicDemoRecording() {
    const controls = result?.dynamicControls || [];
    if (!controls.length || isPlayingDemo) return;
    if (!appletRef.current) {
      setStatus("请先等待 GeoGebra 画布加载完成");
      return;
    }
    if (!canPlayDemo) {
      setStatus("当前方案尚未绘制，请先点击“绘制到 GeoGebra”");
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") {
      setStatus("当前浏览器不支持直接录制演示视频");
      return;
    }

    setIsRecordGuideOpen(false);
    setStatus("请选择当前网页或浏览器标签页进行录制");
    let stream;
    const wasFullscreen = isFullscreen;
    const token = createDemoRunToken();
    try {
      setIsFullscreen(true);
      await sleep(180);
      resizeApplet();
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false
      });

      const chunks = [];
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      const stopped = new Promise((resolve) => {
        recorder.onstop = resolve;
      });

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };

      setIsRecordingDemo(true);
      recorder.start(250);
      setStatus("正在录制动态演示...");
      const didFinish = await playDynamicDemoSequence(controls, token);
      await sleep(350);
      recorder.stop();
      await stopped;
      if (!didFinish || !isDemoRunCurrent(token)) {
        setStatus("演示已取消，未导出视频");
        return;
      }

      downloadBlob(createDemoVideoBlob(chunks, mimeType), createDemoVideoFilename());
      resetDynamicControls();
      setStatus("已导出演示视频");
    } catch (error) {
      setStatus(getDemoRecordingErrorMessage(error));
    } finally {
      if (isDemoRunCurrent(token)) {
        setIsRecordingDemo(false);
        setIsRecordGuideOpen(false);
        setDemoFocusControl(null);
      }
      if (!wasFullscreen) setIsFullscreen(false);
      stream?.getTracks().forEach((track) => track.stop());
    }
  }

  function downloadConstruction(format) {
    try {
      if (format === "web") {
        downloadGgbWebPage(appletRef.current, { appName: viewMode === "3d" ? "3d" : "classic" });
        setStatus("已下载网页版 HTML");
      } else {
        downloadGgbConstruction(appletRef.current);
        setStatus("已下载 .ggb 文件");
      }
      setIsDownloadMenuOpen(false);
    } catch (error) {
      setStatus(error.message || "导出文件失败");
    }
  }

  return (
    <section className={`panel canvas-panel${isFullscreen ? " canvas-panel-fullscreen" : ""}${isRecordingDemo ? " is-recording-demo" : ""}`}>
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
          <div className="download-menu">
            <button
              className="icon-button canvas-download-control"
              type="button"
              onClick={() => setIsDownloadMenuOpen((value) => !value)}
              title="下载 GGB 或网页版"
              aria-expanded={isDownloadMenuOpen}
              aria-haspopup="menu"
            >
              <Download size={17} />
            </button>
            {isDownloadMenuOpen ? (
              <div className="download-menu-popover" role="menu">
                <button type="button" role="menuitem" onClick={() => downloadConstruction("ggb")}>
                  下载 .ggb 文件
                </button>
                <button type="button" role="menuitem" onClick={() => downloadConstruction("web")}>
                  下载网页版 .html
                </button>
              </div>
            ) : null}
          </div>
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
        {(isRecordingDemo || isPlayingDemo) && demoFocusLabel ? (
          <div className="demo-focus-badge">
            演示：{demoFocusLabel}
            {demoFocusControl ? (
              <span>{demoFocusControl.name}={formatControlValue(demoFocusValue)}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      {result?.dynamicControls?.length ? (
        <div className="canvas-dynamic-controls" aria-label="动态演示控制">
          <div className="canvas-dynamic-header">
            <span>动态演示</span>
            <div className="canvas-dynamic-actions">
              <button
                type="button"
                onClick={previewDynamicDemo}
                disabled={demoState.play.disabled}
                title={demoState.play.title}
              >
                {isPlayingDemo ? <Loader2 className="spin" size={13} /> : <Play size={13} />}
                {demoState.play.text}
              </button>
              <button
                type="button"
                onClick={recordDynamicDemo}
                disabled={demoState.record.disabled}
                title={demoState.record.title}
              >
                {isRecordingDemo ? <Loader2 className="spin" size={13} /> : <Video size={13} />}
                {demoState.record.text}
              </button>
              <button type="button" onClick={resetDynamicControls} disabled={demoState.reset.disabled}>
                <RefreshCw size={13} />
                复位
              </button>
            </div>
          </div>
          {result.dynamicControls.map((control) => {
            const value = dynamicValues[control.name] ?? getInitialDynamicControlValue(control);
            const label = formatDynamicControlLabel(control);
            return (
              <label className="canvas-dynamic-control" key={`${control.name}-${control.min}-${control.max}`}>
                <span className="canvas-dynamic-label">
                  <span className="canvas-dynamic-name">{label}</span>
                  <strong>{control.name}</strong>
                </span>
                <input
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={value}
                  onInput={(event) => updateDynamicControl(control, event.currentTarget.value)}
                  onChange={(event) => updateDynamicControl(control, event.target.value)}
                  disabled={demoState.sliderDisabled}
                  aria-label={label}
                />
                <output>{formatControlValue(value)}</output>
              </label>
            );
          })}
        </div>
      ) : null}
      {isRecordGuideOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsRecordGuideOpen(false)}>
          <section
            className="recording-guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recording-guide-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 id="recording-guide-title">导出演示视频</h2>
                <p>接下来会调用浏览器录屏权限，自动录制滑动条演示过程。</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setIsRecordGuideOpen(false)} title="关闭">
                <X size={17} />
              </button>
            </div>
            <div className="recording-guide-body">
              <AlertTriangle size={18} />
              <div>
                <strong>请选择“当前标签页”或当前浏览器窗口</strong>
                <ul>
                  {getDemoRecordingChecklist().map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="api-key-actions">
              <button className="secondary-button" type="button" onClick={() => setIsRecordGuideOpen(false)}>
                取消
              </button>
              <button className="primary-button compact" type="button" onClick={startDynamicDemoRecording}>
                开始录制
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <div className={`render-log render-log-${renderLogState.tone}`}>
        <span className="render-log-summary">{renderLogState.summary}</span>
        {commandResults.length ? (
          <button type="button" onClick={() => setIsRenderLogExpanded((value) => !value)}>
            {shouldShowRenderLogDetails ? "收起日志" : "查看日志"}
          </button>
        ) : null}
        {shouldShowRenderLogDetails ? (
          <div className="render-log-details">
            {renderLogEntries.map((entry) => (
              <span className={entry.ok ? "log-ok" : "log-fail"} key={entry.command}>
                {entry.ok ? "成功" : "失败"}: {entry.command}
              </span>
            ))}
          </div>
        ) : null}
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
            <p>解析题目 · 动态演示 · 导出视频</p>
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
          {isSubmitting ? "正在理解题目" : "解析并生成方案"}
        </button>
      </form>
    </section>
  );
}

function PreviewPanel({
  result,
  history,
  onRender,
  onRegenerateCommands,
  onSelectHistory,
  onOpenCommands,
  onOpenHistory
}) {
  const commandCount = result?.ggbCommands?.length || 0;
  const [editableSteps, setEditableSteps] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState("");

  useEffect(() => {
    setEditableSteps(result?.constructionSteps?.join("\n") || "");
    setRegenerateError("");
  }, [result]);

  async function regenerateCommands() {
    if (!result) return;
    const constructionSteps = editableSteps
      .split("\n")
      .map((step) => step.trim())
      .filter(Boolean);

    if (!constructionSteps.length) {
      setRegenerateError("请至少保留一条构造步骤。");
      return;
    }

    setIsRegenerating(true);
    setRegenerateError("");
    try {
      await onRegenerateCommands(constructionSteps);
    } catch (error) {
      setRegenerateError(error.message || "重新生成命令失败。");
    } finally {
      setIsRegenerating(false);
    }
  }

  return (
    <section className="panel preview-panel">
      <div className="panel-header">
        <div>
          <h2>AI 绘图方案</h2>
          <p>{result ? `${commandCount} 条命令可编辑后绘制` : "提交题目后生成可编辑方案"}</p>
        </div>
        <Braces size={20} />
      </div>

      {result ? (
        <div className="plan-stack">
          <div className="summary-card">
            <span className="type-badge">{formatMathType(result.mathType)}</span>
            <h3>{result.problemSummary || "未返回题目摘要"}</h3>
            {result.dynamicControls?.length ? (
              <p className="dynamic-summary">
                含 {result.dynamicControls.length} 个动态参数，可播放并导出演示。
              </p>
            ) : null}
            {result.followupQuestion ? <p className="followup">{result.followupQuestion}</p> : null}
          </div>

          <div className="steps-block">
            <h3>构造步骤（可编辑）</h3>
            <textarea
              className="steps-editor"
              value={editableSteps}
              onChange={(event) => setEditableSteps(event.target.value)}
              placeholder="每行一个构造步骤，修改后可让 AI 重新生成命令。"
            />
            <div className="steps-actions">
              <button className="secondary-button" type="button" onClick={regenerateCommands} disabled={isRegenerating}>
                {isRegenerating ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
                {isRegenerating ? "正在生成命令" : "根据步骤重新生成命令"}
              </button>
            </div>
            {regenerateError ? (
              <div className="error-box compact">
                <AlertTriangle size={15} />
                <span>{regenerateError}</span>
              </div>
            ) : null}
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
              <h3>GeoGebra 命令（可编辑）</h3>
              <span>{commandCount}</span>
            </div>
            <button className="command-preview-button" type="button" onClick={onOpenCommands}>
              查看/编辑命令
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
          <p>AI 会生成题意摘要、可编辑构造步骤和 GeoGebra 命令；你确认后再绘制。</p>
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
          <p className="muted">解析过的题目会在本地复用，避免重复调用模型。</p>
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

function CommandDialog({ result, onUpdateCommands, onClose }) {
  const [commandsText, setCommandsText] = useState(result?.ggbCommands?.join("\n") || "");
  const [copyStatus, setCopyStatus] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    setCommandsText(result?.ggbCommands?.join("\n") || "");
    setCopyStatus("");
    setSaveStatus("");
  }, [result]);

  if (!result) return null;

  async function copyCommands() {
    setCopyStatus("");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(commandsText);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = commandsText;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.append(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setCopyStatus("已复制");
      window.setTimeout(() => setCopyStatus(""), 1600);
    } catch {
      setCopyStatus("复制失败，请手动选择命令文本。");
    }
  }

  function saveCommands() {
    const commands = commandsText
      .split("\n")
      .map((command) => command.trim())
      .filter(Boolean);

    onUpdateCommands(commands);
    setSaveStatus(`已保存 ${commands.length} 条命令`);
    window.setTimeout(() => setSaveStatus(""), 1600);
  }

  return (
    <DialogFrame title="查看/编辑 GeoGebra 命令" onClose={onClose}>
      <div className="dialog-toolbar">
        <span>{commandsText.split("\n").filter((command) => command.trim()).length} 条命令，保存后用于绘制</span>
        <div className="dialog-toolbar-actions">
          <button className="secondary-button" type="button" onClick={saveCommands}>
            <CheckCircle2 size={15} />
            保存命令
          </button>
          <button className="secondary-button" type="button" onClick={copyCommands}>
            <Copy size={15} />
            {copyStatus === "已复制" ? "已复制" : "复制命令"}
          </button>
        </div>
      </div>
      {saveStatus ? <p className="dialog-copy-success">{saveStatus}</p> : null}
      {copyStatus && copyStatus !== "已复制" ? <p className="dialog-copy-error">{copyStatus}</p> : null}
      <textarea
        className="dialog-code command-editor"
        value={commandsText}
        onChange={(event) => {
          setCommandsText(event.target.value);
          setSaveStatus("");
        }}
        spellCheck="false"
      />
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

  function updateCommands(commands) {
    setResult((current) => current
      ? {
        ...current,
        ggbCommands: commands,
        rejectedCommands: [],
        dynamicControls: mergeDynamicControls({
          commands,
          dynamicControls: current.dynamicControls
        })
      }
      : current);
  }

  async function regenerateCommands(constructionSteps) {
    if (!latestResult) return;

    const apiSettings = readApiSettings();
    const headers = { "Content-Type": "application/json" };
    if (apiSettings.apiKey) headers["X-OpenAI-API-Key"] = apiSettings.apiKey;
    if (apiSettings.baseUrl) headers["X-OpenAI-Base-URL"] = apiSettings.baseUrl;
    if (apiSettings.model) headers["X-OpenAI-Model"] = apiSettings.model;

    const response = await fetch("/api/commands", {
      method: "POST",
      headers,
      body: JSON.stringify({
        problemSummary: latestResult.problemSummary,
        mathType: latestResult.mathType,
        viewport: latestResult.viewport,
        constructionSteps
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "重新生成命令失败。");
    }

    setResult(payload);
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
        onRegenerateCommands={regenerateCommands}
        onSelectHistory={selectHistory}
        onOpenCommands={() => setIsCommandOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />
      <GeoGebraCanvas result={latestResult} renderRequest={renderRequest} />
      {isCommandOpen ? (
        <CommandDialog
          result={latestResult}
          onUpdateCommands={updateCommands}
          onClose={() => setIsCommandOpen(false)}
        />
      ) : null}
      {isHistoryOpen ? <HistoryDialog history={history} onSelect={selectHistory} onClose={() => setIsHistoryOpen(false)} /> : null}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
