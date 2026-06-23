const MAX_COMMAND_LENGTH = 420;
const MAX_COMMANDS = 80;
const LABEL_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

const allowedCommandNames = new Set([
  "Angle",
  "AngleBisector",
  "Area",
  "Center",
  "Circle",
  "Cone",
  "Cube",
  "Cylinder",
  "Circumcircle",
  "Distance",
  "Function",
  "Intersect",
  "Line",
  "Midpoint",
  "OrthogonalLine",
  "ParallelLine",
  "ParallelPlane",
  "Plane",
  "PerpendicularLine",
  "Point",
  "Polygon",
  "Polyhedron",
  "Prism",
  "Pyramid",
  "Ray",
  "Root",
  "Segment",
  "Semicircle",
  "Sphere",
  "Tangent",
  "Tetrahedron",
  "Text",
  "Vector",
  "Vertex"
]);

const allowedStyleCommands = new Set([
  "SetCaption",
  "SetColor",
  "SetFilling",
  "SetFixed",
  "SetLabelMode",
  "SetLabelStyle",
  "SetLineStyle",
  "SetLineThickness",
  "SetPointSize",
  "SetPointStyle",
  "ShowLabel"
]);

const forbiddenFragments = [
  "javascript:",
  "<script",
  "</script",
  "ggbApplet",
  "eval(",
  "Function(",
  "fetch(",
  "XMLHttpRequest",
  "localStorage",
  "sessionStorage",
  "document.",
  "window.",
  "RunClickScript",
  "RunUpdateScript",
  "SetValue",
  "Execute",
  "Delete",
  "StartAnimation",
  "OpenFile",
  "URL",
  "Button",
  "InputBox"
];

function stripInlineComment(command) {
  return command.replace(/^\s*\/\/.*$/, "").trim();
}

function getCommandCallName(command) {
  const assignmentMatch = command.match(/^\s*(?:[A-Za-z][A-Za-z0-9_]*\s*=\s*)?([A-Za-z][A-Za-z0-9_]*)\s*(?:\(|\[)/);
  return assignmentMatch?.[1] ?? null;
}

function isAssignment(command) {
  const match = command.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=/);
  return Boolean(match && LABEL_PATTERN.test(match[1]));
}

function looksLikePointAssignment(command) {
  return /^\s*[A-Za-z][A-Za-z0-9_]*\s*=\s*\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)?\s*\)\s*$/.test(command);
}

function looksLikeFunctionAssignment(command) {
  return /^\s*[a-z][A-Za-z0-9_]*\s*\(\s*x\s*\)\s*=\s*[-+*/^().\sx\d0-9]+\s*$/.test(command);
}

export function validateGgbCommand(command) {
  const normalized = stripInlineComment(String(command ?? ""));

  if (!normalized) {
    return { ok: false, command: normalized, reason: "空命令" };
  }

  if (normalized.length > MAX_COMMAND_LENGTH) {
    return { ok: false, command: normalized, reason: "命令过长" };
  }

  if (normalized.includes("\n") || normalized.includes("\r")) {
    return { ok: false, command: normalized, reason: "每行只能包含一条命令" };
  }

  if (forbiddenFragments.some((fragment) => normalized.toLowerCase().includes(fragment.toLowerCase()))) {
    return { ok: false, command: normalized, reason: "命令包含被禁止的操作" };
  }

  if (/[{}<>]|;/.test(normalized)) {
    return { ok: false, command: normalized, reason: "命令包含不支持的标点符号" };
  }

  if (looksLikePointAssignment(normalized) || looksLikeFunctionAssignment(normalized)) {
    return { ok: true, command: normalized };
  }

  const name = getCommandCallName(normalized);
  if (!name) {
    return { ok: false, command: normalized, reason: "命令必须是受支持的 GeoGebra 构造命令" };
  }

  if (isAssignment(normalized) && (allowedCommandNames.has(name) || allowedStyleCommands.has(name))) {
    return { ok: true, command: normalized };
  }

  if (allowedCommandNames.has(name) || allowedStyleCommands.has(name)) {
    return { ok: true, command: normalized };
  }

  return { ok: false, command: normalized, reason: `${name} 不在 MVP 命令白名单中` };
}

export function validateGgbCommands(commands) {
  if (!Array.isArray(commands)) {
    return {
      validCommands: [],
      rejectedCommands: [{ command: "", reason: "ggbCommands 必须是数组" }]
    };
  }

  const seen = new Set();
  const validCommands = [];
  const rejectedCommands = [];

  for (const rawCommand of commands.slice(0, MAX_COMMANDS)) {
    const result = validateGgbCommand(rawCommand);
    if (result.ok) {
      if (!seen.has(result.command)) {
        validCommands.push(result.command);
        seen.add(result.command);
      }
    } else {
      rejectedCommands.push({ command: result.command, reason: result.reason });
    }
  }

  if (commands.length > MAX_COMMANDS) {
    rejectedCommands.push({ command: "", reason: `最多只接受前 ${MAX_COMMANDS} 条命令` });
  }

  return { validCommands, rejectedCommands };
}

export function normalizeViewport(viewport) {
  const fallback = { xmin: -8, xmax: 8, ymin: -6, ymax: 6 };
  if (!viewport || typeof viewport !== "object") {
    return fallback;
  }

  const next = {
    xmin: Number(viewport.xmin),
    xmax: Number(viewport.xmax),
    ymin: Number(viewport.ymin),
    ymax: Number(viewport.ymax)
  };

  if (!Object.values(next).every(Number.isFinite)) {
    return fallback;
  }

  if (next.xmin >= next.xmax || next.ymin >= next.ymax) {
    return fallback;
  }

  return next;
}

export const allowedCommandsForPrompt = [...allowedCommandNames, ...allowedStyleCommands].sort();
