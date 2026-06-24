const triangularPrismEdges = [
  ["edgeAB", "A", "B"], ["edgeBC", "B", "C"], ["edgeCA", "C", "A"],
  ["edgeA1B1", "A1", "B1"], ["edgeB1C1", "B1", "C1"], ["edgeC1A1", "C1", "A1"],
  ["edgeAA1", "A", "A1"], ["edgeBB1", "B", "B1"], ["edgeCC1", "C", "C1"]
];

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

export function enhanceSolidGeometryCommands({ mathType, commands }) {
  if (mathType !== "solid_geometry" || !Array.isArray(commands)) return commands;

  const enhanced = [...commands];
  const labels = new Set(
    commands.flatMap((command) => {
      const match = command.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=/);
      return match ? [match[1]] : [];
    })
  );

  const prismVertices = new Set(triangularPrismEdges.flatMap(([, first, second]) => [first, second]));
  if ([...prismVertices].every((label) => labels.has(label))) {
    for (const [edgeLabel, first, second] of triangularPrismEdges) {
      if (!hasSegment(enhanced, first, second)) {
        enhanced.push(`${edgeLabel}=Segment(${first},${second})`);
        enhanced.push(`SetColor(${edgeLabel},31,41,55)`);
        enhanced.push(`SetLineThickness(${edgeLabel},4)`);
      }
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
        enhanced.push(`SetFilling(${faceLabel},0.06)`);
        enhanced.push(`SetColor(${faceLabel},14,116,144)`);
      }
    }
  }

  if (labels.has("D") && labels.has("E") && !hasCommand(enhanced, /^\s*SetLineThickness\s*[\[(]\s*DE\s*,/i)) {
    enhanced.push("SetLineThickness(DE,5)");
  }

  return enhanced;
}
