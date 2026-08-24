import { parseGgbCommand } from "./ggbCommandParser.js";

const SEMANTIC_MODEL_VERSION = 1;
const GRAPH_VERSION = 1;

const RELATION_PATTERNS = [
  ["parallel", /平行|parallel/i, "平行"],
  ["perpendicular", /垂直|正交|perpendicular|orthogonal/i, "垂直"],
  ["tangent", /相切|切线|tangent/i, "相切或切线"],
  ["intersection", /相交|交点|截交|intersection/i, "相交"],
  ["midpoint", /中点|midpoint/i, "中点"],
  ["projection", /投影|垂足|projection|foot/i, "投影或垂足"],
  ["collinear", /共线|collinear/i, "共线"],
  ["coplanar", /共面|coplanar/i, "共面"],
  ["symmetry", /对称|symmetr/i, "对称"],
  ["distance", /距离|distance/i, "距离"],
  ["angle", /角|angle/i, "角"],
  ["area", /面积|area/i, "面积"],
  ["volume", /体积|volume/i, "体积"],
  ["locus", /轨迹|locus/i, "轨迹"],
  ["extremum", /最大值|最小值|最值|maximum|minimum|extrem/i, "最值"],
  ["function", /函数|function/i, "函数"],
  ["section", /截面|截割|section/i, "截面"]
];

const DYNAMIC_PATTERN = /动点|变化|滑动条|参数|运动|拖动|动态|任意位置|随.+变化|slider|dynamic|locus/i;
const SPACE_PATTERN = /空间|立体|平面角|二面角|棱柱|棱锥|正方体|长方体|球|圆柱|圆锥|多面体|3D/i;
const TARGET_PATTERN = /(?:求|证明|判断|观察|探究|验证|比较|确定)([^。；;\n]+)/g;

function toStepObjects(steps) {
  return (Array.isArray(steps) ? steps : []).map((step, index) => ({
    id: String(step?.id || `step-${index + 1}`),
    text: String(typeof step === "string" ? step : step?.text || "").trim(),
    stage: Number(step?.stage) || index + 1
  })).filter((step) => step.text);
}

function normalizeText(value) {
  return String(value || "")
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (digit) => String("₀₁₂₃₄₅₆₇₈₉".indexOf(digit)))
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function stableHash(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function addFact(facts, fact) {
  const value = normalizeText(fact.value);
  if (!value) return;
  const key = `${fact.category}:${fact.type}:${value.toLowerCase()}`;
  if (!facts.has(key)) facts.set(key, { ...fact, key, value });
}

function extractEquationFacts(text, facts, sourceId) {
  const equationPattern = /(?:[A-Za-z][A-Za-z0-9_]*(?:\([^)]*\))?|[xyz](?:\^?2|²)?(?:\s*[+\-*/]\s*[A-Za-z0-9_.()^²]+)*)\s*[:=]\s*[^，。；;\n]+/g;
  for (const match of text.matchAll(equationPattern)) {
    addFact(facts, { category: "expression", type: "equation", value: match[0], sourceId });
  }
}

function extractQuantityFacts(text, facts, sourceId) {
  const quantityPattern = /(棱长|边长|半径|直径|距离|角度?|面积|体积|斜率|截距|焦距|离心率)\s*(?:为|是|=)?\s*(-?\d+(?:\.\d+)?(?:\s*√\s*\d+)?(?:°|度)?)/g;
  for (const match of text.matchAll(quantityPattern)) {
    addFact(facts, { category: "quantity", type: match[1], value: `${match[1]}=${match[2]}`, sourceId });
  }
}

function extractLabelEntities(text) {
  const labels = new Set();
  for (const match of text.matchAll(/\b([A-Z](?:_?\d+)?)\b/g)) labels.add(match[1]);
  return [...labels];
}

function inferPlaneOrientation(text) {
  if (!/平面|截面|截割|section/i.test(text)) return "";
  if (/任意|方向与位置|方位角|倾角/i.test(text)) return "arbitrary";
  if (/水平(?:平面|截面)|z\s*=\s*[A-Za-z]/i.test(text)) return "horizontal";
  if (/(?:垂直|竖直)(?:平面|截面)|[xy]\s*=\s*[A-Za-z]/i.test(text)) return "vertical";
  return /截面|截割|section/i.test(text) ? "arbitrary" : "";
}

function entityTypeFromCommand(parsed) {
  const command = String(parsed.commandName || "").toLowerCase();
  if (parsed.kind === "point" || ["midpoint", "center", "intersect", "vertex"].includes(command)) return "point";
  if (parsed.kind === "function") return "function";
  if (parsed.kind === "equation") return "equation";
  if (["line", "segment", "ray", "vector", "tangent", "orthogonalline", "perpendicularline", "parallelline"].includes(command)) return "line";
  if (["polygon", "plane", "circle", "conic", "locus"].includes(command)) return "surface";
  if (["cube", "prism", "pyramid", "polyhedron", "sphere", "cylinder", "cone", "tetrahedron"].includes(command)) return "solid";
  if (["slider", "value", "distance", "angle", "area"].includes(command)) return "value";
  return "object";
}

function buildFacts({ sourceText, steps, mathType }) {
  const facts = new Map();
  const stepObjects = toStepObjects(steps);
  const sources = [
    ...(sourceText ? [{ id: "problem", text: normalizeText(sourceText) }] : []),
    ...stepObjects.map((step) => ({ id: step.id, text: normalizeText(step.text) }))
  ];
  const combined = sources.map((source) => source.text).join("\n");

  addFact(facts, {
    category: "dimension",
    type: "space",
    value: mathType === "solid_geometry" || SPACE_PATTERN.test(combined) ? "3d" : "2d",
    sourceId: "problem"
  });
  const orientation = inferPlaneOrientation(combined);
  if (orientation) addFact(facts, { category: "orientation", type: "plane", value: orientation, sourceId: "problem" });

  for (const source of sources) {
    extractEquationFacts(source.text, facts, source.id);
    extractQuantityFacts(source.text, facts, source.id);
    for (const [type, pattern, label] of RELATION_PATTERNS) {
      if (pattern.test(source.text)) addFact(facts, { category: "relation", type, value: label, sourceId: source.id });
    }
    if (DYNAMIC_PATTERN.test(source.text)) {
      addFact(facts, { category: "behavior", type: "dynamic", value: "dynamic", sourceId: source.id });
    }
    for (const match of source.text.matchAll(TARGET_PATTERN)) {
      addFact(facts, { category: "target", type: "goal", value: match[0], sourceId: source.id });
    }
  }
  return [...facts.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function matchStepForCommand(parsed, steps) {
  if (!steps.length) return null;
  const labels = [parsed.label, ...(parsed.dependencies || [])].filter(Boolean);
  return steps.find((step) => labels.some((label) => new RegExp(`(?:^|[^A-Za-z0-9_])${label}(?:$|[^A-Za-z0-9_])`).test(step.text))) || steps[0];
}

export function buildConstructionGraph({ commands = [], constructionSteps = [] } = {}) {
  const steps = toStepObjects(constructionSteps);
  const nodes = (Array.isArray(commands) ? commands : []).map((command, index) => {
    const parsed = parseGgbCommand(command);
    const step = matchStepForCommand(parsed, steps);
    return {
      id: `node-${index + 1}-${stableHash(parsed.raw).slice(0, 6)}`,
      kind: parsed.kind,
      operator: parsed.commandName || "Unknown",
      output: parsed.label || "",
      inputs: parsed.dependencies || [],
      args: parsed.args || [],
      expression: parsed.kind === "value" ? parsed.args?.[0] || "" : "",
      stepId: step?.id || "",
      stage: step?.stage || index + 1,
      validSyntax: Boolean(parsed.validSyntax)
    };
  });
  return { version: GRAPH_VERSION, nodes };
}

export function compileConstructionGraph(graph) {
  const commands = [];
  const errors = [];
  const seenOutputs = new Set();
  for (const node of Array.isArray(graph?.nodes) ? graph.nodes : []) {
    let command = "";
    if (!node.validSyntax || !node.operator) {
      errors.push({ nodeId: node.id, code: "invalid_node", message: "构造节点语法无效" });
      continue;
    }
    if (node.output && seenOutputs.has(node.output)) {
      errors.push({ nodeId: node.id, code: "duplicate_output", message: `对象 ${node.output} 被重复定义` });
      continue;
    }
    if (node.kind === "equation") command = `${node.output}:${node.args[0] || ""}`;
    else if (node.kind === "function") command = `${node.output}(x)=${node.args[0] || ""}`;
    else if (node.kind === "point") command = `${node.output}=(${(node.args || []).join(",")})`;
    else if (node.kind === "value") command = `${node.output}=${node.expression || node.args?.[0] || ""}`;
    else if (node.kind === "construction") command = `${node.output}=${node.operator}(${(node.args || []).join(",")})`;
    else if (node.kind === "style" || node.kind === "command") command = `${node.operator}(${(node.args || []).join(",")})`;
    else errors.push({ nodeId: node.id, code: "unsupported_node", message: `暂不支持节点类型 ${node.kind}` });
    if (!command) continue;
    commands.push(command);
    if (node.output) seenOutputs.add(node.output);
  }
  return { commands, errors, ok: errors.length === 0 };
}

export function createMathematicalModel({ sourceText = "", constructionSteps = [], commands = [], mathType = "geometry" } = {}) {
  const facts = buildFacts({ sourceText, steps: constructionSteps, mathType });
  const commandEntries = (Array.isArray(commands) ? commands : []).map(parseGgbCommand);
  const labels = new Set([
    ...extractLabelEntities(`${sourceText}\n${toStepObjects(constructionSteps).map((step) => step.text).join("\n")}`),
    ...commandEntries.map((entry) => entry.label).filter(Boolean)
  ]);
  const commandByLabel = new Map(commandEntries.filter((entry) => entry.label).map((entry) => [entry.label, entry]));
  const entities = [...labels].sort().map((label) => {
    const parsed = commandByLabel.get(label);
    return {
      id: `entity-${label}`,
      label,
      type: parsed ? entityTypeFromCommand(parsed) : "symbol",
      definition: parsed?.raw || "",
      dependencies: parsed?.dependencies || []
    };
  });
  const parameters = commandEntries.filter((entry) => entry.commandName === "Slider").map((entry) => entry.label).filter(Boolean);
  const targets = facts.filter((fact) => fact.category === "target").map((fact) => fact.value);
  const canonical = { mathType, facts, entities, parameters, targets };
  return {
    version: SEMANTIC_MODEL_VERSION,
    mathType,
    facts,
    entities,
    parameters,
    targets,
    fingerprint: stableHash(canonical)
  };
}

function factGroups(model) {
  const groups = new Map();
  for (const fact of Array.isArray(model?.facts) ? model.facts : []) {
    if (fact.category === "label") continue;
    const key = `${fact.category}:${fact.type}`;
    const values = groups.get(key) || [];
    values.push(fact.value);
    groups.set(key, [...new Set(values)].sort());
  }
  return groups;
}

function categoryName(category, type) {
  const names = {
    dimension: "绘图维度",
    orientation: "方向条件",
    expression: "方程或表达式",
    quantity: "数值条件",
    relation: "数学关系",
    behavior: "动态关系",
    target: "观察或求解目标"
  };
  return names[category] || type || category;
}

export function diffMathematicalModels(previousModel, nextModel) {
  if (!previousModel?.fingerprint || !nextModel?.fingerprint) return { changed: false, changes: [], summary: "" };
  if (previousModel.fingerprint === nextModel.fingerprint) return { changed: false, changes: [], summary: "未检测到数学构造含义变化。" };
  const previous = factGroups(previousModel);
  const next = factGroups(nextModel);
  const changes = [];
  for (const key of new Set([...previous.keys(), ...next.keys()])) {
    const before = previous.get(key) || [];
    const after = next.get(key) || [];
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    const [category, type] = key.split(":");
    const label = categoryName(category, type);
    const message = before.length && after.length
      ? `${label}：${before.join("、")} → ${after.join("、")}`
      : before.length
      ? `移除${label}：${before.join("、")}`
      : `新增${label}：${after.join("、")}`;
    changes.push({ category, type, before, after, message });
  }
  return {
    changed: changes.length > 0,
    changes,
    summary: changes.length ? `已识别 ${changes.length} 项构造含义变化。` : "构造文本发生变化，但数学事实保持一致。"
  };
}

export function buildSemanticConstruction({ sourceText = "", constructionSteps = [], commands = [], mathType = "geometry" } = {}) {
  const mathematicalModel = createMathematicalModel({ sourceText, constructionSteps, commands, mathType });
  const constructionGraph = buildConstructionGraph({ commands, constructionSteps });
  return { mathematicalModel, constructionGraph };
}
