export const AREA_FILLING = 0.35;
const AREA_COLOR = "96,165,250";
const HEIGHT_HELPER_COLOR = "37,99,235";
const BASE_HELPER_COLOR = "31,41,55";
const SECANT_HELPER_COLOR = "37,99,235";
const TANGENT_HELPER_COLOR = "220,38,38";
const SLOPE_HELPER_COLOR = "124,58,237";
const LOCUS_HELPER_COLOR = "13,148,136";
const LINE_FAMILY_COLOR = "37,99,235";

function getPolygonLabels(commands) {
  return commands.flatMap((command) => {
    const match = String(command).match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*Polygon\s*[\[(]/i);
    return match ? [match[1]] : [];
  });
}

function getAreaLabels(commands) {
  const polygonLabels = getPolygonLabels(commands);
  return commands.flatMap((command) => {
    const text = String(command);
    const objectArea = text.match(/^\s*[A-Za-z][A-Za-z0-9_]*\s*=\s*Area\s*[\[(]\s*([A-Za-z][A-Za-z0-9_]*)\s*[\])]\s*$/i);
    if (objectArea) return [objectArea[1]];

    const pointsArea = text.match(/^\s*[A-Za-z][A-Za-z0-9_]*\s*=\s*Area\s*[\[(]\s*([A-Za-z][A-Za-z0-9_]*\s*,\s*[A-Za-z][A-Za-z0-9_]*\s*,\s*[A-Za-z][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z][A-Za-z0-9_]*)*)\s*[\])]\s*$/i);
    if (pointsArea) return polygonLabels;

    return [];
  });
}

function isStyleCommandFor(command, label) {
  return new RegExp(`^\\s*Set(?:Filling|Color|LineStyle|LineThickness)\\s*[\\[(]\\s*${label}\\s*,`, "i").test(command);
}

function getSegmentLabels(commands) {
  return commands.flatMap((command) => {
    const match = String(command).match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*Segment\s*[\[(]/i);
    return match ? [match[1]] : [];
  });
}

function getLineLikeLabels(commands) {
  return commands.flatMap((command) => {
    const match = String(command).match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*(?:Line|Segment|Ray|Tangent)\s*[\[(]/i);
    return match ? [match[1]] : [];
  });
}

function getLabeledEquationLineLabels(commands) {
  const hasLineFamilySlider = commands.some((command) => /^\s*[kb]\s*=\s*Slider\s*[\[(]/i.test(String(command)));
  if (!hasLineFamilySlider) return [];

  return commands.flatMap((command) => {
    const match = String(command).match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*[xy]\s*=/i);
    return match ? [match[1]] : [];
  });
}

function getAreaHelperSegmentLabels(commands) {
  const hasAreaTarget = getAreaLabels(commands).length > 0;
  if (!hasAreaTarget) return { heightLabels: [], baseLabels: [] };

  const segmentLabels = getSegmentLabels(commands);
  return {
    heightLabels: segmentLabels.filter((label) => /^(h|height|altitude)$/i.test(label)),
    baseLabels: segmentLabels.filter((label) => /^base$/i.test(label))
  };
}

function getSlopeHelperLabels(commands) {
  const labels = getLineLikeLabels(commands);
  return {
    secantLabels: labels.filter((label) => /^secant/i.test(label)),
    tangentLabels: labels.filter((label) => /^tangent/i.test(label)),
    slopeLabels: labels.filter((label) => /^slope(?:Line)?$/i.test(label))
  };
}

function getLocusHelperLabels(commands) {
  return commands.flatMap((command) => {
    const match = String(command).match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*Locus\s*[\[(]/i);
    return match && /^(locus|path|trace)/i.test(match[1]) ? [match[1]] : [];
  });
}

export function getHighlightedAreaPolygonLabels({ mathType, commands }) {
  if (!Array.isArray(commands) || mathType === "solid_geometry") return [];

  const polygonLabels = getPolygonLabels(commands);
  const areaTargetLabels = new Set(getAreaLabels(commands));
  const shouldHighlightPolygons = areaTargetLabels.size > 0;
  return polygonLabels.filter((label) => shouldHighlightPolygons || /tri|triangle|area/i.test(label));
}

export function enhanceTeachingDiagramCommands({ mathType, commands }) {
  if (!Array.isArray(commands) || mathType === "solid_geometry") return commands;

  const highlightedLabels = getHighlightedAreaPolygonLabels({ mathType, commands });
  const { heightLabels, baseLabels } = getAreaHelperSegmentLabels(commands);
  const { secantLabels, tangentLabels, slopeLabels } = getSlopeHelperLabels(commands);
  const locusLabels = getLocusHelperLabels(commands);
  const equationLineLabels = getLabeledEquationLineLabels(commands);
  const styledLabels = [
    ...highlightedLabels,
    ...heightLabels,
    ...baseLabels,
    ...secantLabels,
    ...tangentLabels,
    ...slopeLabels,
    ...locusLabels,
    ...equationLineLabels
  ];
  const enhanced = commands.filter((command) => !styledLabels.some((label) => isStyleCommandFor(command, label)));

  for (const label of highlightedLabels) {
    enhanced.push(`SetFilling(${label},${AREA_FILLING})`);
    enhanced.push(`SetColor(${label},${AREA_COLOR})`);
    enhanced.push(`SetLineThickness(${label},3)`);
    enhanced.push(`SetLayer(${label},0)`);
  }

  for (const label of heightLabels) {
    enhanced.push(`SetColor(${label},${HEIGHT_HELPER_COLOR})`);
    enhanced.push(`SetLineStyle(${label},2)`);
    enhanced.push(`SetLineThickness(${label},3)`);
  }

  for (const label of baseLabels) {
    enhanced.push(`SetColor(${label},${BASE_HELPER_COLOR})`);
    enhanced.push(`SetLineThickness(${label},4)`);
  }

  for (const label of secantLabels) {
    enhanced.push(`SetColor(${label},${SECANT_HELPER_COLOR})`);
    enhanced.push(`SetLineStyle(${label},2)`);
    enhanced.push(`SetLineThickness(${label},3)`);
  }

  for (const label of tangentLabels) {
    enhanced.push(`SetColor(${label},${TANGENT_HELPER_COLOR})`);
    enhanced.push(`SetLineStyle(${label},0)`);
    enhanced.push(`SetLineThickness(${label},4)`);
  }

  for (const label of slopeLabels) {
    enhanced.push(`SetColor(${label},${SLOPE_HELPER_COLOR})`);
    enhanced.push(`SetLineStyle(${label},2)`);
    enhanced.push(`SetLineThickness(${label},3)`);
  }

  for (const label of locusLabels) {
    enhanced.push(`SetColor(${label},${LOCUS_HELPER_COLOR})`);
    enhanced.push(`SetLineThickness(${label},4)`);
  }

  for (const label of equationLineLabels) {
    enhanced.push(`SetColor(${label},${LINE_FAMILY_COLOR})`);
    enhanced.push(`SetLineThickness(${label},4)`);
  }

  return enhanced;
}
