import { parseGgbCommand } from "./ggbCommandParser.js";

export const SOLVE_SCHEMA_VERSION = 2;
export const PROMPT_VERSION = "2026-07-23-teacher-v4";
export const TEMPLATE_VERSION = "2026-07-23-parameterized-v4";
export const VALIDATOR_VERSION = "2026-07-23-semantic-v3";

const MATH_TYPES = new Set(["geometry", "function", "analytic_geometry", "solid_geometry"]);

function uniqueStrings(values) {
  return [...new Set((values || []).map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function normalizeRole(role) {
  const roles = new Set(["original", "key", "conclusion", "helper", "trajectory", "region", "measurement", "parameter", "hidden"]);
  return roles.has(role) ? role : "original";
}

const POINT_COMMANDS = new Set(["Center", "Intersect", "Midpoint", "Point", "Vertex"]);

function inferTeacherName(entry) {
  const label = entry.label;
  const command = entry.commandName;
  if (entry.kind === "point" || POINT_COMMANDS.has(command)) return `点 ${label}`;
  if (entry.kind === "function") return `函数 ${label}`;
  if (entry.kind === "equation") return `曲线 ${label}`;
  if (command === "Segment") return `线段 ${entry.args.filter((arg) => /^[A-Za-z][A-Za-z0-9_]*$/.test(arg)).join("") || label}`;
  if (command === "Polygon") {
    const vertices = entry.args.filter((arg) => /^[A-Za-z][A-Za-z0-9_]*$/.test(arg));
    return `${vertices.length === 3 ? "三角形" : "多边形"} ${vertices.join("") || label}`;
  }
  if (command === "Plane") return `平面 ${label}`;
  if (command === "Line" || command === "OrthogonalLine" || command === "PerpendicularLine") return `直线 ${label}`;
  if (command === "Locus") return `轨迹 ${label}`;
  if (command === "Area") return `面积 ${label}`;
  if (command === "Distance") return `距离 ${label}`;
  if (command === "Angle") return `角 ${label}`;
  if (command === "Slider") return `参数 ${label}`;
  return `对象 ${label}`;
}

function inferObjectRole(entry) {
  if (entry.commandName === "Slider") return "parameter";
  if (entry.commandName === "Locus") return "trajectory";
  if (entry.commandName === "Polygon") return "region";
  if (["Area", "Distance", "Angle"].includes(entry.commandName)) return "measurement";
  if (/helper|height|foot|projection|aux|directrix|vertical/i.test(entry.label)) return "helper";
  if (/plane/i.test(entry.label)) return "hidden";
  if ((entry.kind !== "point" && POINT_COMMANDS.has(entry.commandName)) || ["Tangent", "AngleBisector"].includes(entry.commandName)) return "key";
  return "original";
}

export function buildObjectManifest(commands, provided = []) {
  const providedByLabel = new Map((provided || []).map((item) => [String(item?.label || ""), item]));
  const manifest = [];
  for (const command of commands || []) {
    const parsed = parseGgbCommand(command);
    if (!parsed.label || parsed.kind === "style") continue;
    const supplied = providedByLabel.get(parsed.label) || {};
    manifest.push({
      label: parsed.label,
      teacherName: String(supplied.teacherName || inferTeacherName(parsed)),
      objectType: String(supplied.objectType || (parsed.kind === "point" || POINT_COMMANDS.has(parsed.commandName) ? "Point" : parsed.commandName || parsed.kind)),
      role: normalizeRole(supplied.role || inferObjectRole(parsed)),
      dependencies: uniqueStrings(supplied.dependencies?.length ? supplied.dependencies : parsed.dependencies),
      stepId: String(supplied.stepId || ""),
      stage: Math.max(1, Number(supplied.stage) || 1),
      visible: supplied.visible !== false,
      draggable: supplied.draggable !== false && parsed.kind === "point"
    });
  }
  return [...new Map(manifest.map((item) => [item.label, item])).values()];
}

function normalizeSteps(steps, manifest) {
  const labels = manifest.map((item) => item.label);
  return (Array.isArray(steps) ? steps : []).map((step, index) => {
    if (typeof step === "string") {
      return {
        id: `step-${index + 1}`,
        text: step.trim(),
        objectLabels: labels.filter((label) => new RegExp(`(^|[^A-Za-z0-9_])${label}([^A-Za-z0-9_]|$)`).test(step)),
        stage: index + 1
      };
    }
    return {
      id: String(step?.id || `step-${index + 1}`),
      text: String(step?.text || step?.description || "").trim(),
      objectLabels: uniqueStrings(step?.objectLabels),
      stage: Math.max(1, Number(step?.stage) || index + 1)
    };
  }).filter((step) => step.text);
}

function extractEquationCandidates(text) {
  const normalized = String(text || "").replace(/[；。]/g, ";");
  const expressions = [];
  for (const part of normalized.split(/[;\n]/)) {
    if (!/[=＝]/.test(part)) continue;
    const match = part.match(/([A-Za-z0-9₀-₉²³^+\-*/().\s]+[=＝][A-Za-z0-9₀-₉²³^+\-*/().\s]+)/);
    if (match) expressions.push(match[1].replace(/\s+/g, "").replace("＝", "="));
  }
  return uniqueStrings(expressions);
}

function inferRequiredLabels(text, commands) {
  const source = String(text || "");
  const labels = [...source.matchAll(/(?<![A-Za-z0-9_])([A-Z](?:[₀-₉1-9])?)(?![A-Za-z0-9_])/g)].map((match) => (
    match[1].replace(/[₁1]$/, "1").replace(/[₂2]$/, "2").replace(/[₃3]$/, "3")
  ));
  const defined = new Set((commands || []).map(parseGgbCommand).map((entry) => entry.label).filter(Boolean));
  return uniqueStrings(labels).filter((label) => defined.has(label) || labels.filter((item) => item === label).length > 1);
}

export function buildProblemContract({ text, mathType, commands, rawContract = {} }) {
  const sourceText = String(text || rawContract.originalText || "").trim();
  return {
    version: 1,
    originalText: sourceText,
    mathType: MATH_TYPES.has(mathType) ? mathType : "geometry",
    fixedExpressions: uniqueStrings(rawContract.fixedExpressions?.length ? rawContract.fixedExpressions : extractEquationCandidates(sourceText)),
    requiredLabels: uniqueStrings(rawContract.requiredLabels?.length ? rawContract.requiredLabels : inferRequiredLabels(sourceText, commands)),
    requiredObjects: uniqueStrings(rawContract.requiredObjects),
    constraints: Array.isArray(rawContract.constraints) ? rawContract.constraints.map((item, index) => ({
      id: String(item?.id || `constraint-${index + 1}`),
      type: String(item?.type || "described"),
      objects: uniqueStrings(item?.objects),
      value: item?.value ?? null,
      expression: String(item?.expression || ""),
      description: String(item?.description || "")
    })) : [],
    targets: uniqueStrings(rawContract.targets),
    locked: true
  };
}

function normalizeDynamicControl(control) {
  const min = Number(control?.min);
  const max = Number(control?.max);
  const step = Number(control?.step);
  const defaultValue = Number(control?.defaultValue);
  return {
    name: String(control?.name || "").trim(),
    label: String(control?.label || control?.description || control?.name || "").trim(),
    description: String(control?.description || control?.label || "").trim(),
    min,
    max,
    step,
    defaultValue: Number.isFinite(defaultValue) ? defaultValue : (Number.isFinite(min) && Number.isFinite(max) ? (min + max) / 2 : 0),
    unit: String(control?.unit || ""),
    affectedObjects: uniqueStrings(control?.affectedObjects)
  };
}

export function normalizeSolveResultV2(raw, { sourceText = "", model = "", provider = "", fromCache = false } = {}) {
  const result = raw && typeof raw === "object" ? raw : {};
  const mathType = MATH_TYPES.has(result.mathType) ? result.mathType : "geometry";
  const commands = Array.isArray(result.ggbCommands) ? result.ggbCommands.map(String).map((item) => item.trim()).filter(Boolean) : [];
  let objectManifest = buildObjectManifest(commands, result.objectManifest);
  const constructionSteps = normalizeSteps(result.constructionSteps, objectManifest);
  const stepByLabel = new Map();
  for (const step of constructionSteps) {
    for (const label of step.objectLabels) {
      if (!stepByLabel.has(label)) stepByLabel.set(label, step);
    }
  }
  objectManifest = objectManifest.map((object) => {
    const step = stepByLabel.get(object.label);
    return step && !object.stepId
      ? { ...object, stepId: step.id, stage: step.stage }
      : object;
  });
  const problemContract = buildProblemContract({
    text: sourceText || result.recognizedProblemText || result.problemContract?.originalText || result.problemSummary,
    mathType,
    commands,
    rawContract: result.problemContract
  });
  const controls = (Array.isArray(result.dynamicControls) ? result.dynamicControls : [])
    .map(normalizeDynamicControl)
    .filter((item) => item.name)
    .map(({ name, description, min, max, step }) => ({ name, description, min, max, step }));
  const hasExplicitCandidates = Array.isArray(result.dynamicCandidates);
  const candidatesSource = hasExplicitCandidates
    ? result.dynamicCandidates
    : controls.map((control) => ({ ...control, enabled: true }));
  const dynamicCandidates = candidatesSource.map((item) => ({
    ...normalizeDynamicControl(item),
    enabled: true,
    reason: String(item?.reason || item?.description || "")
  })).filter((item) => item.name).slice(0, 2);
  const dynamicControls = [...new Map([
    ...controls,
    ...dynamicCandidates.map((candidate) => ({
      name: candidate.name,
      description: candidate.label || candidate.description,
      min: candidate.min,
      max: candidate.max,
      step: candidate.step
    }))
  ].map((control) => [control.name, control])).values()];

  return {
    schemaVersion: SOLVE_SCHEMA_VERSION,
    recognizedProblemText: String(result.recognizedProblemText || sourceText || problemContract.originalText || "").trim(),
    problemSummary: String(result.problemSummary || "").trim(),
    mathType,
    problemContract,
    constructionSteps,
    objectManifest,
    ggbCommands: commands,
    dynamicCandidates,
    dynamicControls,
    teachingNotes: {
      conclusion: String(result.teachingNotes?.conclusion || ""),
      keyReasons: (Array.isArray(result.teachingNotes?.keyReasons) ? result.teachingNotes.keyReasons : []).slice(0, 5).map((item, index) => ({
        id: String(item?.id || `reason-${index + 1}`),
        text: String(item?.text || item || ""),
        objectLabels: uniqueStrings(item?.objectLabels)
      })),
      observationPrompt: String(result.teachingNotes?.observationPrompt || "")
    },
    viewport: result.viewport,
    generationMeta: {
      promptVersion: PROMPT_VERSION,
      templateVersion: String(result.generationMeta?.templateVersion || TEMPLATE_VERSION),
      validatorVersion: VALIDATOR_VERSION,
      model: String(result.generationMeta?.model || model || ""),
      provider: String(result.generationMeta?.provider || provider || ""),
      templateId: String(result.generationMeta?.templateId || ""),
      generatedAt: String(result.generationMeta?.generatedAt || new Date().toISOString()),
      fromCache: Boolean(result.generationMeta?.fromCache || fromCache)
    },
    warnings: uniqueStrings(result.warnings),
    followupQuestion: result.followupQuestion ? String(result.followupQuestion) : null
  };
}

export function hasSameLockedContract(first, second) {
  const normalize = (contract) => JSON.stringify({
    originalText: String(contract?.originalText || "").trim(),
    mathType: contract?.mathType || "",
    fixedExpressions: uniqueStrings(contract?.fixedExpressions).sort(),
    requiredLabels: uniqueStrings(contract?.requiredLabels).sort(),
    requiredObjects: uniqueStrings(contract?.requiredObjects).sort(),
    constraints: contract?.constraints || [],
    targets: uniqueStrings(contract?.targets).sort()
  });
  return normalize(first) === normalize(second);
}
