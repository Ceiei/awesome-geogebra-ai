const MAX_COMMAND_LENGTH = 420;
const MAX_COMMANDS = 80;
const LABEL_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const COORDINATE_EXPRESSION_PATTERN = /^[0-9A-Za-z_+\-*/^().\sπ°]+$/;
const allowedCoordinateFunctions = new Set([
  "abs",
  "acos",
  "asin",
  "atan",
  "ceil",
  "cos",
  "exp",
  "floor",
  "ln",
  "log",
  "round",
  "sin",
  "sqrt",
  "tan"
]);

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
  "Locus",
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
  "Slider",
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
  "SetLayer",
  "SetLineStyle",
  "SetLineThickness",
  "SetPointSize",
  "SetPointStyle",
  "SetVisible",
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

function normalizeOuterCommandBrackets(command) {
  const openingBracket = command.indexOf("[");
  if (openingBracket < 0 || !command.endsWith("]")) return command;

  const prefix = command.slice(0, openingBracket).trim();
  if (!/(?:^|=)\s*[A-Za-z][A-Za-z0-9_]*$/.test(prefix)) return command;

  return `${command.slice(0, openingBracket)}(${command.slice(openingBracket + 1, -1)})`;
}

function normalizeSliderCommand(command) {
  const match = command.match(/^\s*Slider\s*\(\s*([A-Za-z][A-Za-z0-9_]*)\s*,\s*([\s\S]+)\)\s*$/);
  if (!match) return command;

  const [, label, rest] = match;
  return `${label}=Slider(${rest.trim()})`;
}

function getCommandCallName(command) {
  const assignmentMatch = command.match(/^\s*(?:[A-Za-z][A-Za-z0-9_]*\s*=\s*)?([A-Za-z][A-Za-z0-9_]*)\s*(?:\(|\[)/);
  return assignmentMatch?.[1] ?? null;
}

function isAssignment(command) {
  const match = command.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=/);
  return Boolean(match && LABEL_PATTERN.test(match[1]));
}

function splitTopLevelArguments(source) {
  const argumentsList = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth < 0) return null;

    if (character === "," && depth === 0) {
      argumentsList.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }

  if (depth !== 0) return null;
  argumentsList.push(source.slice(start).trim());
  return argumentsList;
}

function isSafeCoordinateExpression(expression) {
  if (!expression || !COORDINATE_EXPRESSION_PATTERN.test(expression)) return false;

  const functionNames = expression.matchAll(/([A-Za-z][A-Za-z0-9_]*)\s*\(/g);
  for (const match of functionNames) {
    const rawFunctionName = match[1];
    const functionName = rawFunctionName.toLowerCase();
    if (!allowedCoordinateFunctions.has(functionName) && !/^[a-z][A-Za-z0-9_]*$/.test(rawFunctionName)) return false;
  }

  return true;
}

function looksLikeNumericAssignment(command) {
  const match = command.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/);
  return Boolean(match && LABEL_PATTERN.test(match[1]) && isSafeCoordinateExpression(match[2]));
}

function looksLikePointAssignment(command) {
  const match = command.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*\((.*)\)\s*$/);
  if (!match || !LABEL_PATTERN.test(match[1])) return false;

  const coordinates = splitTopLevelArguments(match[2]);
  return Boolean(
    coordinates
      && (coordinates.length === 2 || coordinates.length === 3)
      && coordinates.every(isSafeCoordinateExpression)
  );
}

function looksLikeFunctionAssignment(command) {
  const match = command.match(/^\s*[a-z][A-Za-z0-9_]*\s*\(\s*x\s*\)\s*=\s*(.+?)\s*$/);
  return Boolean(match && isSafeCoordinateExpression(match[1]));
}

function looksLikeLabeledEquation(command) {
  const match = command.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*([xy])\s*=\s*(.+?)\s*$/i);
  return Boolean(match && LABEL_PATTERN.test(match[1]) && isSafeCoordinateExpression(match[3]));
}

export function validateGgbCommand(command) {
  const normalized = normalizeSliderCommand(normalizeOuterCommandBrackets(stripInlineComment(String(command ?? ""))));

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

  if (
    looksLikePointAssignment(normalized)
    || looksLikeNumericAssignment(normalized)
    || looksLikeFunctionAssignment(normalized)
    || looksLikeLabeledEquation(normalized)
  ) {
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
