const triangularPrismEdges = [
  ["edgeAB", "A", "B"], ["edgeBC", "B", "C"], ["edgeCA", "C", "A"],
  ["edgeA1B1", "A1", "B1"], ["edgeB1C1", "B1", "C1"], ["edgeC1A1", "C1", "A1"],
  ["edgeAA1", "A", "A1"], ["edgeBB1", "B", "B1"], ["edgeCC1", "C", "C1"]
];

const quadrilateralPrismEdges = [
  ["edgeAB", "A", "B"], ["edgeBC", "B", "C"], ["edgeCD", "C", "D"], ["edgeDA", "D", "A"],
  ["edgeA1B1", "A1", "B1"], ["edgeB1C1", "B1", "C1"], ["edgeC1D1", "C1", "D1"], ["edgeD1A1", "D1", "A1"],
  ["edgeAA1", "A", "A1"], ["edgeBB1", "B", "B1"], ["edgeCC1", "C", "C1"], ["edgeDD1", "D", "D1"]
];

const cubeLetterEdges = [
  ["edgeAB", "A", "B"], ["edgeBC", "B", "C"], ["edgeCD", "C", "D"], ["edgeDA", "D", "A"],
  ["edgeEF", "E", "F"], ["edgeFG", "F", "G"], ["edgeGH", "G", "H"], ["edgeHE", "H", "E"],
  ["edgeAE", "A", "E"], ["edgeBF", "B", "F"], ["edgeCG", "C", "G"], ["edgeDH", "D", "H"]
];

const squarePyramidEdges = [
  ["edgeAB", "A", "B"], ["edgeBC", "B", "C"], ["edgeCD", "C", "D"], ["edgeDA", "D", "A"],
  ["edgeSA", "S", "A"], ["edgeSB", "S", "B"], ["edgeSC", "S", "C"], ["edgeSD", "S", "D"]
];

const SOLID_FACE_FILLING = 0.04;
const EDGE_COLOR = "31,41,55";
const AUXILIARY_FACE_COLOR = "14,116,144";

function hasCommand(commands, expression) {
  return commands.some((command) => expression.test(command));
}

function hasSegment(commands, first, second) {
  const labels = [first, second];
  return labels.some((start, index) => {
    const end = labels[1 - index];
    return hasCommand(commands, new RegExp(`(?:^|=)\\s*Segment\\s*[\\[(]\\s*${start}\\s*,\\s*${end}\\s*[\\])]`, "i"));
  });
}

function getAssignedPlaneLabels(commands) {
  return commands.flatMap((command) => {
    const match = command.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*Plane\s*[\[(]\s*([A-Za-z][A-Za-z0-9_]*)\s*,\s*([A-Za-z][A-Za-z0-9_]*)\s*,\s*([A-Za-z][A-Za-z0-9_]*)\s*[\])]/i);
    return match ? [{ label: match[1], points: match.slice(2) }] : [];
  });
}

function getAssignedPolygonLabels(commands) {
  return commands.flatMap((command) => {
    const match = command.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*Polygon\s*[\[(]\s*([^)]+?)\s*[\])]\s*$/i);
    if (!match) return [];

    return [{ label: match[1], points: normalizePointList(match[2]) }];
  });
}

function normalizePointList(source) {
  return source.split(",").map((point) => point.trim()).filter(Boolean);
}

function canonicalFaceKey(points) {
  return [...points].sort().join("|");
}

function normalizeSolidCommand(command, assignedPolygonFaces) {
  if (isDuplicatePointTextLabel(command)) return null;

  const unlabeledPolygon = command.match(/^\s*Polygon\s*[\[(]\s*([^)]+?)\s*[\])]\s*$/i);
  if (unlabeledPolygon) {
    const faceKey = canonicalFaceKey(normalizePointList(unlabeledPolygon[1]));
    if (assignedPolygonFaces.has(faceKey)) return null;
  }

  const filling = command.match(/^SetFilling\s*[\[(]\s*([A-Za-z][A-Za-z0-9_]*)\s*,\s*(\d+(?:\.\d+)?)\s*[\])]\s*$/i);
  if (filling) {
    const [, label, value] = filling;
    const nextValue = Math.min(Number(value), SOLID_FACE_FILLING);
    return `SetFilling(${label},${nextValue})`;
  }

  return command;
}

function toGeoGebraSubscriptLabel(label) {
  return String(label).replace(/\d/g, (digit) => "₀₁₂₃₄₅₆₇₈₉"[Number(digit)]);
}

function isDuplicatePointTextLabel(command) {
  const match = command.match(/^\s*Text\s*[\[(]\s*"([^"]+)"\s*,\s*([A-Za-z][A-Za-z0-9_]*)\s*,\s*true\s*[\])]\s*$/i);
  if (!match) return false;

  const [, text, objectName] = match;
  const normalizedText = text.trim();
  return normalizedText === objectName || normalizedText === toGeoGebraSubscriptLabel(objectName);
}

function addEdgeTemplate(enhanced, labels, requiredLabels, edgeTemplate) {
  if (!requiredLabels.every((label) => labels.has(label))) return;

  for (const [edgeLabel, first, second] of edgeTemplate) {
    if (!hasSegment(enhanced, first, second)) {
      enhanced.push(`${edgeLabel}=Segment(${first},${second})`);
      enhanced.push(`SetColor(${edgeLabel},${EDGE_COLOR})`);
      enhanced.push(`SetLineThickness(${edgeLabel},4)`);
      enhanced.push(`ShowLabel(${edgeLabel},false)`);
    }
  }
}

export function enhanceSolidGeometryCommands({ mathType, commands }) {
  if (mathType !== "solid_geometry" || !Array.isArray(commands)) return commands;

  const assignedPolygonFaces = new Set(getAssignedPolygonLabels(commands).map((polygon) => canonicalFaceKey(polygon.points)));
  const enhanced = commands
    .map((command) => normalizeSolidCommand(command, assignedPolygonFaces))
    .filter(Boolean);
  const labels = new Set(
    enhanced.flatMap((command) => {
      const match = command.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=/);
      return match ? [match[1]] : [];
    })
  );
  const pointLabels = new Set(
    enhanced.flatMap((command) => {
      const match = command.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*\(/);
      return match ? [match[1]] : [];
    })
  );

  addEdgeTemplate(enhanced, labels, ["A", "B", "C", "A1", "B1", "C1"], triangularPrismEdges);
  addEdgeTemplate(enhanced, labels, ["A", "B", "C", "D", "A1", "B1", "C1", "D1"], quadrilateralPrismEdges);
  addEdgeTemplate(enhanced, labels, ["A", "B", "C", "D", "E", "F", "G", "H"], cubeLetterEdges);
  addEdgeTemplate(enhanced, labels, ["A", "B", "C", "D", "S"], squarePyramidEdges);

  for (const label of pointLabels) {
    if (!hasCommand(enhanced, new RegExp(`^\\s*ShowLabel\\s*[\\[(]\\s*${label}\\s*,`, "i"))) {
      enhanced.push(`ShowLabel(${label},true)`);
    }
  }

  for (const plane of getAssignedPlaneLabels(commands)) {
    if (!hasCommand(enhanced, new RegExp(`^\\s*SetVisible\\s*[\\[(]\\s*${plane.label}\\s*,\\s*false`, "i"))) {
      enhanced.push(`SetVisible(${plane.label},false)`);
    }

    const oppositePoint = plane.points.find((point) => (
      !point.endsWith("1")
        && labels.has(`${point}1`)
        && !plane.points.includes(`${point}1`)
    ));
    if (oppositePoint) {
      const faceLabel = `face${plane.label.replace(/[^A-Za-z0-9_]/g, "")}`;
      const facePoints = [...plane.points, `${oppositePoint}1`];
      if (!hasCommand(enhanced, new RegExp(`^\\s*${faceLabel}\\s*=\\s*Polygon`, "i"))) {
        enhanced.push(`${faceLabel}=Polygon(${facePoints.join(",")})`);
        enhanced.push(`SetFilling(${faceLabel},${SOLID_FACE_FILLING})`);
        enhanced.push(`SetColor(${faceLabel},${AUXILIARY_FACE_COLOR})`);
        enhanced.push(`ShowLabel(${faceLabel},false)`);
      }
    }
  }

  if (labels.has("D") && labels.has("E") && !hasCommand(enhanced, /^\s*SetLineThickness\s*[\[(]\s*DE\s*,/i)) {
    enhanced.push("SetLineThickness(DE,5)");
  }

  return enhanced;
}
