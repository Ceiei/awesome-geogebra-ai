function normalizeOuterCommandBrackets(command) {
  const trimmed = String(command ?? "").trim();
  const match = trimmed.match(/^(\s*(?:[A-Za-z][A-Za-z0-9_]*\s*=\s*)?[A-Za-z][A-Za-z0-9_]*)\s*\[([\s\S]*)\]\s*$/);
  return match ? `${match[1]}(${match[2]})` : trimmed;
}

function isDefined(api, label) {
  return typeof api.isDefined !== "function" || api.isDefined(label);
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

  const numericStyleCommands = [
    ["SetFilling", "setFilling"],
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
