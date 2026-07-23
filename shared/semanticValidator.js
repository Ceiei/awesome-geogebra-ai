import { analyzeGgbCommands, parseGgbCommand } from "./ggbCommandParser.js";
import { hasSameLockedContract } from "./solveResultV2.js";

const TOLERANCE = 1e-5;

function normalizeExpression(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll(" ", "")
    .replaceAll("＝", "=")
    .replaceAll("²", "^2")
    .replaceAll("³", "^3")
    .replaceAll("[", "(")
    .replaceAll("]", ")");
}

function commandText(commands) {
  return normalizeExpression((commands || []).join("\n"));
}

function compileArithmeticExpression(expression) {
  let source = normalizeExpression(expression)
    .replace(/\bpi\b/g, `(${Math.PI})`)
    .replace(/(\d|\))(?=[xyz(])/g, "$1*")
    .replace(/([xyz])(?=\d|\()/g, "$1*")
    .replace(/\^/g, "**");
  if (!/^[0-9xyz+\-*/().\s]+$/.test(source)) return null;
  try {
    return Function("x", "y", "z", `"use strict"; return (${source});`);
  } catch {
    return null;
  }
}

function equationSignature(equation) {
  const cleaned = normalizeExpression(equation).replace(/^[a-z][a-z0-9_]*:/, "");
  const [left, right, ...rest] = cleaned.split("=");
  if (!left || !right || rest.length) return null;
  const leftFn = compileArithmeticExpression(left);
  const rightFn = compileArithmeticExpression(right);
  if (!leftFn || !rightFn) return null;
  const samples = [[-2, -1, 0.5], [-1, 2, -0.5], [0.5, 1.5, 2], [2, -3, 1], [3, 0.25, -2]];
  try {
    const values = samples.map(([x, y, z]) => leftFn(x, y, z) - rightFn(x, y, z));
    return values.every(Number.isFinite) ? values : null;
  } catch {
    return null;
  }
}

function signaturesAreProportional(first, second) {
  if (!first || !second || first.length !== second.length) return false;
  let ratio = null;
  for (let index = 0; index < first.length; index += 1) {
    const a = first[index];
    const b = second[index];
    if (Math.abs(a) <= TOLERANCE && Math.abs(b) <= TOLERANCE) continue;
    if (Math.abs(a) <= TOLERANCE || Math.abs(b) <= TOLERANCE) return false;
    const nextRatio = a / b;
    if (ratio === null) ratio = nextRatio;
    if (Math.abs(nextRatio - ratio) > TOLERANCE * Math.max(1, Math.abs(ratio))) return false;
  }
  return ratio !== null;
}

function fixedExpressionIsPreserved(expression, commands, text) {
  const normalized = normalizeExpression(expression);
  const sides = normalized.split("=");
  if (text.includes(normalized) || (sides.length === 2 && text.includes(`${sides[1]}=${sides[0]}`))) return true;
  const expected = equationSignature(normalized);
  if (!expected) return false;
  return (commands || []).some((command) => signaturesAreProportional(expected, equationSignature(command)));
}

function definedLabels(commands) {
  return new Set((commands || []).map(parseGgbCommand).map((entry) => entry.label).filter(Boolean));
}

function matchesRequiredObject(objectName, objectManifest, labels, contract) {
  const normalized = normalizeExpression(objectName);
  const directMatch = objectManifest.some((item) => normalizeExpression(`${item.teacherName}${item.objectType}${item.label}`).includes(normalized));
  if (directMatch) return true;
  if (["椭圆", "抛物线", "双曲线", "曲线", "函数"].some((name) => normalized.includes(name))) {
    return objectManifest.some((item) => ["Equation", "Function", "equation", "function"].includes(item.objectType))
      && (contract?.fixedExpressions || []).length > 0;
  }
  if (normalized.includes("焦点")) return [...labels].some((label) => /^F\d*$/i.test(label));
  if (normalized.includes("准线")) return [...labels].some((label) => /directrix|准线/i.test(label));
  if (normalized.includes("三角形")) {
    return objectManifest.some((item) => item.objectType === "Polygon" && /三角形/.test(item.teacherName));
  }
  if (normalized.includes("平面")) return objectManifest.some((item) => item.objectType === "Plane");
  return false;
}

function checkVectorRelation(constraint, objectStates) {
  const [firstName, secondName] = constraint.objects || [];
  const first = objectStates?.[firstName];
  const second = objectStates?.[secondName];
  if (!first?.vector || !second?.vector) return null;
  const a = first.vector;
  const b = second.vector;
  if (constraint.type === "perpendicular") {
    const dot = a.reduce((sum, value, index) => sum + value * (b[index] || 0), 0);
    return Math.abs(dot) <= TOLERANCE;
  }
  if (constraint.type === "parallel") {
    if (a.length === 2 && b.length === 2) return Math.abs(a[0] * b[1] - a[1] * b[0]) <= TOLERANCE;
    const cross = [
      (a[1] || 0) * (b[2] || 0) - (a[2] || 0) * (b[1] || 0),
      (a[2] || 0) * (b[0] || 0) - (a[0] || 0) * (b[2] || 0),
      (a[0] || 0) * (b[1] || 0) - (a[1] || 0) * (b[0] || 0)
    ];
    return Math.hypot(...cross) <= TOLERANCE;
  }
  return null;
}

function getCoordinates(objectStates, label) {
  const coordinates = objectStates?.[label]?.coordinates;
  return Array.isArray(coordinates) && coordinates.every(Number.isFinite) ? coordinates : null;
}

function subtract(first, second, dimension = Math.max(first.length, second.length)) {
  return Array.from({ length: dimension }, (_, index) => (first[index] || 0) - (second[index] || 0));
}

function cross(first, second) {
  return [
    (first[1] || 0) * (second[2] || 0) - (first[2] || 0) * (second[1] || 0),
    (first[2] || 0) * (second[0] || 0) - (first[0] || 0) * (second[2] || 0),
    (first[0] || 0) * (second[1] || 0) - (first[1] || 0) * (second[0] || 0)
  ];
}

function checkCoordinateConstraint(constraint, objectStates) {
  const objects = constraint.objects || [];
  if (constraint.type === "midpoint" && objects.length >= 3) {
    const [middle, first, second] = objects.map((label) => getCoordinates(objectStates, label));
    if (!middle || !first || !second) return null;
    return middle.every((value, index) => Math.abs(value - ((first[index] || 0) + (second[index] || 0)) / 2) <= TOLERANCE);
  }
  if (constraint.type === "collinear" && objects.length >= 3) {
    const [first, second, third] = objects.map((label) => getCoordinates(objectStates, label));
    if (!first || !second || !third) return null;
    return Math.hypot(...cross(subtract(second, first, 3), subtract(third, first, 3))) <= TOLERANCE;
  }
  if (constraint.type === "coplanar" && objects.length >= 4) {
    const [first, second, third, fourth] = objects.map((label) => getCoordinates(objectStates, label));
    if (!first || !second || !third || !fourth) return null;
    const normal = cross(subtract(second, first, 3), subtract(third, first, 3));
    const offset = subtract(fourth, first, 3);
    const triple = normal.reduce((sum, value, index) => sum + value * offset[index], 0);
    return Math.abs(triple) <= TOLERANCE;
  }
  return null;
}

export function validateSemanticContract({
  contract,
  mathType,
  commands,
  objectManifest = [],
  originalContract = contract,
  objectStates = {}
}) {
  const issues = [];
  const analysis = analyzeGgbCommands(commands);
  const labels = definedLabels(commands);
  const text = commandText(commands);

  if (!hasSameLockedContract(originalContract, contract)) {
    issues.push({ code: "contract_changed", message: "题目合同被修改", severity: "error" });
  }
  if (contract?.mathType && mathType !== contract.mathType) {
    issues.push({ code: "math_type_drift", message: "绘图题型与原题不一致", severity: "error" });
  }
  for (const expression of contract?.fixedExpressions || []) {
    const preserved = fixedExpressionIsPreserved(expression, commands, text);
    if (!preserved) {
      issues.push({ code: "fixed_expression_missing", message: `缺少原题固定关系：${expression}`, severity: "error" });
    }
  }
  for (const label of contract?.requiredLabels || []) {
    if (!labels.has(label)) {
      issues.push({ code: "required_label_missing", message: `缺少关键对象 ${label}`, severity: "error", label });
    }
  }
  for (const objectName of contract?.requiredObjects || []) {
    const normalized = normalizeExpression(objectName);
    if (!matchesRequiredObject(objectName, objectManifest, labels, contract) && !text.includes(normalized)) {
      issues.push({ code: "required_object_missing", message: `缺少原题对象：${objectName}`, severity: "error" });
    }
  }
  for (const item of analysis.syntaxErrors) {
    issues.push({ code: "command_syntax", message: "存在无法解析的构造命令", severity: "error", command: item });
  }
  for (const item of analysis.unresolved) {
    issues.push({ code: "dependency_order", message: `对象 ${item.label} 在定义前被使用`, severity: "error", command: item.command });
  }
  for (const label of analysis.duplicateLabels) {
    issues.push({ code: "duplicate_label", message: `对象 ${label} 被重复定义`, severity: "error", label });
  }

  for (const constraint of contract?.constraints || []) {
    const relationResult = checkVectorRelation(constraint, objectStates);
    if (relationResult === false) {
      issues.push({ code: `constraint_${constraint.type}`, message: constraint.description || "图中数学关系不满足原题", severity: "error" });
      continue;
    }
    const coordinateResult = checkCoordinateConstraint(constraint, objectStates);
    if (coordinateResult === false) {
      issues.push({ code: `constraint_${constraint.type}`, message: constraint.description || "图中点的位置关系不满足原题", severity: "error" });
      continue;
    }
    if (constraint.type === "equal_length") {
      const [firstName, secondName] = constraint.objects || [];
      const first = objectStates?.[firstName]?.value;
      const second = objectStates?.[secondName]?.value;
      if (Number.isFinite(first) && Number.isFinite(second) && Math.abs(first - second) > TOLERANCE) {
        issues.push({ code: "constraint_equal_length", message: constraint.description || "图中长度关系不满足原题", severity: "error" });
      }
    }
    if (constraint.type === "nonzero") {
      const value = objectStates?.[constraint.objects?.[0]]?.value;
      if (Number.isFinite(value) && Math.abs(value) <= TOLERANCE) {
        issues.push({ code: "constraint_degenerate", message: constraint.description || "关键度量发生退化", severity: "error" });
      }
    }
  }

  return {
    ok: issues.length === 0,
    status: issues.length ? "failed" : "passed",
    issues,
    requiresSemanticReview: (contract?.constraints || []).some((item) => (
      item.type === "described"
      || (mathType === "solid_geometry" && !["parallel", "perpendicular", "equal_length", "nonzero"].includes(item.type))
    )),
    commandCount: (commands || []).length,
    objectCount: labels.size
  };
}

export function createRepairLock(result) {
  return {
    problemSummary: result.problemSummary,
    mathType: result.mathType,
    problemContract: structuredClone(result.problemContract),
    recognizedProblemText: result.recognizedProblemText
  };
}

export function applyRepairWithinLock(current, repaired, lock = createRepairLock(current)) {
  return {
    ...current,
    ggbCommands: Array.isArray(repaired?.ggbCommands) ? repaired.ggbCommands : current.ggbCommands,
    objectManifest: Array.isArray(repaired?.objectManifest) ? repaired.objectManifest : current.objectManifest,
    dynamicCandidates: Array.isArray(repaired?.dynamicCandidates) ? repaired.dynamicCandidates : current.dynamicCandidates,
    dynamicControls: Array.isArray(repaired?.dynamicControls) ? repaired.dynamicControls : current.dynamicControls,
    viewport: repaired?.viewport || current.viewport,
    problemSummary: lock.problemSummary,
    mathType: lock.mathType,
    problemContract: structuredClone(lock.problemContract),
    recognizedProblemText: lock.recognizedProblemText
  };
}
