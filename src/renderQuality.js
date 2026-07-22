const STYLE_COMMAND_PATTERN = /^\s*(?:Set|ShowLabel)/i;
const ASSIGNMENT_PATTERN = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/;
const LABELED_EQUATION_PATTERN = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*:/;
const MEASUREMENT_COMMAND_PATTERN = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*(Area|Distance|Angle)\s*[\[(]/i;
const INTERSECT_COMMAND_PATTERN = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*Intersect\s*[\[(]/i;

function normalizeCommand(command) {
  return String(command ?? "").trim();
}

function getLabeledObjects(commands) {
  return commands.flatMap((rawCommand) => {
    const command = normalizeCommand(rawCommand);
    const equationMatch = command.match(LABELED_EQUATION_PATTERN);
    if (equationMatch) return [equationMatch[1]];

    const assignmentMatch = command.match(ASSIGNMENT_PATTERN);
    if (!assignmentMatch) return [];

    const [, label, expression] = assignmentMatch;
    if (/^Slider\s*[\[(]/i.test(expression)) return [];
    if (/^[0-9+\-*/^().\sπ°a-z_]+$/i.test(expression) && !/[\[(]/.test(expression)) return [];
    return [label];
  });
}

function getMeasurementLabels(commands) {
  return commands.flatMap((rawCommand) => {
    const match = normalizeCommand(rawCommand).match(MEASUREMENT_COMMAND_PATTERN);
    return match ? [{ label: match[1], type: match[2].toLowerCase() }] : [];
  });
}

function getIntersectionLabels(commands) {
  return commands.flatMap((rawCommand) => {
    const match = normalizeCommand(rawCommand).match(INTERSECT_COMMAND_PATTERN);
    return match ? [match[1]] : [];
  });
}

function isEssentialCommandFailure(entry) {
  return !entry?.ok && !STYLE_COMMAND_PATTERN.test(normalizeCommand(entry?.command));
}

function hasDefinedObject(api, label, objectNames) {
  if (!label) return false;
  if (objectNames.includes(label)) return true;
  try {
    return typeof api?.isDefined !== "function" || api.isDefined(label);
  } catch {
    return false;
  }
}

function getNumericValue(api, label) {
  try {
    if (typeof api?.getValue === "function") {
      const value = api.getValue(label);
      return Number.isFinite(value) ? value : null;
    }
  } catch {
    return null;
  }
  return null;
}

function getPointCoordinates(api, label) {
  try {
    if (typeof api?.getXcoord === "function" && typeof api?.getYcoord === "function") {
      const x = api.getXcoord(label);
      const y = api.getYcoord(label);
      if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
    }
  } catch {
    return null;
  }
  return null;
}

function findCoincidentIntersections({ api, labels }) {
  const coordinates = labels
    .map((label) => ({ label, coordinates: getPointCoordinates(api, label) }))
    .filter((item) => item.coordinates);
  const coincident = [];

  for (let i = 0; i < coordinates.length; i += 1) {
    for (let j = i + 1; j < coordinates.length; j += 1) {
      const first = coordinates[i];
      const second = coordinates[j];
      const distance = Math.hypot(
        first.coordinates.x - second.coordinates.x,
        first.coordinates.y - second.coordinates.y
      );
      if (distance < 1e-5) {
        coincident.push(`${first.label}/${second.label}`);
      }
    }
  }

  return coincident;
}

export function assessRenderQuality({ api, commands, commandResults, dynamicControls, objectNames }) {
  const safeCommands = Array.isArray(commands) ? commands : [];
  const safeResults = Array.isArray(commandResults) ? commandResults : [];
  const safeControls = Array.isArray(dynamicControls) ? dynamicControls : [];
  const safeObjectNames = Array.isArray(objectNames) ? objectNames : [];
  const issues = [];

  const essentialFailures = safeResults.filter(isEssentialCommandFailure);
  if (essentialFailures.length) {
    issues.push(`有 ${essentialFailures.length} 条关键构造未成功执行`);
  }

  const expectedLabels = [...new Set(getLabeledObjects(safeCommands))];
  const missingLabels = expectedLabels.filter((label) => !hasDefinedObject(api, label, safeObjectNames));
  if (missingLabels.length) {
    issues.push(`缺少关键对象：${missingLabels.slice(0, 5).join("、")}${missingLabels.length > 5 ? "等" : ""}`);
  }

  const missingControls = safeControls
    .map((control) => control.name)
    .filter((name) => !hasDefinedObject(api, name, safeObjectNames));
  if (missingControls.length) {
    issues.push(`动态参数未生成：${missingControls.join("、")}`);
  }

  const invalidMeasurements = getMeasurementLabels(safeCommands).filter(({ label }) => {
    const value = getNumericValue(api, label);
    return value === null || Math.abs(value) < 1e-8;
  });
  if (invalidMeasurements.length) {
    issues.push(`关键度量可能退化：${invalidMeasurements.map((item) => item.label).slice(0, 4).join("、")}`);
  }

  const coincidentIntersections = findCoincidentIntersections({
    api,
    labels: getIntersectionLabels(safeCommands)
  });
  if (coincidentIntersections.length) {
    issues.push(`交点疑似重合：${coincidentIntersections.slice(0, 3).join("、")}`);
  }

  const visibleObjectCount = safeObjectNames.length || expectedLabels.length - missingLabels.length;
  if (!visibleObjectCount && safeResults.length) {
    issues.push("没有检测到可见 GeoGebra 对象");
  }

  return {
    ok: issues.length === 0,
    tone: issues.length ? "warn" : "ok",
    checked: Boolean(safeResults.length),
    issueCount: issues.length,
    issues,
    expectedObjectCount: expectedLabels.length,
    visibleObjectCount,
    essentialFailureCount: essentialFailures.length
  };
}
