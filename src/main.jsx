import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  BookOpen,
  Braces,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Copy,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileImage,
  History,
  Loader2,
  KeyRound,
  Lock,
  Maximize2,
  Minimize2,
  PencilRuler,
  Play,
  Presentation,
  RefreshCw,
  Search,
  Settings2,
  Star,
  Trash2,
  Upload,
  Unlock,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { executeGgbCommand, get3DCoordinateSystem, getExplicitlyHiddenObjectLabels } from "./ggbExecutor.js";
import { downloadGgbConstruction, downloadGgbWebPage } from "./ggbDownload.js";
import { getDynamicDemoState } from "./dynamicDemoState.js";
import {
  createDynamicDemoPlan,
  getInitialDynamicControlValue,
  getSweepValue
} from "./dynamicDemoTimeline.js";
import { getRenderLogState } from "./renderLogState.js";
import { assessRenderQuality } from "./renderQuality.js";
import { createHistoryCacheKey, findHistoryCacheHit, readHistoryItems } from "./historyCache.js";
import { mergeDynamicControls } from "../shared/dynamicControls.js";
import { enhanceSolidGeometryCommands } from "../shared/solidGeometryEnhancer.js";
import { normalizeStyleCommandTargets } from "../shared/styleTargetNormalizer.js";
import {
  AREA_FILLING,
  enhanceTeachingDiagramCommands,
  getHighlightedAreaPolygonLabels
} from "../shared/teachingDiagramEnhancer.js";
import { providerPresets } from "../shared/providerPresets.js";
import { validateSemanticContract } from "../shared/semanticValidator.js";
import {
  PROMPT_VERSION,
  SOLVE_SCHEMA_VERSION,
  TEMPLATE_VERSION,
  VALIDATOR_VERSION,
  normalizeSolveResultV2
} from "../shared/solveResultV2.js";
import { loadGeoGebra } from "./ggbLoader.js";
import { createDiagnosticReport, recordDiagnostic } from "./diagnostics.js";
import {
  createProjectBackup,
  deleteProject,
  importProjects,
  migrateLegacyHistory,
  parseProjectBackup,
  saveProject
} from "./projectStore.js";
import "./styles.css";

const HISTORY_KEY = "ggb-ai-history-v6";
const LEGACY_HISTORY_KEYS = ["ggb-ai-history-v5", "ggb-ai-history-v4", "ggb-ai-history-v3", "ggb-ai-history-v2", "ggb-ai-history-v1"];
const API_SETTINGS_STORAGE_KEY = "ggb-ai-provider-settings-v1";

const defaultApiSettings = {
  apiKey: "",
  baseUrl: "",
  model: "",
  supportsVision: null
};

const examples = [
  "已知椭圆 x²/9+y²/4=1，点 P 在椭圆上运动，求并观察三角形 PF₁F₂ 的面积变化。",
  "棱长为 4 的正方体 ABCD-A₁B₁C₁D₁ 被水平平面截割，观察截面随高度变化。"
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

function downloadTextFile(content, filename, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
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

function getConstructionStepText(step) {
  return typeof step === "string" ? step : String(step?.text || "");
}

function normalizeEditableSteps(text, previousSteps = []) {
  return String(text || "")
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean)
    .map((step, index) => ({
      id: previousSteps[index]?.id || `step-${index + 1}`,
      text: step,
      objectLabels: Array.isArray(previousSteps[index]?.objectLabels) ? previousSteps[index].objectLabels : [],
      stage: index + 1
    }));
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

function splitCommandArguments(source) {
  const args = [];
  let depth = 0;
  let quote = "";
  let start = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const previous = source[index - 1];

    if (quote) {
      if (character === quote && previous !== "\\") quote = "";
      continue;
    }

    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }

    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;

    if (character === "," && depth === 0) {
      args.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }

  args.push(source.slice(start).trim());
  return args.filter(Boolean);
}

function parseObjectCommand(command) {
  const text = String(command || "").trim();
  const labeledEquation = text.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:/);
  if (labeledEquation) {
    return { label: labeledEquation[1], commandName: "Equation", args: [] };
  }

  const assignment = text.match(/^([A-Za-z][A-Za-z0-9_]*)\s*=\s*([A-Za-z][A-Za-z0-9_]*)?\s*(?:\(([\s\S]*)\))?\s*$/);
  if (!assignment) return null;

  const [, label, commandName, argsSource = ""] = assignment;
  if (!commandName && /^\s*\(/.test(text.replace(/^([A-Za-z][A-Za-z0-9_]*)\s*=\s*/, ""))) {
    return { label, commandName: "Point", args: [] };
  }
  if (!commandName) return null;
  return { label, commandName, args: splitCommandArguments(argsSource) };
}

function buildObjectCommandIndex(commands) {
  const index = new Map();
  for (const command of commands || []) {
    const parsed = parseObjectCommand(command);
    if (parsed?.label) index.set(parsed.label, parsed);
  }
  return index;
}

function getObjectTypeLabel(api, objectName, commandIndex) {
  const parsed = commandIndex.get(objectName);
  const commandName = parsed?.commandName || "";
  const normalizedCommand = commandName.toLowerCase();
  let type = "";

  try {
    type = String(api?.getObjectType?.(objectName) || "").toLowerCase();
  } catch {
    type = "";
  }

  if (normalizedCommand === "point" || type.includes("point")) return "点";
  if (normalizedCommand === "function" || type.includes("function")) return "函数";
  if (normalizedCommand === "equation" || type.includes("conic")) return "曲线";
  if (normalizedCommand === "line" || type.includes("line")) return "直线";
  if (normalizedCommand === "segment" || type.includes("segment")) return "线段";
  if (normalizedCommand === "ray" || type.includes("ray")) return "射线";
  if (normalizedCommand === "circle" || type.includes("circle")) return "圆";
  if (normalizedCommand === "locus" || type.includes("locus")) return "轨迹";
  if (normalizedCommand === "plane" || type.includes("plane")) return "平面";
  if (normalizedCommand === "angle" || type.includes("angle")) return "角";
  if (normalizedCommand === "distance") return "距离";
  if (normalizedCommand === "area") return "面积";
  if (normalizedCommand === "slider" || type.includes("numeric")) return "参数";
  if (normalizedCommand === "polygon" || type.includes("polygon")) {
    const vertexNames = parsed?.args?.filter((arg) => /^[A-Za-z][A-Za-z0-9_]*$/.test(arg)) || [];
    if (vertexNames.length === 3) return "三角形";
    if (vertexNames.length === 4) return "四边形";
    if (vertexNames.length > 4) return "多边形";
    return "多边形";
  }

  return "对象";
}

function getObjectDisplayName(api, objectName, commandIndex) {
  const parsed = commandIndex.get(objectName);
  const typeLabel = getObjectTypeLabel(api, objectName, commandIndex);
  if (["三角形", "四边形", "多边形"].includes(typeLabel)) {
    const vertexNames = parsed?.args?.filter((arg) => /^[A-Za-z][A-Za-z0-9_]*$/.test(arg)) || [];
    return vertexNames.length ? `${typeLabel} ${vertexNames.join("")}` : `${typeLabel} ${objectName}`;
  }
  return `${typeLabel} ${objectName}`;
}

function collectRuntimeObjectStates(api, objectManifest = []) {
  const states = {};
  const byLabel = new Map(objectManifest.map((object) => [object.label, object]));
  const pointCoordinates = (label) => {
    try {
      const x = Number(api.getXcoord?.(label));
      const y = Number(api.getYcoord?.(label));
      const z = Number(api.getZcoord?.(label));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return Number.isFinite(z) ? [x, y, z] : [x, y];
    } catch {
      return null;
    }
  };

  for (const object of objectManifest) {
    const coordinates = pointCoordinates(object.label);
    let value;
    try {
      value = Number(api.getValue?.(object.label));
    } catch {
      value = Number.NaN;
    }
    states[object.label] = {
      ...(coordinates ? { coordinates } : {}),
      ...(Number.isFinite(value) ? { value } : {})
    };
  }

  for (const object of objectManifest) {
    const dependencies = object.dependencies || [];
    if (dependencies.length < 2) continue;
    const first = states[dependencies[0]]?.coordinates || pointCoordinates(dependencies[0]);
    const second = states[dependencies[1]]?.coordinates || pointCoordinates(dependencies[1]);
    if (!first || !second) continue;
    const dimension = Math.max(first.length, second.length);
    states[object.label] = {
      ...states[object.label],
      vector: Array.from({ length: dimension }, (_, index) => (second[index] || 0) - (first[index] || 0))
    };
  }

  for (const object of objectManifest) {
    if (states[object.label]?.vector || !object.dependencies?.length) continue;
    const dependency = byLabel.get(object.dependencies[0]);
    if (dependency && states[dependency.label]?.vector) {
      states[object.label] = { ...states[object.label], vector: states[dependency.label].vector };
    }
  }
  return states;
}

function GeoGebraCanvas({
  result,
  renderRequest,
  onRepairCommands,
  onSemanticReview,
  isTeachingMode,
  onToggleTeachingMode,
  onStepSelection,
  selectedStep
}) {
  const containerRef = useRef(null);
  const shellRef = useRef(null);
  const appletRef = useRef(null);
  const demoRunRef = useRef(0);
  const [status, setStatus] = useState("正在加载 GeoGebra...");
  const [commandResults, setCommandResults] = useState([]);
  const [renderQuality, setRenderQuality] = useState(null);
  const [canvasObjects, setCanvasObjects] = useState([]);
  const [selectedObject, setSelectedObject] = useState("");
  const [selectedObjects, setSelectedObjects] = useState([]);
  const [objectSearch, setObjectSearch] = useState("");
  const [isSelectedLabelVisible, setIsSelectedLabelVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState("2d");
  const [isEditorMode, setIsEditorMode] = useState(false);
  const [ggbLoadError, setGgbLoadError] = useState("");
  const [presentationStage, setPresentationStage] = useState(0);
  const [appletReadyVersion, setAppletReadyVersion] = useState(0);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [dynamicValues, setDynamicValues] = useState({});
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);
  const [lastRenderedSignature, setLastRenderedSignature] = useState("");
  const [demoFocusControl, setDemoFocusControl] = useState(null);
  const repairAttemptsRef = useRef(new Set());
  const repairCountRef = useRef(new Map());
  const pendingConstructionBase64Ref = useRef("");
  const semanticReviewSignaturesRef = useRef(new Set());
  const objectCommandIndexRef = useRef(new Map());
  const clickListenerNameRef = useRef(`__ggbAiObjectClick_${Math.random().toString(36).slice(2)}`);
  const highlightedObjectRef = useRef("");
  const userSelectedViewRef = useRef(false);
  const currentRenderSignature = getRenderSignature(result, viewMode);
  const demoState = getDynamicDemoState({
    supportsRecording: false,
    directExport: false,
    hasRenderedCurrent: Boolean(commandResults.length && lastRenderedSignature === currentRenderSignature),
    isPlaying: isPlayingDemo,
    isRecording: false
  });
  const canPlayDemo = demoState.canPlay;
  const demoFocusLabel = demoFocusControl ? formatDynamicControlLabel(demoFocusControl) : "";
  const demoFocusValue = demoFocusControl
    ? dynamicValues[demoFocusControl.name] ?? getInitialDynamicControlValue(demoFocusControl)
    : undefined;
  const renderLogState = getRenderLogState(commandResults, renderQuality);
  const maxPresentationStage = Math.max(
    1,
    ...(result?.constructionSteps || []).map((step, index) => Number(step?.stage) || index + 1)
  );

  useEffect(() => {
    demoRunRef.current += 1;
    setIsPlayingDemo(false);
    setDemoFocusControl(null);
    setRenderQuality(null);
    setCanvasObjects([]);
    setSelectedObject("");
    setSelectedObjects([]);
    setIsSelectedLabelVisible(true);
    objectCommandIndexRef.current = new Map();
    highlightedObjectRef.current = "";
    const nextValues = {};
    for (const control of result?.dynamicControls || []) {
      nextValues[control.name] = getInitialDynamicControlValue(control);
    }
    setDynamicValues(nextValues);
    setPresentationStage(0);
  }, [result, viewMode]);

  useEffect(() => {
    if (!result || userSelectedViewRef.current) return;
    setViewMode(result.mathType === "solid_geometry" ? "3d" : "2d");
  }, [result?.problemContract?.originalText, result?.mathType]);

  useEffect(() => {
    if (isTeachingMode) {
      setPresentationStage((current) => Math.max(1, current || 1));
    } else {
      setPresentationStage(0);
    }
  }, [isTeachingMode]);

  useEffect(() => {
    const api = appletRef.current;
    if (!api || !commandResults.length) return;
    const manifest = result?.objectManifest || [];
    for (const object of manifest) {
      try {
        const stageVisible = !isTeachingMode
          || presentationStage <= 0
          || Number(object.stage || 1) <= presentationStage;
        api.setVisible?.(object.label, stageVisible && object.visible !== false);
      } catch {
        // Continue applying the stage to the rest of the construction.
      }
    }
    const selectedStep = (result?.constructionSteps || []).find((step, index) => (
      (Number(step?.stage) || index + 1) === presentationStage
    ));
    onStepSelection?.(selectedStep || null);
    api.refreshViews?.();
  }, [presentationStage, isTeachingMode, commandResults.length, result]);

  useEffect(() => {
    const api = appletRef.current;
    if (!api || isTeachingMode) return;
    const selectedLabels = new Set(selectedStep?.objectLabels || []);
    for (const objectName of canvasObjects) {
      try {
        api.setHighlighting?.(objectName, selectedLabels.has(objectName));
      } catch {
        // Highlighting support differs between GeoGebra builds.
      }
    }
    api.refreshViews?.();
  }, [selectedStep, canvasObjects, isTeachingMode]);

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
        setStatus("正在连接 GeoGebra...");
        return;
      }

      const bounds = shellRef.current.getBoundingClientRect();
      const params = {
        id: "ggbApplet",
        appName: viewMode === "3d" ? "3d" : "classic",
        width: Math.max(1, Math.floor(bounds.width)),
        height: Math.max(1, Math.floor(bounds.height)),
        showToolBar: isEditorMode,
        showAlgebraInput: isEditorMode,
        showMenuBar: false,
        perspective: isEditorMode ? (viewMode === "3d" ? "AT" : "AG") : (viewMode === "3d" ? "T" : "G"),
        showZoomButtons: true,
        enableLabelDrags: true,
        enableShiftDragZoom: true,
        useBrowserForJS: false,
        appletOnLoad: (api) => {
          appletRef.current = api;
          window[clickListenerNameRef.current] = (objectName) => {
            if (objectName) selectCanvasObject(String(objectName), { fromCanvas: true });
          };
          try {
            api.registerClickListener?.(clickListenerNameRef.current);
          } catch {
            // Some GeoGebra builds do not expose click listeners in embedded mode.
          }
          setStatus("已就绪");
          setAppletReadyVersion((version) => version + 1);
          try {
            resizeApplet();
            if (viewMode === "3d") {
              api.setAxesVisible?.(3, true, true, true);
            } else {
              api.setAxesVisible(true, true);
              api.setCoordSystem(-8, 8, -6, 6);
            }
            if (pendingConstructionBase64Ref.current) {
              api.setBase64?.(pendingConstructionBase64Ref.current);
              pendingConstructionBase64Ref.current = "";
            }
          } catch {
            // GeoGebra can report ready before every view API is available.
          }
        }
      };

      const applet = new window.GGBApplet(params, true);
      applet.inject("ggb-canvas");
    }

    setGgbLoadError("");
    setStatus("正在加载 GeoGebra...");
    loadGeoGebra()
      .then(() => {
        if (!cancelled) injectApplet();
      })
      .catch((error) => {
        if (cancelled) return;
        setGgbLoadError(error.message || "GeoGebra 加载失败");
        setStatus("GeoGebra 暂不可用");
      });
    return () => {
      cancelled = true;
      appletRef.current = null;
      try {
        delete window[clickListenerNameRef.current];
      } catch {
        window[clickListenerNameRef.current] = undefined;
      }
      if (containerRef.current) containerRef.current.replaceChildren();
    };
  }, [viewMode, isEditorMode]);

  function retryGeoGebraLoad() {
    setGgbLoadError("");
    setStatus("正在重新连接 GeoGebra...");
    loadGeoGebra({ forceRetry: true })
      .then(() => {
        if (!appletRef.current) window.location.reload();
      })
      .catch((error) => {
        setGgbLoadError(error.message || "GeoGebra 加载失败");
        setStatus("GeoGebra 暂不可用");
      });
  }

  useEffect(() => {
    const handleWindowResize = () => resizeApplet();
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  useEffect(() => {
    if (!renderRequest || !result || !appletRef.current) return;
    demoRunRef.current += 1;
    setIsPlayingDemo(false);
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
        if (!isEditorMode) api.setPerspective?.("T");
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
      objectCommandIndexRef.current = buildObjectCommandIndex(commandsToRender);
      areaHighlightLabels = getHighlightedAreaPolygonLabels({ mathType: result.mathType, commands: commandsToRender });
      for (const command of commandsToRender) {
        nextCommandResults.push(executeGgbCommand(api, command));
      }

      objectNames = typeof api.getAllObjectNames === "function" ? api.getAllObjectNames() : [];
      const inspectableObjects = objectNames
        .filter((name) => !dynamicControls.some((control) => control.name === name))
        .slice(0, 200);
      setCanvasObjects(inspectableObjects);
      setSelectedObject((current) => {
        const nextSelected = current && inspectableObjects.includes(current) ? current : inspectableObjects[0] || "";
        if (nextSelected) window.setTimeout(() => selectCanvasObject(nextSelected, { announce: false }), 0);
        return nextSelected;
      });
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
      const qualityReport = assessRenderQuality({
        api,
        commands: commandsToRender,
        commandResults: nextCommandResults,
        dynamicControls,
        objectNames
      });
      const objectStates = collectRuntimeObjectStates(api, result.objectManifest);
      const semanticReport = validateSemanticContract({
        contract: result.problemContract,
        originalContract: result.problemContract,
        mathType: result.mathType,
        commands: commandsToRender,
        objectManifest: result.objectManifest,
        objectStates
      });
      const combinedQualityReport = semanticReport.ok
        ? qualityReport
        : {
          ...qualityReport,
          checked: true,
          ok: false,
          tone: "warn",
          issues: [...(qualityReport.issues || []), ...semanticReport.issues.map((issue) => issue.message)]
        };
      const hasRenderedObject = Boolean(objectNames.length || nextCommandResults.some((item) => item.ok));
      setCommandResults(nextCommandResults);
      setRenderQuality(combinedQualityReport);
      setLastRenderedSignature(hasRenderedObject ? currentRenderSignature : "");
      setStatus(hasRenderedObject ? "已绘制" : "正在检查绘图结果");
      if (!combinedQualityReport.ok || !hasRenderedObject) {
        void requestCommandRepair({
          qualityReport: hasRenderedObject
            ? combinedQualityReport
            : { ...combinedQualityReport, checked: true, ok: false, issues: ["没有检测到可见 GeoGebra 对象"] },
          commandResults: nextCommandResults,
          objectNames
        });
      } else if (semanticReport.requiresSemanticReview && typeof onSemanticReview === "function") {
        const reviewSignature = getRenderSignature(result, viewMode);
        if (!semanticReviewSignaturesRef.current.has(reviewSignature)) {
          semanticReviewSignaturesRef.current.add(reviewSignature);
          setStatus("正在核对复杂图形...");
          void onSemanticReview({
            problemContract: result.problemContract,
            mathType: result.mathType,
            objectManifest: result.objectManifest,
            objectStates,
            commandSummary: commandsToRender.slice(0, 80)
          }).then((review) => {
            if (review?.ok) {
              setStatus("已绘制");
              return;
            }
            void requestCommandRepair({
              qualityReport: {
                checked: true,
                ok: false,
                issues: (review?.issues || []).map((issue) => issue.message || "图形语义不一致")
              },
              commandResults: nextCommandResults,
              objectNames
            });
          }).catch(() => {
            setStatus("当前图形未通过完整性检查，请重新生成");
          });
        }
      }
    } catch (error) {
      setStatus(error.message || "GeoGebra 绘制失败");
      setCommandResults(nextCommandResults);
      setRenderQuality(null);
      setCanvasObjects([]);
      setSelectedObject("");
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

  useEffect(() => {
    if (!isTeachingMode) return undefined;
    function handleTeachingKeys(event) {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPresentationStage((stage) => Math.max(1, stage - 1));
      } else if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        setPresentationStage((stage) => Math.min(maxPresentationStage, Math.max(1, stage + 1)));
      } else if (event.key === "Home") {
        event.preventDefault();
        setPresentationStage(1);
      }
    }
    window.addEventListener("keydown", handleTeachingKeys);
    return () => window.removeEventListener("keydown", handleTeachingKeys);
  }, [isTeachingMode, maxPresentationStage]);

  function resetCanvas() {
    if (!appletRef.current) return;
    demoRunRef.current += 1;
    setIsPlayingDemo(false);
    setDemoFocusControl(null);
    appletRef.current.newConstruction();
    if (viewMode === "3d") {
      try {
        appletRef.current.setCoordSystem(...get3DCoordinateSystem(result?.viewport));
        appletRef.current.setAxesVisible?.(3, true, true, true);
      } catch {
        // Keep the default 3D camera when this applet build lacks the overload.
      }
    } else {
      appletRef.current.setCoordSystem(-8, 8, -6, 6);
    }
    setCommandResults([]);
    setRenderQuality(null);
    setCanvasObjects([]);
    setSelectedObject("");
    setLastRenderedSignature("");
    setStatus("已就绪");
  }

  function preserveConstructionBeforeAppletReload() {
    try {
      pendingConstructionBase64Ref.current = appletRef.current?.getBase64?.() || "";
    } catch {
      pendingConstructionBase64Ref.current = "";
    }
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

  async function requestCommandRepair({ qualityReport, commandResults: nextCommandResults, objectNames }) {
    if (!result || typeof onRepairCommands !== "function") return false;
    if (!qualityReport?.checked || qualityReport.ok) return false;

    const signature = getRenderSignature(result, viewMode);
    if (!signature || repairAttemptsRef.current.has(signature)) return false;
    const contractKey = JSON.stringify(result.problemContract || { mathType: result.mathType, summary: result.problemSummary });
    const nextAttempt = (repairCountRef.current.get(contractKey) || 0) + 1;
    if (nextAttempt > 2) {
      setStatus("当前图形未通过完整性检查，请重新生成");
      return false;
    }
    repairCountRef.current.set(contractKey, nextAttempt);
    repairAttemptsRef.current.add(signature);

    const failedCommands = nextCommandResults
      .filter((entry) => !entry?.ok)
      .map((entry) => entry.command)
      .slice(0, 12);

    setStatus("正在自动检查并修复绘图方案...");
    try {
      await onRepairCommands({
        issues: qualityReport.issues || [],
        failedCommands,
        objectNames: Array.isArray(objectNames) ? objectNames.slice(0, 80) : [],
        viewMode,
        attempt: nextAttempt
      });
      setStatus("已自动修复，正在重新绘制");
      return true;
    } catch {
      setStatus("当前图形未通过完整性检查，请重新生成");
      return false;
    }
  }

  function selectCanvasObject(objectName, { fromCanvas = false, announce = true } = {}) {
    const api = appletRef.current;
    if (!objectName) return;

    setSelectedObject(objectName);
    setSelectedObjects([objectName]);
    try {
      if (typeof api?.getLabelVisible === "function") {
        setIsSelectedLabelVisible(Boolean(api.getLabelVisible(objectName)));
      } else {
        setIsSelectedLabelVisible(true);
      }
    } catch {
      setIsSelectedLabelVisible(true);
    }

    try {
      if (typeof api?.setHighlighting === "function") {
        if (highlightedObjectRef.current && highlightedObjectRef.current !== objectName) {
          api.setHighlighting(highlightedObjectRef.current, false);
        }
        api.setHighlighting(objectName, true);
        highlightedObjectRef.current = objectName;
      }
      if (typeof api?.setSelected === "function") {
        api.setSelected(objectName);
      } else if (/^[A-Za-z][A-Za-z0-9_]*$/.test(objectName)) {
        api?.evalCommand?.(`SelectObjects(${objectName})`);
      }
      api?.refreshViews?.();
    } catch {
      // Selection highlighting is best-effort; the style panel should still remain usable.
    }

    if (announce || fromCanvas) {
      setStatus(`已选中${getObjectDisplayName(api, objectName, objectCommandIndexRef.current)}`);
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

  function styleSelectedObject(action) {
    const api = appletRef.current;
    if (!api || !selectedObject) return;

    try {
      const targets = selectedObjects.length ? selectedObjects : [selectedObject];
      const nextVisible = !isSelectedLabelVisible;
      for (const target of targets) {
        if (action === "toggle-label") api.setLabelVisible?.(target, nextVisible);
        if (action === "blue") api.setColor?.(target, 37, 99, 235);
        if (action === "red") api.setColor?.(target, 220, 38, 38);
        if (action === "gray") api.setColor?.(target, 71, 85, 105);
        if (action === "bold") api.setLineThickness?.(target, 5);
        if (action === "hide") api.setVisible?.(target, false);
        if (action === "show") api.setVisible?.(target, true);
        if (action === "lock") api.setFixed?.(target, true, false);
        if (action === "unlock") api.setFixed?.(target, false, true);
      }
      if (action === "toggle-label") setIsSelectedLabelVisible(nextVisible);
      if (action !== "toggle-label") selectCanvasObject(selectedObject, { announce: false });
      api.refreshViews?.();
      setStatus(`已更新${getObjectDisplayName(api, selectedObject, objectCommandIndexRef.current)}`);
    } catch {
      setStatus(`${getObjectDisplayName(api, selectedObject, objectCommandIndexRef.current)}暂不支持该样式`);
    }
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
    if (!controls.length || isPlayingDemo) return;
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

  function downloadConstruction(format) {
    try {
      if (format === "web") {
        downloadGgbWebPage(appletRef.current, {
          appName: viewMode === "3d" ? "3d" : "classic",
          title: result?.problemSummary || "GeoGebra AI 构造",
          problemText: result?.recognizedProblemText || result?.problemContract?.originalText || "",
          constructionSteps: result?.constructionSteps || [],
          dynamicControls: result?.dynamicControls || [],
          objectManifest: result?.objectManifest || [],
          commands: result?.ggbCommands || []
        });
        setStatus("已下载网页版 HTML");
      } else {
        downloadGgbConstruction(appletRef.current, { title: result?.problemSummary || "GeoGebra AI 构造" });
        setStatus("已下载 .ggb 文件");
      }
      setIsDownloadMenuOpen(false);
    } catch (error) {
      setStatus(error.message || "下载文件失败");
    }
  }

  const manifestByLabel = new Map((result?.objectManifest || []).map((object) => [object.label, object]));
  const objectOptions = canvasObjects.map((objectName) => ({
    name: objectName,
    label: manifestByLabel.get(objectName)?.teacherName
      || getObjectDisplayName(appletRef.current, objectName, objectCommandIndexRef.current)
  }));
  const roleLabels = {
    original: "原题对象",
    key: "关键对象",
    conclusion: "结论对象",
    helper: "辅助对象",
    trajectory: "运动轨迹",
    region: "图形区域",
    measurement: "度量与结论",
    parameter: "动态参数",
    hidden: "隐藏计算对象"
  };
  const objectGroups = objectOptions
    .filter((object) => object.label.toLowerCase().includes(objectSearch.trim().toLowerCase()))
    .reduce((groups, object) => {
      const role = manifestByLabel.get(object.name)?.role || "original";
      const current = groups.get(role) || [];
      current.push(object);
      groups.set(role, current);
      return groups;
    }, new Map());
  const selectedObjectLabel = selectedObject
    ? getObjectDisplayName(appletRef.current, selectedObject, objectCommandIndexRef.current)
    : "";

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
              onClick={() => {
                preserveConstructionBeforeAppletReload();
                userSelectedViewRef.current = true;
                setViewMode("2d");
              }}
              aria-pressed={viewMode === "2d"}
            >
              2D
            </button>
            <button
              className={viewMode === "3d" ? "is-selected" : ""}
              type="button"
              onClick={() => {
                preserveConstructionBeforeAppletReload();
                userSelectedViewRef.current = true;
                setViewMode("3d");
              }}
              aria-pressed={viewMode === "3d"}
            >
              3D
            </button>
          </div>
          <button
            className={`icon-button${isEditorMode ? " is-active" : ""}`}
            type="button"
            onClick={() => {
              preserveConstructionBeforeAppletReload();
              setIsEditorMode((value) => !value);
            }}
            title={isEditorMode ? "切换纯画布" : "打开 GeoGebra 编辑器"}
            aria-label={isEditorMode ? "切换纯画布" : "打开 GeoGebra 编辑器"}
          >
            <Settings2 size={17} />
          </button>
          <button
            className={`icon-button${isTeachingMode ? " is-active" : ""}`}
            type="button"
            onClick={onToggleTeachingMode}
            title={isTeachingMode ? "退出授课模式" : "进入授课模式"}
            aria-label={isTeachingMode ? "退出授课模式" : "进入授课模式"}
          >
            {isTeachingMode ? <BookOpen size={17} /> : <Presentation size={17} />}
          </button>
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
        {ggbLoadError ? (
          <div className="ggb-load-error" role="alert">
            <AlertTriangle size={24} />
            <strong>{ggbLoadError}</strong>
            <button className="secondary-button" type="button" onClick={retryGeoGebraLoad}>
              <RefreshCw size={15} />
              重新连接
            </button>
          </div>
        ) : null}
        {isPlayingDemo && demoFocusLabel ? (
          <div className="demo-focus-badge">
            演示：{demoFocusLabel}
            {demoFocusControl ? (
              <span>{demoFocusControl.name}={formatControlValue(demoFocusValue)}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      {isTeachingMode && result ? (
        <div className="presentation-controls" aria-label="分步演示">
          <button
            type="button"
            onClick={() => setPresentationStage((stage) => Math.max(1, stage - 1))}
            disabled={presentationStage <= 1}
            aria-label="上一步"
          >
            <ChevronLeft size={16} />
            上一步
          </button>
          <span>第 {Math.max(1, presentationStage)} / {maxPresentationStage} 步</span>
          <button
            type="button"
            onClick={() => setPresentationStage((stage) => Math.min(maxPresentationStage, stage + 1))}
            disabled={presentationStage >= maxPresentationStage}
          >
            下一步
            <ChevronRight size={16} />
          </button>
          <button type="button" onClick={() => setPresentationStage(maxPresentationStage)}>全部显示</button>
          <button type="button" onClick={() => setPresentationStage(1)}>重新开始</button>
        </div>
      ) : null}
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
      {canvasObjects.length ? (
        <div className="object-inspector" aria-label="对象属性面板">
          <div className="object-inspector-header">
            <span>对象树</span>
            <small>{canvasObjects.length} 个对象</small>
          </div>
          <div className="object-inspector-body">
            <div className="object-tree">
              <label className="object-search">
                <Search size={14} />
                <input
                  value={objectSearch}
                  onChange={(event) => setObjectSearch(event.target.value)}
                  placeholder="搜索对象"
                  aria-label="搜索对象"
                />
              </label>
              {[...objectGroups.entries()].map(([role, objects]) => (
                <details key={role} open>
                  <summary>{roleLabels[role] || "其他对象"} <small>{objects.length}</small></summary>
                  {objects.map((object) => (
                    <label className={`object-tree-row${selectedObjects.includes(object.name) ? " is-selected" : ""}`} key={object.name}>
                      <input
                        type="checkbox"
                        checked={selectedObjects.includes(object.name)}
                        onChange={(event) => {
                          if (event.target.checked) setSelectedObject(object.name);
                          setSelectedObjects((current) => {
                            const next = event.target.checked
                              ? [...new Set([...current, object.name])]
                              : current.filter((name) => name !== object.name);
                            return next;
                          });
                        }}
                      />
                      <button type="button" onClick={() => selectCanvasObject(object.name)}>{object.label}</button>
                    </label>
                  ))}
                </details>
              ))}
            </div>
            <div className="object-inspector-controls">
              {selectedObjectLabel ? <span className="object-current-name">{selectedObjectLabel}</span> : null}
              <div className="object-style-actions">
              <button type="button" onClick={() => styleSelectedObject("toggle-label")}>
                {isSelectedLabelVisible ? "隐藏标签" : "显示标签"}
              </button>
              <button type="button" onClick={() => styleSelectedObject("show")} title="显示对象"><Eye size={14} /></button>
              <button type="button" onClick={() => styleSelectedObject("hide")} title="隐藏对象"><EyeOff size={14} /></button>
              <button type="button" onClick={() => styleSelectedObject("lock")} title="锁定对象"><Lock size={14} /></button>
              <button type="button" onClick={() => styleSelectedObject("unlock")} title="允许拖动"><Unlock size={14} /></button>
              <button className="swatch swatch-blue" type="button" onClick={() => styleSelectedObject("blue")} title="设为蓝色" />
              <button className="swatch swatch-red" type="button" onClick={() => styleSelectedObject("red")} title="设为红色" />
              <button className="swatch swatch-gray" type="button" onClick={() => styleSelectedObject("gray")} title="设为灰色" />
              <button type="button" onClick={() => styleSelectedObject("bold")}>加粗</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className={`render-log render-log-${renderLogState.tone}`}>
        <span className="render-log-summary">{renderLogState.summary}</span>
      </div>
    </section>
  );
}

function ApiKeySettings() {
  const [settings, setSettings] = useState(() => readApiSettings());
  const [isOpen, setIsOpen] = useState(false);
  const [draftSettings, setDraftSettings] = useState(settings);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const modalRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const modal = modalRef.current;
    modal?.querySelector("input, button, a")?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
        window.setTimeout(() => triggerRef.current?.focus(), 0);
        return;
      }
      if (event.key !== "Tab" || !modal) return;
      const focusable = [...modal.querySelectorAll("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
        .filter((element) => !element.disabled);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

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
      model: draftSettings.model.trim(),
      supportsVision: draftSettings.supportsVision ?? null
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
      model: provider.model,
      supportsVision: provider.supportsVisionByDefault
    }));
  }

  async function testConnection() {
    setConnectionStatus("");
    if (!draftSettings.apiKey.trim()) {
      setConnectionStatus("请先填写 API Key。");
      return;
    }
    setIsTestingConnection(true);
    try {
      const response = await fetch("/api/provider/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-OpenAI-API-Key": draftSettings.apiKey.trim(),
          ...(draftSettings.baseUrl.trim() ? { "X-OpenAI-Base-URL": draftSettings.baseUrl.trim() } : {}),
          ...(draftSettings.model.trim() ? { "X-OpenAI-Model": draftSettings.model.trim() } : {})
        },
        body: JSON.stringify({})
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "连接测试失败。");
      setDraftSettings((current) => ({ ...current, supportsVision: payload.supportsVision ?? current.supportsVision }));
      setConnectionStatus(`连接成功：${payload.model || "默认模型"}`);
    } catch (error) {
      setConnectionStatus(error.message || "连接测试失败。");
    } finally {
      setIsTestingConnection(false);
    }
  }

  return (
    <div className="api-key-entry">
      <button
        ref={triggerRef}
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
            ref={modalRef}
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
            <p className="modal-note">API Key 保存在当前浏览器；发起解析时会经过本站后端转发，但服务端不会持久化。图片题需要选择支持视觉输入的模型。</p>
            {connectionStatus ? <p className="connection-status" role="status">{connectionStatus}</p> : null}
            <div className="api-key-actions">
              <button className="secondary-button" type="button" onClick={() => setDraftSettings(defaultApiSettings)}>
                清空
              </button>
              <button className="secondary-button" type="button" onClick={testConnection} disabled={isTestingConnection}>
                {isTestingConnection ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
                {isTestingConnection ? "正在测试" : "测试连接"}
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
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [ocrConfirmed, setOcrConfirmed] = useState(true);
  const [ocrUncertainties, setOcrUncertainties] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const forceReparseRef = useRef(false);

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
    setOcrConfirmed(false);
    setOcrUncertainties([]);
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
    setOcrConfirmed(true);
    setOcrUncertainties([]);
  }

  async function recognizeImage() {
    if (!image) return;
    setError("");
    setNotice("");
    setIsRecognizing(true);
    try {
      const form = new FormData();
      form.append("image", image);
      form.append("text", activeText);
      const apiSettings = readApiSettings();
      const headers = {};
      if (apiSettings.apiKey) headers["X-OpenAI-API-Key"] = apiSettings.apiKey;
      if (apiSettings.baseUrl) headers["X-OpenAI-Base-URL"] = apiSettings.baseUrl;
      if (apiSettings.model) headers["X-OpenAI-Model"] = apiSettings.model;
      const response = await fetch("/api/recognize", { method: "POST", body: form, headers });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "题目图片识别失败。");
      if (payload.recognizedText) setActiveText(payload.recognizedText);
      setOcrUncertainties(Array.isArray(payload.uncertainties) ? payload.uncertainties : []);
      setNotice("请校对识别文字，确认后再生成绘图方案。");
      recordDiagnostic({ traceId: payload.traceId, stage: "recognize", status: "success" });
    } catch (recognizeError) {
      setError(recognizeError.message || "题目图片识别失败。");
    } finally {
      setIsRecognizing(false);
    }
  }

  function getVisionModelError() {
    if (!image) return "";
    const settings = readApiSettings();
    return settings.supportsVision === false
      ? "当前连接测试结果显示该模型不支持图片理解。请在 API 设置中换用视觉模型并重新测试连接。"
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
    if (image && !ocrConfirmed) {
      setError("请先识别并确认题目文字，再生成绘图方案。");
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
      const apiSettings = readApiSettings();
      const selectedProvider = providerPresets.find((provider) => provider.baseUrl === apiSettings.baseUrl)?.id || "custom";
      const cacheKey = createHistoryCacheKey({
        text: activeText,
        imageFingerprint,
        promptVersion: PROMPT_VERSION,
        templateVersion: TEMPLATE_VERSION,
        schemaVersion: SOLVE_SCHEMA_VERSION,
        validatorVersion: VALIDATOR_VERSION,
        provider: selectedProvider,
        model: apiSettings.model
      });
      const cachedItem = forceReparseRef.current
        ? null
        : findHistoryCacheHit(history, cacheKey, { text: activeText, hasImage: Boolean(image) });
      if (cachedItem) {
        onReuseHistory(cachedItem);
        setNotice("已读取本地历史解析结果，未重复调用模型。");
        return;
      }

      const form = new FormData();
      form.append("text", activeText);
      if (image) form.append("image", image);
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
      recordDiagnostic({
        traceId: payload.traceId,
        stage: "solve",
        status: "success",
        mathType: payload.mathType,
        semanticStatus: payload.semanticReport?.status || "unchecked"
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      forceReparseRef.current = false;
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
            <p>解析题目 · 生成图像 · 动态演示</p>
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
        {image && !ocrConfirmed ? (
          <div className="ocr-review">
            <div>
              <strong>题图文字校对</strong>
              <p>{isRecognizing ? "正在识别题目..." : "识别后请检查公式、上下标和点名。"}</p>
            </div>
            <div className="ocr-actions">
              <button className="secondary-button" type="button" onClick={recognizeImage} disabled={isRecognizing}>
                {isRecognizing ? <Loader2 className="spin" size={15} /> : <FileImage size={15} />}
                {isRecognizing ? "正在识别" : "识别题目"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  if (!activeText.trim()) {
                    setError("识别文字不能为空。");
                    return;
                  }
                  setOcrConfirmed(true);
                  setNotice("题目文字已确认，可以生成绘图方案。");
                }}
                disabled={!activeText.trim() || isRecognizing}
              >
                <CheckCircle2 size={15} />
                确认识别文字
              </button>
            </div>
            {ocrUncertainties.length ? (
              <ul className="ocr-uncertainties">
                {ocrUncertainties.map((item, index) => (
                  <li key={`${item.text}-${index}`}>
                    <strong>{item.text || "疑似内容"}</strong>
                    <span>{item.reason}{item.suggestion ? `；建议：${item.suggestion}` : ""}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="error-box">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        {notice ? <div className="success-box"><CheckCircle2 size={16} /><span>{notice}</span></div> : null}

        <div className="solve-actions">
          <button className="primary-button" type="submit" disabled={isSubmitting} onClick={() => { forceReparseRef.current = false; }}>
            {isSubmitting ? <Loader2 className="spin" size={18} /> : <ChevronRight size={18} />}
            {isSubmitting ? "正在理解题目" : "使用历史结果或解析"}
          </button>
          <button className="secondary-button" type="submit" disabled={isSubmitting} onClick={() => { forceReparseRef.current = true; }}>
            <RefreshCw size={16} />
            重新解析
          </button>
        </div>
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
  onOpenHistory,
  onToggleDynamicCandidate,
  onUpdateTeachingNotes,
  activeStepId,
  onSelectStep
}) {
  const commandCount = result?.ggbCommands?.length || 0;
  const [editableSteps, setEditableSteps] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState("");
  const [notesHidden, setNotesHidden] = useState(false);
  const [editableConclusion, setEditableConclusion] = useState("");
  const [editableReasons, setEditableReasons] = useState("");

  useEffect(() => {
    setEditableSteps(result?.constructionSteps?.map(getConstructionStepText).join("\n") || "");
    setEditableConclusion(result?.teachingNotes?.conclusion || "");
    setEditableReasons((result?.teachingNotes?.keyReasons || []).map((reason) => reason.text).join("\n"));
    setRegenerateError("");
  }, [result]);

  async function regenerateCommands() {
    if (!result) return;
    const constructionSteps = normalizeEditableSteps(editableSteps, result?.constructionSteps || []);

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
                含 {result.dynamicControls.length} 个动态参数，可直接拖动演示。
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
            <div className="step-links" aria-label="构造步骤与图形联动">
              {(result.constructionSteps || []).map((step, index) => (
                <button
                  className={activeStepId === step.id ? "is-active" : ""}
                  key={step.id || index}
                  type="button"
                  onClick={() => onSelectStep?.(step)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
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

          {result.dynamicCandidates?.length ? (
            <div className="dynamic-candidates">
              <h3>可选动态演示</h3>
              {result.dynamicCandidates.map((candidate) => (
                <div className="dynamic-candidate" key={candidate.name}>
                  <div>
                    <strong>{candidate.label || candidate.description || candidate.name}</strong>
                    <p>{candidate.reason || "启用后可用滑动条观察图形变化。"}</p>
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => onToggleDynamicCandidate(candidate.name)}
                  >
                    {candidate.enabled ? "关闭动态" : "启用动态"}
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {result.teachingNotes?.conclusion || result.teachingNotes?.keyReasons?.length ? (
            <div className="teaching-notes">
              <div className="block-heading">
                <h3>结论与关键依据（可编辑）</h3>
                <button className="quiet-text-button" type="button" onClick={() => setNotesHidden((value) => !value)}>
                  {notesHidden ? "显示" : "隐藏"}
                </button>
              </div>
              {!notesHidden ? (
                <>
                  <textarea
                    value={editableConclusion}
                    onChange={(event) => setEditableConclusion(event.target.value)}
                    aria-label="题目结论"
                    placeholder="题目结论"
                  />
                  <textarea
                    value={editableReasons}
                    onChange={(event) => setEditableReasons(event.target.value)}
                    aria-label="关键依据"
                    placeholder="每行一条关键依据"
                  />
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => onUpdateTeachingNotes({
                      ...result.teachingNotes,
                      conclusion: editableConclusion.trim(),
                      keyReasons: editableReasons.split("\n").map((text, index) => ({
                        id: result.teachingNotes.keyReasons?.[index]?.id || `reason-${index + 1}`,
                        text: text.trim(),
                        objectLabels: result.teachingNotes.keyReasons?.[index]?.objectLabels || []
                      })).filter((reason) => reason.text)
                    })}
                  >
                    保存讲解内容
                  </button>
                </>
              ) : null}
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
              <span>{item.title || item.projectTitle || item.result.problemSummary || item.promptText || "历史解析"}</span>
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
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector("button, input, textarea, select, a[href]")?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
        .filter((element) => !element.disabled);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} className="workspace-dialog" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
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

function HistoryDialog({
  history,
  onSelect,
  onDelete,
  onToggleFavorite,
  onRename,
  onDuplicate,
  onClose,
  onExportProjects,
  onImportProjects,
  onExportDiagnostics
}) {
  const [query, setQuery] = useState("");
  const importInputRef = useRef(null);
  const visibleHistory = history.filter((item) => (
    `${item.title || ""} ${item.promptText || ""} ${item.chapter || ""} ${(item.tags || []).join(" ")}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  ));
  return (
    <DialogFrame title="全部记录" onClose={onClose}>
      <div className="history-toolbar">
        <label className="object-search">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索题目、章节或标签" />
        </label>
        <button className="secondary-button" type="button" onClick={onExportProjects}>导出项目备份</button>
        <button className="secondary-button" type="button" onClick={() => importInputRef.current?.click()}>导入项目备份</button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) await onImportProjects(file);
            event.target.value = "";
          }}
        />
        <button className="secondary-button" type="button" onClick={onExportDiagnostics}>导出诊断报告</button>
      </div>
      <div className="dialog-history-list">
        {visibleHistory.length ? visibleHistory.map((item) => (
          <div className="history-row" key={item.id}>
            <button
              className="history-item"
              type="button"
              onClick={() => {
                onSelect(item);
                onClose();
              }}
            >
              <CheckCircle2 size={15} />
              <span>{item.title || item.projectTitle || item.result?.problemSummary || item.promptText || "历史解析"}</span>
            </button>
            <button className={item.favorite ? "is-favorite" : ""} type="button" onClick={() => onToggleFavorite(item)} title="收藏">
              <Star size={15} />
            </button>
            <button type="button" onClick={() => onRename(item)} title="重命名">
              <PencilRuler size={15} />
            </button>
            <button type="button" onClick={() => onDuplicate(item)} title="复制为新项目">
              <Copy size={15} />
            </button>
            <button type="button" onClick={() => onDelete(item)} title="删除">
              <Trash2 size={15} />
            </button>
          </div>
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
  const [isTeachingMode, setIsTeachingMode] = useState(false);
  const [activeStep, setActiveStep] = useState(null);
  const [currentProjectId, setCurrentProjectId] = useState("");
  const savedVersionSignatureRef = useRef("");

  const latestResult = useMemo(() => result, [result]);

  useEffect(() => {
    migrateLegacyHistory(readHistory())
      .then((projects) => {
        if (projects.length) setHistory(projects);
      })
      .catch(() => {
        // localStorage history remains available when IndexedDB is blocked.
      });
  }, []);

  useEffect(() => {
    if (!currentProjectId || !latestResult) return;
    const signature = JSON.stringify({
      id: currentProjectId,
      commands: latestResult.ggbCommands,
      steps: latestResult.constructionSteps,
      controls: latestResult.dynamicControls
    });
    if (savedVersionSignatureRef.current === signature) return;
    savedVersionSignatureRef.current = signature;
    const project = history.find((item) => item.id === currentProjectId);
    if (!project) return;
    const version = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), result: latestResult };
    const updated = {
      ...project,
      result: latestResult,
      versions: [...(project.versions || []), version].slice(-20)
    };
    void saveProject(updated).catch(() => {});
  }, [currentProjectId, latestResult, history]);

  function createHistoryTitle(nextResult, metadata = {}) {
    const source = nextResult?.problemSummary || metadata.promptText || "历史解析";
    return source.length > 28 ? `${source.slice(0, 28)}...` : source;
  }

  function handleSolved(nextResult, metadata) {
    const normalizedResult = normalizeSolveResultV2(nextResult, {
      sourceText: metadata?.promptText || nextResult?.recognizedProblemText || ""
    });
    setResult({ ...nextResult, ...normalizedResult, rejectedCommands: nextResult.rejectedCommands || [], semanticReport: nextResult.semanticReport });
    const historyItem = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      title: createHistoryTitle(normalizedResult, metadata),
      ...metadata,
      result: { ...nextResult, ...normalizedResult, rejectedCommands: nextResult.rejectedCommands || [] }
    };
    const nextHistory = [historyItem, ...history];
    setHistory(nextHistory);
    writeHistory(nextHistory);
    setCurrentProjectId(historyItem.id);
    void saveProject(historyItem).catch(() => {});
  }

  function selectHistory(item) {
    setActiveText(item.promptText || "");
    const normalized = normalizeSolveResultV2(item.result, {
      sourceText: item.promptText || item.result?.recognizedProblemText || "",
      fromCache: true
    });
    setResult({ ...item.result, ...normalized, rejectedCommands: item.result?.rejectedCommands || [] });
    setCurrentProjectId(item.id);
  }

  function updateCommands(commands) {
    const normalizedCommands = normalizeStyleCommandTargets(commands);
    setResult((current) => current
      ? {
        ...current,
        ggbCommands: normalizedCommands,
        rejectedCommands: [],
        dynamicControls: mergeDynamicControls({
          commands: normalizedCommands,
          dynamicControls: current.dynamicControls
        }),
        objectManifest: normalizeSolveResultV2({
          ...current,
          ggbCommands: normalizedCommands
        }, { sourceText: current.recognizedProblemText }).objectManifest
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
        problemContract: latestResult.problemContract,
        viewport: latestResult.viewport,
        constructionSteps
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "重新生成命令失败。");
    }

    setResult((current) => current ? {
      ...current,
      ...payload,
      problemSummary: current.problemSummary,
      mathType: current.mathType,
      problemContract: current.problemContract,
      recognizedProblemText: current.recognizedProblemText
    } : payload);
  }

  async function repairCommands(repairContext) {
    if (!latestResult) return;

    const apiSettings = readApiSettings();
    const headers = { "Content-Type": "application/json" };
    if (apiSettings.apiKey) headers["X-OpenAI-API-Key"] = apiSettings.apiKey;
    if (apiSettings.baseUrl) headers["X-OpenAI-Base-URL"] = apiSettings.baseUrl;
    if (apiSettings.model) headers["X-OpenAI-Model"] = apiSettings.model;

    const response = await fetch("/api/repair", {
      method: "POST",
      headers,
      body: JSON.stringify({
        currentResult: latestResult,
        attempt: repairContext?.attempt || 1,
        runtimeReport: {
          issues: repairContext?.issues || [],
          failedCommands: repairContext?.failedCommands || [],
          objectNames: repairContext?.objectNames || [],
          viewMode: repairContext?.viewMode || ""
        }
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "自动修复命令失败。");
    }

    setResult((current) => current ? {
      ...current,
      ...payload,
      problemSummary: current.problemSummary,
      mathType: current.mathType,
      problemContract: current.problemContract,
      recognizedProblemText: current.recognizedProblemText
    } : payload);
  }

  async function semanticReview(reviewPayload) {
    const apiSettings = readApiSettings();
    const headers = { "Content-Type": "application/json" };
    if (apiSettings.apiKey) headers["X-OpenAI-API-Key"] = apiSettings.apiKey;
    if (apiSettings.baseUrl) headers["X-OpenAI-Base-URL"] = apiSettings.baseUrl;
    if (apiSettings.model) headers["X-OpenAI-Model"] = apiSettings.model;
    const response = await fetch("/api/semantic-review", {
      method: "POST",
      headers,
      body: JSON.stringify(reviewPayload)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "复杂图形复核失败。");
    return payload;
  }

  function toggleDynamicCandidate(name) {
    setResult((current) => {
      if (!current) return current;
      const dynamicCandidates = (current.dynamicCandidates || []).map((candidate) => (
        candidate.name === name ? { ...candidate, enabled: !candidate.enabled } : candidate
      ));
      const enabledNames = new Set(dynamicCandidates.filter((candidate) => candidate.enabled).map((candidate) => candidate.name));
      const allControls = mergeDynamicControls({
        commands: current.ggbCommands,
        dynamicControls: [
          ...(current.dynamicControls || []),
          ...dynamicCandidates.map((candidate) => ({
            name: candidate.name,
            description: candidate.label || candidate.description,
            min: candidate.min,
            max: candidate.max,
            step: candidate.step
          }))
        ]
      });
      return {
        ...current,
        dynamicCandidates,
        dynamicControls: allControls.filter((control) => enabledNames.has(control.name))
      };
    });
  }

  function updateTeachingNotes(teachingNotes) {
    setResult((current) => current ? { ...current, teachingNotes } : current);
  }

  async function removeHistoryItem(item) {
    const nextHistory = history.filter((project) => project.id !== item.id);
    setHistory(nextHistory);
    writeHistory(nextHistory);
    await deleteProject(item.id).catch(() => {});
    if (currentProjectId === item.id) setCurrentProjectId("");
  }

  async function toggleFavorite(item) {
    const updated = { ...item, favorite: !item.favorite };
    const nextHistory = history.map((project) => project.id === item.id ? updated : project);
    setHistory(nextHistory);
    await saveProject(updated).catch(() => {});
  }

  async function renameProject(item) {
    const title = window.prompt("输入新的项目名称", item.title || item.result?.problemSummary || "");
    if (!title?.trim()) return;
    const updated = { ...item, title: title.trim() };
    const nextHistory = history.map((project) => project.id === item.id ? updated : project);
    setHistory(nextHistory);
    writeHistory(nextHistory);
    await saveProject(updated).catch(() => {});
  }

  async function duplicateProject(item) {
    const duplicated = {
      ...item,
      id: crypto.randomUUID(),
      title: `${item.title || item.result?.problemSummary || "未命名题目"}（副本）`,
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      versions: [...(item.versions || [])]
    };
    const saved = await saveProject(duplicated).catch(() => duplicated);
    const nextHistory = [saved, ...history];
    setHistory(nextHistory);
    writeHistory(nextHistory);
  }

  async function restoreProjectBackup(file) {
    const projects = parseProjectBackup(await file.text());
    const restored = await importProjects(projects);
    setHistory(restored);
    writeHistory(restored.slice(0, 8));
  }

  return (
    <main className={`app-shell${isTeachingMode ? " teaching-mode" : ""}`}>
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
        onToggleDynamicCandidate={toggleDynamicCandidate}
        onUpdateTeachingNotes={updateTeachingNotes}
        activeStepId={activeStep?.id || ""}
        onSelectStep={setActiveStep}
      />
      <GeoGebraCanvas
        result={latestResult}
        renderRequest={renderRequest}
        onRepairCommands={repairCommands}
        onSemanticReview={semanticReview}
        isTeachingMode={isTeachingMode}
        onToggleTeachingMode={() => setIsTeachingMode((value) => !value)}
        onStepSelection={setActiveStep}
        selectedStep={activeStep}
      />
      {isCommandOpen ? (
        <CommandDialog
          result={latestResult}
          onUpdateCommands={updateCommands}
          onClose={() => setIsCommandOpen(false)}
        />
      ) : null}
      {isHistoryOpen ? (
        <HistoryDialog
          history={history}
          onSelect={selectHistory}
          onDelete={removeHistoryItem}
          onToggleFavorite={toggleFavorite}
          onRename={renameProject}
          onDuplicate={duplicateProject}
          onExportProjects={() => downloadTextFile(createProjectBackup(history), `geogebra-ai-projects-${new Date().toISOString().slice(0, 10)}.json`)}
          onImportProjects={restoreProjectBackup}
          onExportDiagnostics={() => downloadTextFile(createDiagnosticReport(), `geogebra-ai-diagnostics-${new Date().toISOString().slice(0, 10)}.json`)}
          onClose={() => setIsHistoryOpen(false)}
        />
      ) : null}
    </main>
  );
}

const rootElement = document.getElementById("root");
const reactRoot = globalThis.__GGB_AI_REACT_ROOT__ || createRoot(rootElement);
globalThis.__GGB_AI_REACT_ROOT__ = reactRoot;
reactRoot.render(<App />);
