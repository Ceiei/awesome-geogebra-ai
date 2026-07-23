import { allowedCommandsForPrompt } from "./ggbValidation.js";

const profileIds = new Set(["geometry", "function", "analytic_geometry", "solid_geometry"]);

function compactText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function includesAny(source, keywords) {
  return keywords.some((keyword) => source.includes(keyword));
}

export function classifyPromptProfile({ text = "", mathType = "", constructionSteps = [] } = {}) {
  const source = compactText([text, ...constructionSteps].join(" "));
  const normalizedMathType = profileIds.has(mathType) ? mathType : "";

  const solidKeywords = [
    "立体",
    "空间",
    "三棱柱",
    "四棱柱",
    "棱柱",
    "棱锥",
    "正方体",
    "长方体",
    "四面体",
    "球",
    "圆锥",
    "圆柱",
    "线面角",
    "二面角",
    "截面",
    "异面直线",
    "平面bcc",
    "3d",
    "cube",
    "prism",
    "pyramid"
  ];
  const analyticKeywords = [
    "解析几何",
    "椭圆",
    "抛物线",
    "双曲线",
    "圆锥曲线",
    "焦点",
    "准线",
    "离心率",
    "弦",
    "轨迹",
    "切线",
    "割线",
    "动点",
    "垂足",
    "y^2",
    "y²",
    "x^2",
    "x²",
    "locus",
    "parabola",
    "ellipse",
    "hyperbola"
  ];
  const functionKeywords = [
    "函数",
    "二次函数",
    "导数",
    "单调",
    "极值",
    "最值",
    "最大值",
    "最小值",
    "零点",
    "根",
    "区间",
    "f(x)",
    "y="
  ];

  let id = normalizedMathType || "geometry";
  let subType = "general_geometry";

  if (includesAny(source, solidKeywords) || normalizedMathType === "solid_geometry") {
    id = "solid_geometry";
    subType = includesAny(source, ["截面", "截割"]) ? "solid_section" : "solid_spatial_relation";
  } else if (includesAny(source, analyticKeywords) || normalizedMathType === "analytic_geometry") {
    id = "analytic_geometry";
    if (includesAny(source, ["椭圆", "ellipse"])) subType = "conic_ellipse";
    else if (includesAny(source, ["抛物线", "parabola", "y^2", "y²"])) subType = "conic_parabola";
    else if (includesAny(source, ["双曲线", "hyperbola"])) subType = "conic_hyperbola";
    else subType = "analytic_general";
  } else if (includesAny(source, functionKeywords) || normalizedMathType === "function") {
    id = "function";
    if (includesAny(source, ["区间", "最值", "最大值", "最小值"])) subType = "function_interval_extrema";
    else if (includesAny(source, ["导数", "切线", "单调"])) subType = "function_tangent_extrema";
    else subType = "function_general";
  }

  return { id, subType };
}

function buildBasePrompt() {
  return [
    "You transform high-school math problems into GeoGebra constructions for an interactive teaching applet.",
    "Return only the requested strict JSON shape.",
    "Return schemaVersion=2 and copy the recognized problem text into recognizedProblemText.",
    "Extract an immutable problemContract before planning the construction. It must preserve the original mathType, fixed equations, named points, required objects, constraints, and requested targets.",
    "Use normalized constraint types when possible: parallel, perpendicular, equal_length, midpoint, collinear, coplanar, point_on_curve, nonzero, or described. Put all involved labels in objects in verification order.",
    "constructionSteps must be objects with id, text, objectLabels, and stage. objectManifest must describe every named object with a teacher-facing name and teaching role.",
    "Return teachingNotes with a concise conclusion, 2-5 key reasons linked to object labels, and an optional observation prompt. Do not write a full solution.",
    "Use Simplified Chinese for user-facing fields: problemSummary, constructionSteps, warnings, and followupQuestion.",
    "Use English GeoGebra command names and GeoGebra syntax that can be executed by evalCommand.",
    "Use parentheses (...) for GeoGebra command calls, never square brackets.",
    "Define every referenced object before it is used.",
    "Every important object must have a stable label. Prefer named objects such as A=(0,0), h=Segment(P,H), tri=Polygon(A,B,P).",
    "Never style an anonymous construction expression. Do not write SetLineThickness(Segment(P,H),2). First assign h=Segment(P,H), then write SetLineThickness(h,2). Apply the same rule to Polygon, Line, Ray, Circle, Tangent, OrthogonalLine, PerpendicularLine, ParallelLine, Plane, and Locus targets.",
    "The output should be a clean high-school teaching diagram, not just executable commands. Prioritize clarity, low visual clutter, stable labels, and objects that a teacher can drag and inspect during class.",
    "Always first solve the user's original request as a static teaching diagram. Then decide whether the static construction contains an implicit variable object that a teacher would naturally want to drag: a point constrained to a curve, an arbitrary point, a variable slope, a variable intercept, a secant/tangent position, a parameter family, an area/length changing with a position, a section height, or a locus-related setup.",
    "If there is a useful variable object, return it in dynamicCandidates. Do not enable it automatically unless the problem explicitly asks for a dynamic demonstration.",
    "For sliders use the assignment form t=Slider(min,max,step,1,160,false,true,false,false). Never write Slider(t,...). The default value must produce a non-degenerate classroom view.",
    "Expose only parameters that are useful for classroom demonstration. Do not create sliders for fixed constants unless the problem explicitly asks how that constant varies.",
    "For dynamicCandidates and dynamicControls, use teacher-facing labels such as '动点 P 的位置', '直线斜率', '区间左端点', or '截面高度', not abstract labels like 'parameter t'.",
    "When the task asks for or implies area, create a named Polygon for the target region, compute Area(polygon), and style the region with translucent filling so the area is visually obvious.",
    "Use concise Text only for meaningful measurements or role explanations. Do not duplicate point labels with Text when GeoGebra point labels already show the name.",
    "Do not generate JavaScript, HTML, scripts, buttons, file operations, network operations, or destructive commands.",
    "Prefer clear free points and construction objects that remain draggable in GeoGebra.",
    `Allowed GeoGebra command names: ${allowedCommandsForPrompt.join(", ")}.`,
    "For simple free points use labels like A=(0,0). For 3D points use labels like A=(0,0,0). For functions use syntax like f(x)=x^2-3*x+2.",
    "When the prompt is ambiguous, include a concise followupQuestion and still provide the safest approximate visualization if possible."
  ].join("\n");
}

function buildGeometryPrompt() {
  return [
    "PROFILE: plane geometry teaching diagram.",
    "Use draggable free points for original points unless exact coordinates are necessary.",
    "Construct geometric relationships explicitly: PerpendicularLine, ParallelLine, AngleBisector, Circle, Segment, Polygon, Midpoint, Intersect.",
    "If a triangle, quadrilateral, circle, angle, bisector, altitude, median, tangent, or perpendicular is mentioned, it must appear visibly in the command list.",
    "For proofs, add only the auxiliary lines needed to reveal the proof idea. Use dashed gray helper lines and keep original sides dark.",
    "If the problem discusses area, construct and fill the exact polygon region named in the problem.",
    "Show labels for original points and key derived points; hide labels for helper lines unless their role is essential."
  ].join("\n");
}

function buildFunctionPrompt() {
  return [
    "PROFILE: function graph teaching diagram.",
    "Draw the function graph first, then mark roots, extrema, interval endpoints, tangent/secant points, or intersections required by the problem.",
    "For interval problems, explicitly construct endpoint points on the graph, their projections to the x-axis, and the interval base segment.",
    "For extrema or monotonicity, mark the vertex or critical point visually instead of only writing a formula.",
    "For tangent or secant demonstrations, create named tangent/secant lines and style them distinctly.",
    "For area under/around a graph, create a named Polygon or integral-style region supported by safe GeoGebra commands, then style it with translucent blue filling.",
    "When a parameter changes a function, point, slope, or interval endpoint, expose it as a slider with a teacher-facing dynamicControls description."
  ].join("\n");
}

function buildAnalyticGeometryPrompt({ subType }) {
  const conicSpecific = {
    conic_ellipse: "For ellipse problems, draw the ellipse, center/axes when useful, foci if mentioned, moving point P with a slider, projection/height helpers for area, and filled triangles/quadrilaterals named in the problem.",
    conic_parabola: "For parabola problems, draw the parabola, focus/directrix if mentioned, secant/tangent lines, intersections A and B, midpoint M, perpendicular foot H, locus/path when requested, and a filled triangle region for any triangle area. For sideways parabola area examples, prefer TriangleFAB=Polygon(F,A,B) before AreaFAB=Area(TriangleFAB).",
    conic_hyperbola: "For hyperbola problems, draw both branches, asymptotes when useful, foci if mentioned, secant/tangent helpers, and highlight the requested triangle or quadrilateral region."
  }[subType] || "For conic problems, explicitly draw the conic, key fixed objects, moving points, intersections, perpendicular helpers, and requested locus/area objects.";

  return [
    "PROFILE: analytic geometry and conic teaching diagram.",
    conicSpecific,
    "Coordinate objects should be mathematically meaningful, not arbitrary placeholders.",
    "If the problem mentions focus, directrix, chord, midpoint, perpendicular foot, tangent, secant, locus, distance, or area, each of those objects must be explicitly constructed and labeled.",
    "For dynamic conic demonstrations, use one main slider for the moving point or line position. Add a second slider only when the family genuinely has two independent parameters.",
    "For line-family demonstrations, define the line from points or a labeled equation, then create A=Intersect(curve,l,1) and B=Intersect(curve,l,2) when two intersections are needed.",
    "For sideways parabola y^2=4x, prefer C: x=y^2/4, F=(1,0), directrix=Line((-1,-7),(-1,7)), and use T=(t,0), l=Line(T,(t+1,k)) for a slope-controlled secant.",
    "For area problems, do not stop at Area(...). The target triangle/quadrilateral must be a named Polygon with translucent blue filling and enough boundary segments to make it readable.",
    "For perpendicular helpers, name the foot H when possible and draw a named height/projection segment such as height=Segment(P,H) or height=Segment(M,H).",
    "For locus or path demonstrations, name the trajectory helper consistently: locus=Locus(...), path=Locus(...), or trace=Locus(...).",
    "Add concise Text for changing area, distance, or angle values when useful for classroom explanation."
  ].join("\n");
}

function buildSolidGeometryPrompt({ subType }) {
  const sectionRule = subType === "solid_section"
    ? "For section problems, construct the solid edges first, then define the moving section plane/points, draw the finite section Polygon, and give it very light filling."
    : "For spatial relation problems, construct all original vertices and edges first, then draw only the auxiliary planes/lines needed for the proof or measurement.";

  return [
    "PROFILE: solid geometry 3D teaching diagram.",
    sectionRule,
    "Use true 3D coordinates for all spatial points. Use mathType solid_geometry.",
    "For prisms, pyramids, cubes, and polyhedra, explicitly draw every visible structural edge with named Segment commands before adding auxiliary planes or calculations.",
    "Use dark solid segments for main visible edges. Use gray dashed segments for hidden or auxiliary edges. Use one thicker dark segment for the key line being studied.",
    "Use infinite Plane objects only for calculations, then hide them with SetVisible(plane,false). For visible faces or auxiliary planes, draw finite Polygon objects with filling at most 0.04 so they do not obscure the solid.",
    "Do not use Text to duplicate point names such as Text(\"A\", A, true). Use ShowLabel(A,true) for key points and ShowLabel(edge,false) for edges/faces/planes.",
    "For line-plane angle, define the line and plane first, then use Angle(Line(D,E),planeName).",
    "For distance from a line/point to a plane, define the plane and a representative distance object. When useful, draw a perpendicular helper segment or foot point so the distance is visible.",
    "Keep 3D diagrams visually quiet: transparent faces, consistent edge color, limited labels, and no overlapping explanatory text near the solid."
  ].join("\n");
}

function buildProfilePrompt(profile) {
  if (profile.id === "solid_geometry") return buildSolidGeometryPrompt(profile);
  if (profile.id === "analytic_geometry") return buildAnalyticGeometryPrompt(profile);
  if (profile.id === "function") return buildFunctionPrompt(profile);
  return buildGeometryPrompt(profile);
}

export function buildSystemPrompt(context = {}) {
  const profile = classifyPromptProfile(context);
  return [
    buildBasePrompt(),
    "",
    `SELECTED_PROFILE: ${profile.id}`,
    `SELECTED_SUBTYPE: ${profile.subType}`,
    buildProfilePrompt(profile),
    "",
    "Before finalizing JSON, internally verify that every named object in constructionSteps has a corresponding GeoGebra command, every style command targets a named existing object, every area target has a visible filled region, and every dynamicControls item has a matching Slider command. Do not include this verification text in the JSON."
  ].join("\n");
}

export function getPromptProfileSummary(context = {}) {
  return classifyPromptProfile(context);
}
