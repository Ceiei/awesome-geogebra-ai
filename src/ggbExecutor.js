function normalizeOuterCommandBrackets(command) {
  const trimmed = String(command ?? "").trim();
  const match = trimmed.match(/^(\s*(?:[A-Za-z][A-Za-z0-9_]*\s*=\s*)?[A-Za-z][A-Za-z0-9_]*)\s*\[([\s\S]*)\]\s*$/);
  return match ? `${match[1]}(${match[2]})` : trimmed;
}

function isDefined(api, label) {
  return typeof api.isDefined !== "function" || api.isDefined(label);
}

const namedColors = new Map([
  ["black", [0, 0, 0]], ["dark gray", [80, 80, 80]], ["gray", [128, 128, 128]],
  ["dark blue", [0, 0, 128]], ["blue", [0, 0, 255]], ["dark green", [0, 100, 0]],
  ["green", [0, 128, 0]], ["maroon", [128, 0, 0]], ["crimson", [220, 20, 60]],
  ["red", [255, 0, 0]], ["magenta", [255, 0, 255]], ["indigo", [75, 0, 130]],
  ["purple", [128, 0, 128]], ["brown", [165, 42, 42]], ["orange", [255, 165, 0]],
  ["gold", [255, 215, 0]], ["lime", [0, 255, 0]], ["cyan", [0, 255, 255]],
  ["turquoise", [64, 224, 208]], ["light blue", [173, 216, 230]], ["aqua", [0, 255, 255]],
  ["silver", [192, 192, 192]], ["light gray", [211, 211, 211]], ["pink", [255, 192, 203]],
  ["violet", [238, 130, 238]], ["yellow", [255, 255, 0]], ["light yellow", [255, 255, 224]],
  ["light orange", [255, 200, 124]], ["light violet", [221, 160, 221]],
  ["light purple", [216, 191, 216]], ["light green", [144, 238, 144]], ["white", [255, 255, 255]]
]);

function parseColor(value) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  const namedColor = namedColors.get(normalized);
  if (namedColor) return namedColor;

  const hex = normalized.match(/^#(?:[0-9a-f]{2})?([0-9a-f]{6})$/i);
  if (!hex) return null;

  const integer = Number.parseInt(hex[1], 16);
  return [(integer >> 16) & 255, (integer >> 8) & 255, integer & 255];
}

function executeStyleCommand(api, command) {
  const visibility = command.match(/^SetVisible\(\s*([A-Za-z][A-Za-z0-9_]*)\s*,\s*(true|false)\s*\)$/i);
  if (visibility) {
    const [, label, visible] = visibility;
    if (!isDefined(api, label) || typeof api.setVisible !== "function") return false;
    api.setVisible(label, visible.toLowerCase() === "true");
    return true;
  }

  const labelMode = command.match(/^SetLabel(?:Mode|Style)\(\s*([A-Za-z][A-Za-z0-9_]*)\s*,\s*(\d+)\s*\)$/);
  if (labelMode) {
    const [, label, style] = labelMode;
    if (!isDefined(api, label) || typeof api.setLabelStyle !== "function") return false;
    api.setLabelStyle(label, Number(style));
    api.setLabelVisible?.(label, true);
    return true;
  }

  const showLabel = command.match(/^ShowLabel\(\s*([A-Za-z][A-Za-z0-9_]*)\s*,\s*(true|false)\s*\)$/i);
  if (showLabel) {
    const [, label, visible] = showLabel;
    if (!isDefined(api, label) || typeof api.setLabelVisible !== "function") return false;
    api.setLabelVisible(label, visible.toLowerCase() === "true");
    return true;
  }

  const color = command.match(/^SetColor\(\s*([A-Za-z][A-Za-z0-9_]*)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (color) {
    const [, label, red, green, blue] = color;
    if (!isDefined(api, label) || typeof api.setColor !== "function") return false;
    api.setColor(label, Number(red), Number(green), Number(blue));
    return true;
  }

  const namedColor = command.match(/^SetColor\(\s*([A-Za-z][A-Za-z0-9_]*)\s*,\s*["']([^"']+)["']\s*\)$/);
  if (namedColor) {
    const [, label, colorValue] = namedColor;
    const rgb = parseColor(colorValue);
    if (!rgb || !isDefined(api, label) || typeof api.setColor !== "function") return false;
    api.setColor(label, ...rgb);
    return true;
  }

  const caption = command.match(/^SetCaption\(\s*([A-Za-z][A-Za-z0-9_]*)\s*,\s*["']((?:\\.|[^"'])*)["']\s*\)$/);
  if (caption) {
    const [, label, value] = caption;
    if (!isDefined(api, label) || typeof api.setCaption !== "function") return false;
    api.setCaption(label, value.replace(/\\(["'\\])/g, "$1"));
    return true;
  }

  const fixed = command.match(/^SetFixed\(\s*([A-Za-z][A-Za-z0-9_]*)\s*,\s*(true|false)(?:\s*,\s*(true|false))?\s*\)$/i);
  if (fixed) {
    const [, label, fixedValue, selectionValue] = fixed;
    if (!isDefined(api, label) || typeof api.setFixed !== "function") return false;
    const isFixed = fixedValue.toLowerCase() === "true";
    api.setFixed(label, isFixed, selectionValue ? selectionValue.toLowerCase() === "true" : !isFixed);
    return true;
  }

  const numericStyleCommands = [
    ["SetFilling", "setFilling"],
    ["SetLayer", "setLayer"],
    ["SetLineStyle", "setLineStyle"],
    ["SetLineThickness", "setLineThickness"],
    ["SetPointSize", "setPointSize"],
    ["SetPointStyle", "setPointStyle"]
  ];

  for (const [commandName, apiMethod] of numericStyleCommands) {
    const match = command.match(new RegExp(`^${commandName}\\(\\s*([A-Za-z][A-Za-z0-9_]*)\\s*,\\s*(-?\\d+(?:\\.\\d+)?)\\s*\\)$`));
    if (!match) continue;

    const [, label, value] = match;
    if (!isDefined(api, label) || typeof api[apiMethod] !== "function") return false;
    api[apiMethod](label, Number(value));
    return true;
  }

  return null;
}

export function executeGgbCommand(api, rawCommand) {
  const command = normalizeOuterCommandBrackets(rawCommand);

  try {
    const styleResult = executeStyleCommand(api, command);
    if (styleResult !== null) return { command, ok: styleResult };
    return { command, ok: Boolean(api.evalCommand(command)) };
  } catch {
    return { command, ok: false };
  }
}

export function getExplicitlyHiddenObjectLabels(commands) {
  if (!Array.isArray(commands)) return new Set();

  return new Set(commands.flatMap((rawCommand) => {
    const command = normalizeOuterCommandBrackets(rawCommand);
    const match = command.match(/^SetVisible\(\s*([A-Za-z][A-Za-z0-9_]*)\s*,\s*false\s*\)$/i);
    return match ? [match[1]] : [];
  }));
}

export function get3DCoordinateSystem(viewport) {
  const extent = Math.max(
    4,
    Math.abs(viewport.xmin),
    Math.abs(viewport.xmax),
    Math.abs(viewport.ymin),
    Math.abs(viewport.ymax)
  );

  return [viewport.xmin, viewport.xmax, viewport.ymin, viewport.ymax, -extent, extent, true];
}
