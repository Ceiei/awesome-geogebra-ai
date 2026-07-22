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

function ellipseMovingPointTemplate() {
  return withTemplateWarning({
    problemSummary: "用滑动条控制椭圆上的动点 P，观察它与两个焦点构成的三角形面积变化。",
    mathType: "analytic_geometry",
    constructionSteps: [
      "绘制椭圆 E: x^2/9 + y^2/4 = 1，并标出两个焦点 F1、F2。",
      "创建滑动条 t，表示动点 P 的横坐标。",
      "定义 P=(t, 2*sqrt(1-t^2/9))，使 P 在椭圆上半部分运动。",
      "构造三角形 F1F2P，用半透明填充显示面积。",
      "绘制 P 到 x 轴的高，并显示面积值，便于观察面积随 P 变化。"
    ],
    ggbCommands: [
      "t=Slider(-2.6,2.6,0.1,1,180,false,true,false,false)",
      "E: x^2/9+y^2/4=1",
      "F1=(-sqrt(5),0)",
      "F2=(sqrt(5),0)",
      "P=(t,2*sqrt(1-t^2/9))",
      "H=(t,0)",
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
      { name: "t", description: "动点 P 的横坐标", min: -2.6, max: 2.6, step: 0.1 }
    ],
    viewport: { xmin: -4.5, xmax: 4.5, ymin: -2.8, ymax: 3.8 },
    warnings: []
  }, "椭圆动点面积");
}

function quadraticIntervalTemplate() {
  return withTemplateWarning({
    problemSummary: "用两个滑动条控制二次函数观察区间端点，辅助判断区间内最大值和最小值。",
    mathType: "function",
    constructionSteps: [
      "绘制二次函数 f(x)=-(x-1)^2+4，并标出顶点 V。",
      "创建滑动条 a、b，表示观察区间的左右端点。",
      "定义 A=(a,f(a)) 与 B=(b,f(b))，随滑动条移动。",
      "绘制端点到 x 轴的投影线和区间底边，帮助观察区间范围。",
      "显示 f(a)、f(b) 与顶点值，辅助判断最大最小值。"
    ],
    ggbCommands: [
      "a=Slider(-3,0.8,0.1,1,180,false,true,false,false)",
      "b=Slider(1.2,4,0.1,1,180,false,true,false,false)",
      "f(x)=-(x-1)^2+4",
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
    warnings: []
  }, "二次函数区间最值");
}

function cubeSectionTemplate() {
  return withTemplateWarning({
    problemSummary: "用滑动条控制正方体内水平截面的高度，观察截面形状随高度变化。",
    mathType: "solid_geometry",
    constructionSteps: [
      "构造正方体 ABCD-A1B1C1D1。",
      "创建滑动条 h，表示水平截面在 z 方向的高度。",
      "在四条竖直棱上取 P、Q、R、U 四点。",
      "构造截面 PQRU，并用低透明度填充突出显示。",
      "保留正方体棱线和截面，方便旋转观察。"
    ],
    ggbCommands: [
      "h=Slider(0.3,3.7,0.1,1,180,false,true,false,false)",
      "A=(0,0,0)",
      "B=(4,0,0)",
      "C=(4,4,0)",
      "D=(0,4,0)",
      "A1=(0,0,4)",
      "B1=(4,0,4)",
      "C1=(4,4,4)",
      "D1=(0,4,4)",
      "Segment(A,B)",
      "Segment(B,C)",
      "Segment(C,D)",
      "Segment(D,A)",
      "Segment(A1,B1)",
      "Segment(B1,C1)",
      "Segment(C1,D1)",
      "Segment(D1,A1)",
      "Segment(A,A1)",
      "Segment(B,B1)",
      "Segment(C,C1)",
      "Segment(D,D1)",
      "P=(0,0,h)",
      "Q=(4,0,h)",
      "R=(4,4,h)",
      "U=(0,4,h)",
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
      { name: "h", description: "截面高度", min: 0.3, max: 3.7, step: 0.1 }
    ],
    viewport: { xmin: -1, xmax: 5, ymin: -1, ymax: 5 },
    warnings: []
  }, "正方体水平截面");
}

export function findTeachingTemplate(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  if ((normalized.includes("椭圆") || normalized.includes("ellipse"))
    && (normalized.includes("焦点") || normalized.includes("focus"))
    && (normalized.includes("面积") || normalized.includes("三角形"))) {
    return ellipseMovingPointTemplate();
  }

  if ((normalized.includes("二次函数") || normalized.includes("最值") || normalized.includes("最大") || normalized.includes("最小"))
    && (normalized.includes("区间") || normalized.includes("端点"))) {
    return quadraticIntervalTemplate();
  }

  if ((normalized.includes("正方体") || normalized.includes("cube"))
    && (normalized.includes("截面") || normalized.includes("截割"))) {
    return cubeSectionTemplate();
  }

  return null;
}
