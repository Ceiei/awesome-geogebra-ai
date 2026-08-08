const ROLE_STYLE = {
  original: { color: "31,41,55", thickness: 3, lineStyle: 0 },
  key: { color: "37,99,235", thickness: 5, lineStyle: 0 },
  conclusion: { color: "220,38,38", thickness: 5, lineStyle: 0 },
  helper: { color: "107,114,128", thickness: 2, lineStyle: 2 },
  trajectory: { color: "13,148,136", thickness: 4, lineStyle: 0 },
  region: { color: "96,165,250", thickness: 3, lineStyle: 0, filling: 0.3 },
  measurement: { color: "220,38,38", thickness: 3, lineStyle: 0 },
  parameter: { color: "37,99,235", thickness: 2, lineStyle: 0 },
  hidden: { color: "148,163,184", thickness: 1, lineStyle: 2, visible: false }
};

const NON_LINEAR_OBJECTS = new Set(["Point", "Value", "Area", "Distance", "Angle", "Slider", "Text"]);
const THEME_COMMAND_NAMES = new Set([
  "SetColor",
  "SetFilling",
  "SetLineStyle",
  "SetLineThickness",
  "SetPointSize",
  "SetVisible",
  "ShowLabel"
]);

function isPointObject(object) {
  return String(object.objectType || "").toLowerCase() === "point";
}

export function applyTeachingTheme(commands, objectManifest, { mathType = "geometry" } = {}) {
  const manifestLabels = new Set((objectManifest || []).map((object) => object.label));
  const explicitlyHiddenLabels = new Set((commands || []).flatMap((command) => {
    const match = String(command).match(/^\s*SetVisible\s*\(\s*([A-Za-z][A-Za-z0-9_]*)\s*,\s*false\s*\)/i);
    return match ? [match[1]] : [];
  }));
  const themed = (commands || []).filter((command) => {
    const match = String(command).match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*\(\s*([A-Za-z][A-Za-z0-9_]*)\s*,?/);
    return !(match && THEME_COMMAND_NAMES.has(match[1]) && manifestLabels.has(match[2]));
  });
  for (const object of objectManifest || []) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(object.label)) continue;
    const style = ROLE_STYLE[object.role] || ROLE_STYLE.original;
    const objectType = String(object.objectType || "").toLowerCase();
    const isInfinite3DPlane = mathType === "solid_geometry" && objectType.includes("plane");
    const isHelperPlanePatch = mathType === "solid_geometry" && objectType === "polygon" && object.role === "helper";
    themed.push(`SetColor(${object.label},${isInfinite3DPlane ? "148,163,184" : (isHelperPlanePatch ? "96,165,250" : style.color)})`);
    if (isPointObject(object)) {
      const pointSize = mathType === "solid_geometry"
        ? (["key", "conclusion"].includes(object.role) ? 5 : 4)
        : (["key", "conclusion"].includes(object.role) ? 6 : 5);
      themed.push(`SetPointSize(${object.label},${pointSize})`);
      themed.push(`ShowLabel(${object.label},${object.role !== "hidden"})`);
      continue;
    }
    if (!NON_LINEAR_OBJECTS.has(object.objectType)) {
      themed.push(`SetLineThickness(${object.label},${isHelperPlanePatch ? 2 : style.thickness})`);
      themed.push(`SetLineStyle(${object.label},${isHelperPlanePatch ? 0 : style.lineStyle})`);
    }
    if (isInfinite3DPlane) {
      themed.push(`SetFilling(${object.label},0.045)`);
    } else if (isHelperPlanePatch) {
      themed.push(`SetFilling(${object.label},0.08)`);
    } else if (style.filling !== undefined) {
      const filling = mathType === "solid_geometry"
        ? Math.min(style.filling, object.role === "region" ? 0.14 : 0.06)
        : style.filling;
      themed.push(`SetFilling(${object.label},${filling})`);
    }
    if (style.visible === false || object.visible === false || explicitlyHiddenLabels.has(object.label)) {
      themed.push(`SetVisible(${object.label},false)`);
    }
    const showLabel = mathType === "solid_geometry"
      ? object.role === "conclusion" && objectType !== "angle"
      : ["measurement", "conclusion"].includes(object.role);
    themed.push(`ShowLabel(${object.label},${showLabel})`);
  }
  return [...new Set(themed)];
}
