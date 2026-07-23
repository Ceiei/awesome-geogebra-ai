function normalizeText(text) {
  return String(text ?? "").toLowerCase().replace(/\s+/g, "");
}

function withTemplateWarning(result, templateName) {
  return {
    ...result,
    warnings: [
      `已匹配内置题型模板：${templateName}。`,
      ...(result.warnings || [])
    ],
    followupQuestion: null
  };
}

function ellipseMovingPointTemplate({ aSquared, bSquared, sourceText }) {
  const majorSquared = Math.max(aSquared, bSquared);
  const minorSquared = Math.min(aSquared, bSquared);
  const horizontal = aSquared >= bSquared;
  const major = Math.sqrt(majorSquared);
  const minor = Math.sqrt(minorSquared);
  const focus = Math.sqrt(Math.max(0, majorSquared - minorSquared));
  const sliderLimit = Number((major * 0.9).toFixed(3));
  const curve = `x^2/${aSquared}+y^2/${bSquared}=1`;
  const pointExpression = horizontal
    ? `(t,${minor}*sqrt(1-t^2/${aSquared}))`
    : `(${minor}*sqrt(1-t^2/${bSquared}),t)`;
  const firstFocus = horizontal ? `(-${focus},0)` : `(0,-${focus})`;
  const secondFocus = horizontal ? `(${focus},0)` : `(0,${focus})`;
  const foot = horizontal ? "(t,0)" : "(0,t)";
  const viewportExtent = Math.ceil(major + 1.5);
  return withTemplateWarning({
    recognizedProblemText: sourceText,
    problemSummary: `在椭圆 ${curve} 上设置动点 P，观察它与两个焦点构成的三角形面积变化。`,
    mathType: "analytic_geometry",
    problemContract: {
      originalText: sourceText,
      mathType: "analytic_geometry",
      fixedExpressions: [curve],
      requiredLabels: ["F1", "F2", "P"],
      requiredObjects: ["椭圆", "焦点", "三角形"],
      constraints: [
        { id: "ellipse-point", type: "point_on_curve", objects: ["P", "E"], description: "点 P 位于椭圆 E 上" },
        { id: "triangle-area", type: "nonzero", objects: ["AreaF1F2P"], description: "三角形面积应为正值" }
      ],
      targets: ["三角形 F1F2P 面积"],
      locked: true
    },
    constructionSteps: [
      `绘制椭圆 E: ${curve}，并标出两个焦点 F1、F2。`,
      "创建滑动条 t，表示动点 P 的横坐标。",
      `定义 P=${pointExpression}，使 P 在椭圆上运动。`,
      "构造三角形 F1F2P，用半透明填充显示面积。",
      "绘制 P 到 x 轴的高，并显示面积值，便于观察面积随 P 变化。"
    ],
    ggbCommands: [
      `t=Slider(-${sliderLimit},${sliderLimit},0.1,1,180,false,true,false,false)`,
      `E: ${curve}`,
      `F1=${firstFocus}`,
      `F2=${secondFocus}`,
      `P=${pointExpression}`,
      `H=${foot}`,
      "TriangleF1F2P=Polygon(F1,F2,P)",
      "height=Segment(P,H)",
      "base=Segment(F1,F2)",
      "AreaF1F2P=Area(TriangleF1F2P)",
      "path=Locus(P,t)",
      "SetColor(E,31,120,83)",
      "SetLineThickness(E,4)",
      "SetColor(P,37,99,235)",
      "SetPointSize(P,5)",
      "ShowLabel(F1,true)",
      "ShowLabel(F2,true)",
      "ShowLabel(P,true)",
      "ShowLabel(H,true)",
      "Text(\"P：椭圆上的动点\", (-4,3.2))",
      "Text(\"△F1F2P 面积 = \" + AreaF1F2P, (-4,2.7))"
    ],
    dynamicControls: [
      { name: "t", label: "动点 P 的位置", description: "动点 P 的位置", min: -sliderLimit, max: sliderLimit, step: 0.1, defaultValue: 0, affectedObjects: ["P", "H", "TriangleF1F2P", "AreaF1F2P"] }
    ],
    dynamicCandidates: [
      { name: "t", label: "动点 P 的位置", description: "控制点 P 沿椭圆移动", min: -sliderLimit, max: sliderLimit, step: 0.1, defaultValue: 0, affectedObjects: ["P", "H", "TriangleF1F2P"], enabled: false }
    ],
    viewport: { xmin: -viewportExtent, xmax: viewportExtent, ymin: -viewportExtent, ymax: viewportExtent },
    warnings: [],
    generationMeta: { templateId: "ellipse-moving-point-area-v3" }
  }, "椭圆动点面积");
}

function quadraticIntervalTemplate({ expression, sourceText }) {
  return withTemplateWarning({
    recognizedProblemText: sourceText,
    problemSummary: `用两个滑动条控制函数 f(x)=${expression} 的区间端点，辅助判断区间内最大值和最小值。`,
    mathType: "function",
    problemContract: {
      originalText: sourceText,
      mathType: "function",
      fixedExpressions: [`f(x)=${expression}`],
      requiredLabels: ["f", "A", "B"],
      requiredObjects: ["函数", "区间端点"],
      constraints: [],
      targets: ["区间最值"],
      locked: true
    },
    constructionSteps: [
      `绘制二次函数 f(x)=${expression}，并标出关键点。`,
      "创建滑动条 a、b，表示观察区间的左右端点。",
      "定义 A=(a,f(a)) 与 B=(b,f(b))，随滑动条移动。",
      "绘制端点到 x 轴的投影线和区间底边，帮助观察区间范围。",
      "显示 f(a)、f(b) 与顶点值，辅助判断最大最小值。"
    ],
    ggbCommands: [
      "a=Slider(-3,0.8,0.1,1,180,false,true,false,false)",
      "b=Slider(1.2,4,0.1,1,180,false,true,false,false)",
      `f(x)=${expression}`,
      "A=(a,f(a))",
      "B=(b,f(b))",
      "A0=(a,0)",
      "B0=(b,0)",
      "V=(1,4)",
      "leftHeight=Segment(A,A0)",
      "rightHeight=Segment(B,B0)",
      "intervalBase=Segment(A0,B0)",
      "endpointChord=Segment(A,B)",
      "SetColor(f,31,120,83)",
      "SetLineThickness(f,4)",
      "SetColor(V,220,38,38)",
      "SetPointSize(V,5)",
      "ShowLabel(A,true)",
      "ShowLabel(B,true)",
      "ShowLabel(V,true)",
      "Text(\"区间端点：a 与 b\", (-3.6,5))",
      "Text(\"顶点 V 是全局最大值参考点\", (-3.6,4.45))"
    ],
    dynamicControls: [
      { name: "a", description: "区间左端点", min: -3, max: 0.8, step: 0.1 },
      { name: "b", description: "区间右端点", min: 1.2, max: 4, step: 0.1 }
    ],
    viewport: { xmin: -4, xmax: 5, ymin: -3, ymax: 5.8 },
    warnings: [],
    generationMeta: { templateId: "quadratic-interval-v3" }
  }, "二次函数区间最值");
}

function cubeSectionTemplate({ sideLength, sourceText }) {
  const side = Number(sideLength);
  const minHeight = Number((side * 0.1).toFixed(2));
  const maxHeight = Number((side * 0.9).toFixed(2));
  return withTemplateWarning({
    recognizedProblemText: sourceText,
    problemSummary: `用滑动条控制棱长为 ${side} 的正方体内水平截面的高度，观察截面形状随高度变化。`,
    mathType: "solid_geometry",
    constructionSteps: [
      "构造正方体 ABCD-A1B1C1D1。",
      "创建滑动条 h，表示水平截面在 z 方向的高度。",
      "在四条竖直棱上取 P、Q、R、U 四点。",
      "构造截面 PQRU，并用低透明度填充突出显示。",
      "保留正方体棱线和截面，方便旋转观察。"
    ],
    ggbCommands: [
      `h=Slider(${minHeight},${maxHeight},0.1,1,180,false,true,false,false)`,
      "A=(0,0,0)",
      `B=(${side},0,0)`,
      `C=(${side},${side},0)`,
      `D=(0,${side},0)`,
      `A1=(0,0,${side})`,
      `B1=(${side},0,${side})`,
      `C1=(${side},${side},${side})`,
      `D1=(0,${side},${side})`,
      "edgeAB=Segment(A,B)",
      "edgeBC=Segment(B,C)",
      "edgeCD=Segment(C,D)",
      "edgeDA=Segment(D,A)",
      "edgeA1B1=Segment(A1,B1)",
      "edgeB1C1=Segment(B1,C1)",
      "edgeC1D1=Segment(C1,D1)",
      "edgeD1A1=Segment(D1,A1)",
      "edgeAA1=Segment(A,A1)",
      "edgeBB1=Segment(B,B1)",
      "edgeCC1=Segment(C,C1)",
      "edgeDD1=Segment(D,D1)",
      "P=(0,0,h)",
      `Q=(${side},0,h)`,
      `R=(${side},${side},h)`,
      `U=(0,${side},h)`,
      "section=Polygon(P,Q,R,U)",
      "SetFilling(section,0.18)",
      "SetColor(section,96,165,250)",
      "SetLineThickness(section,4)",
      "ShowLabel(P,true)",
      "ShowLabel(Q,true)",
      "ShowLabel(R,true)",
      "ShowLabel(U,true)"
    ],
    dynamicControls: [
      { name: "h", label: "截面高度", description: "截面高度", min: minHeight, max: maxHeight, step: 0.1, defaultValue: side / 2, affectedObjects: ["P", "Q", "R", "U", "section"] }
    ],
    dynamicCandidates: [
      { name: "h", label: "截面高度", description: "控制水平截面高度", min: minHeight, max: maxHeight, step: 0.1, defaultValue: side / 2, affectedObjects: ["section"], enabled: false }
    ],
    viewport: { xmin: -1, xmax: side + 1, ymin: -1, ymax: side + 1 },
    warnings: [],
    generationMeta: { templateId: "cube-horizontal-section-v3" }
  }, "正方体水平截面");
}

function parseEllipseParameters(text) {
  const normalized = String(text || "").toLowerCase().replaceAll("²", "^2").replace(/\s+/g, "");
  const match = normalized.match(/x\^2\/(\d+(?:\.\d+)?)\+y\^2\/(\d+(?:\.\d+)?)=1/);
  if (!match) return null;
  const aSquared = Number(match[1]);
  const bSquared = Number(match[2]);
  if (!(aSquared > 0) || !(bSquared > 0) || aSquared === bSquared) return null;
  return { aSquared, bSquared, sourceText: String(text).trim() };
}

function parseCubeSideLength(text) {
  const normalized = String(text || "").replace(/\s+/g, "");
  const match = normalized.match(/(?:棱长|边长)(?:为|是|=)?(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const sideLength = Number(match[1]);
  return sideLength > 0 ? { sideLength, sourceText: String(text).trim() } : null;
}

function parseQuadraticExpression(text) {
  const normalized = String(text || "").replaceAll("²", "^2");
  const match = normalized.match(/(?:f\s*\(\s*x\s*\)|y)\s*[=＝]\s*([^\u3400-\u9fff，。；;\n]+)/i);
  if (!match) return null;
  const expression = match[1].trim().replace(/\s+/g, "").replaceAll("−", "-");
  if (!/x\s*(?:\^2|\*x)|\([^)]*x[^)]*\)\s*\^2/i.test(expression)) return null;
  if (!/^[0-9xX+\-*/^().]+$/.test(expression)) return null;
  return { expression, sourceText: String(text).trim() };
}

export function findTeachingTemplate(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  if ((normalized.includes("椭圆") || normalized.includes("ellipse"))
    && (normalized.includes("焦点") || normalized.includes("focus") || /f[₁1].*f[₂2]/i.test(String(text)))
    && (normalized.includes("面积") || normalized.includes("三角形"))) {
    const parameters = parseEllipseParameters(text);
    return parameters ? ellipseMovingPointTemplate(parameters) : null;
  }

  if ((normalized.includes("二次函数") || normalized.includes("最值") || normalized.includes("最大") || normalized.includes("最小"))
    && (normalized.includes("区间") || normalized.includes("端点"))) {
    const parameters = parseQuadraticExpression(text);
    return parameters ? quadraticIntervalTemplate(parameters) : null;
  }

  if ((normalized.includes("正方体") || normalized.includes("cube"))
    && (normalized.includes("截面") || normalized.includes("截割"))) {
    const parameters = parseCubeSideLength(text);
    return parameters ? cubeSectionTemplate(parameters) : null;
  }

  return null;
}
