const SLIDER_VALUE_PATTERN = "([^,]+)";
const ASSIGNED_SLIDER_PATTERN = new RegExp(`^\\s*([A-Za-z][A-Za-z0-9_]*)\\s*=\\s*Slider\\s*\\(\\s*${SLIDER_VALUE_PATTERN}\\s*,\\s*${SLIDER_VALUE_PATTERN}\\s*,\\s*${SLIDER_VALUE_PATTERN}(?:\\s*,[\\s\\S]*)?\\)\\s*$`, "i");
const LEGACY_SLIDER_PATTERN = new RegExp(`^\\s*Slider\\s*\\(\\s*([A-Za-z][A-Za-z0-9_]*)\\s*,\\s*${SLIDER_VALUE_PATTERN}\\s*,\\s*${SLIDER_VALUE_PATTERN}\\s*,\\s*${SLIDER_VALUE_PATTERN}(?:\\s*,[\\s\\S]*)?\\)\\s*$`, "i");

function parseSliderNumber(value) {
  const text = String(value ?? "").trim().toLowerCase().replaceAll("π", "pi").replace(/\s+/g, "");
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return numeric;

  if (text === "pi" || text === "+pi") return Math.PI;
  if (text === "-pi") return -Math.PI;

  const multipleOfPi = text.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))?\*?pi$/);
  if (multipleOfPi) {
    const coefficient = multipleOfPi[1] === undefined || multipleOfPi[1] === "+" ? 1 : Number(multipleOfPi[1]);
    return coefficient * Math.PI;
  }

  const piOver = text.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+)?)?\*?pi\/((?:\d+(?:\.\d+)?|\.\d+))$/);
  if (piOver) {
    const coefficient = piOver[1] === undefined || piOver[1] === "" || piOver[1] === "+" ? 1 : Number(piOver[1]);
    const divisor = Number(piOver[2]);
    return coefficient * Math.PI / divisor;
  }

  return Number.NaN;
}

function normalizeControl(control) {
  const name = String(control?.name ?? "").trim();
  const min = Number(control?.min);
  const max = Number(control?.max);
  const step = Number(control?.step);

  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)
    || !Number.isFinite(min)
    || !Number.isFinite(max)
    || !Number.isFinite(step)
    || min === max
    || step <= 0) {
    return null;
  }

  return {
    name,
    description: String(control?.description ?? "").trim(),
    min,
    max,
    step
  };
}

function inferDescription(name, commands) {
  if (/theta|angle|alpha/i.test(name)) return "角度";

  const pointOnSlider = commands.find((command) => {
    const text = String(command);
    const pointMatch = text.match(/^\s*([A-Z][A-Za-z0-9_]*)\s*=\s*\(([\s\S]+)\)\s*$/);
    return pointMatch && new RegExp(`\\b${name}\\b`).test(pointMatch[2]);
  });

  const pointName = pointOnSlider?.match(/^\s*([A-Z][A-Za-z0-9_]*)\s*=/)?.[1];
  if (pointName) {
    const tangentUsesPoint = commands.some((command) => (
      new RegExp(`=\\s*Tangent\\s*[\\[(]\\s*${pointName}\\s*,`, "i").test(String(command))
    ));
    if (tangentUsesPoint) return `切点 ${pointName} 的位置`;
  }
  if (pointName) return `动点 ${pointName} 的位置`;
  if (/^k$/i.test(name)) return "直线斜率";
  if (/^b$/i.test(name)) return "直线截距";
  return `参数 ${name}`;
}

export function extractSliderControls(commands) {
  if (!Array.isArray(commands)) return [];

  return commands.flatMap((command) => {
    const match = String(command).match(ASSIGNED_SLIDER_PATTERN) || String(command).match(LEGACY_SLIDER_PATTERN);
    if (!match) return [];

    const [, name, minExpression, maxExpression, stepExpression] = match;
    const min = parseSliderNumber(minExpression);
    const max = parseSliderNumber(maxExpression);
    const step = parseSliderNumber(stepExpression);
    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step)) return [];

    return [{
      name,
      description: inferDescription(name, commands),
      min,
      max,
      step
    }];
  });
}

export function mergeDynamicControls({ commands, dynamicControls }) {
  const merged = new Map();

  for (const control of Array.isArray(dynamicControls) ? dynamicControls : []) {
    const normalized = normalizeControl(control);
    if (normalized) merged.set(normalized.name, normalized);
  }

  for (const control of extractSliderControls(commands)) {
    if (!merged.has(control.name)) {
      merged.set(control.name, control);
    }
  }

  return Array.from(merged.values());
}
