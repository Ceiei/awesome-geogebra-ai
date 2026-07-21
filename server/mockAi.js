export function buildMockSolveResult(text = "") {
  const lower = text.toLowerCase();
  const hasDynamicIntent = lower.includes("动点")
    || lower.includes("参数")
    || lower.includes("动态")
    || lower.includes("面积")
    || lower.includes("斜率")
    || lower.includes("切线")
    || lower.includes("割线")
    || lower.includes("切点")
    || lower.includes("轨迹")
    || lower.includes("路径")
    || lower.includes("slope")
    || lower.includes("tangent")
    || lower.includes("secant")
    || lower.includes("locus")
    || lower.includes("path")
    || lower.includes("在抛物线上")
    || lower.includes("在曲线上")
    || lower.includes("任意点")
    || lower.includes("变化");

  if (lower.includes("正方体") || lower.includes("立体") || lower.includes("cube") || lower.includes("3d")) {
    return {
      problemSummary: "在三维坐标系中构造一个正方体，并显示一条体对角线。",
      mathType: "solid_geometry",
      constructionSteps: [
        "在 z=0 平面上放置正方形底面四个顶点。",
        "沿 z 轴放置上底面的四个对应顶点。",
        "连接正方体的十二条棱。",
        "绘制从 A 到 G 的体对角线。"
      ],
      ggbCommands: [
        "A=(0,0,0)",
        "B=(4,0,0)",
        "C=(4,4,0)",
        "D=(0,4,0)",
        "E=(0,0,4)",
        "F=(4,0,4)",
        "G=(4,4,4)",
        "H=(0,4,4)",
        "Segment(A,B)",
        "Segment(B,C)",
        "Segment(C,D)",
        "Segment(D,A)",
        "Segment(E,F)",
        "Segment(F,G)",
        "Segment(G,H)",
        "Segment(H,E)",
        "Segment(A,E)",
        "Segment(B,F)",
        "Segment(C,G)",
        "Segment(D,H)",
        "d=Segment(A,G)",
        "SetColor(A, 37, 99, 235)",
        "SetColor(G, 37, 99, 235)",
        "SetColor(d, 220, 38, 38)",
        "SetLineThickness(d, 5)"
      ],
      viewport: { xmin: -2, xmax: 6, ymin: -2, ymax: 6 },
      warnings: ["当前启用了 Mock 模式，没有调用 OpenAI。"],
      followupQuestion: null
    };
  }

  if (!hasDynamicIntent && (lower.includes("x^2") || lower.includes("parabola") || lower.includes("function"))) {
    return {
      problemSummary: "绘制二次函数，并标出它与 x 轴的交点。",
      mathType: "function",
      constructionSteps: [
        "定义二次函数。",
        "创建函数与 x 轴的交点。",
        "显示函数和根的标签。"
      ],
      ggbCommands: [
        "f(x)=x^2-3*x+2",
        "A=Root(f, 0, 1.5)",
        "B=Root(f, 1.5, 3)",
        "ShowLabel(A, true)",
        "ShowLabel(B, true)",
        "SetColor(f, 35, 99, 235)",
        "SetLineThickness(f, 5)"
      ],
      viewport: { xmin: -2, xmax: 5, ymin: -3, ymax: 8 },
      warnings: ["当前启用了 Mock 模式，没有调用 OpenAI。"],
      followupQuestion: null
    };
  }

  const isLineFamilyAreaProblem = lower.includes("直线")
    && lower.includes("抛物线")
    && (lower.includes("面积") || lower.includes("三角形") || lower.includes("垂线") || lower.includes("垂足"));

  if (!isLineFamilyAreaProblem && (lower.includes("轨迹") || lower.includes("路径") || lower.includes("locus") || lower.includes("path"))) {
    return {
      problemSummary: "用滑动条控制抛物线上的动点，并显示相关点的运动轨迹。",
      mathType: "analytic_geometry",
      constructionSteps: [
        "创建参数滑动条 t，表示动点 P 在抛物线上的横坐标。",
        "绘制抛物线 y = x^2 / 2，并定义动点 P=(t,t^2/2)。",
        "连接固定点 A 与动点 P，取中点 M。",
        "绘制 M 随 P 运动形成的轨迹，帮助观察路径变化。"
      ],
      ggbCommands: [
        "t=Slider(-3,3,0.1,1,180,false,true,false,false)",
        "f(x)=x^2/2",
        "A=(-2,0)",
        "P=(t,t^2/2)",
        "AP=Segment(A,P)",
        "M=Midpoint(A,P)",
        "path=Locus(M,t)",
        "SetColor(f,31,120,83)",
        "SetLineThickness(f,4)",
        "SetColor(AP,148,163,184)",
        "SetLineStyle(AP,2)",
        "SetColor(M,220,38,38)",
        "ShowLabel(P,true)",
        "ShowLabel(M,true)",
        "Text(\"M 的轨迹\", (1,3))"
      ],
      dynamicControls: [
        { name: "t", description: "动点 P 的位置", min: -3, max: 3, step: 0.1 }
      ],
      viewport: { xmin: -4, xmax: 4, ymin: -1, ymax: 6 },
      warnings: ["当前启用了 Mock 模式，没有调用 OpenAI。"],
      followupQuestion: null
    };
  }

  if (isLineFamilyAreaProblem) {
    return {
      problemSummary: "用滑动条控制直线斜率，观察直线与抛物线交点形成的三角形面积变化。",
      mathType: "analytic_geometry",
      constructionSteps: [
        "创建参数滑动条 k，表示直线 l: y = kx + 1 的斜率。",
        "绘制抛物线 C: y = x^2 / 2 和动态直线 l。",
        "标出直线 l 与抛物线 C 的两个交点 A、B，并取线段 AB 的中点 P。",
        "过 P 作 x 轴垂线，垂足为 H，用线段 PH 表示辅助垂线。",
        "构造三角形 ABH，用半透明填充显示题目中的面积区域，并显示面积数值。"
      ],
      ggbCommands: [
        "k=Slider(-1,3,0.1,1,180,false,true,false,false)",
        "f(x)=x^2/2",
        "l=Line((0,1),(1,k+1))",
        "A=Intersect(f,l,1)",
        "B=Intersect(f,l,2)",
        "P=Midpoint(A,B)",
        "xAxisLine=Line((-5,0),(5,0))",
        "vertical=OrthogonalLine(P,xAxisLine)",
        "H=Intersect(vertical,xAxisLine)",
        "TriangleABH=Polygon(A,B,H)",
        "base=Segment(A,B)",
        "height=Segment(P,H)",
        "AreaABH=Area(TriangleABH)",
        "SetVisible(xAxisLine,false)",
        "SetVisible(vertical,false)",
        "SetColor(f,31,120,83)",
        "SetLineThickness(f,4)",
        "SetColor(l,37,99,235)",
        "SetLineThickness(l,4)",
        "SetColor(P,220,38,38)",
        "SetPointSize(P,5)",
        "ShowLabel(A,true)",
        "ShowLabel(B,true)",
        "ShowLabel(P,true)",
        "ShowLabel(H,true)",
        "Text(\"A、B：直线与抛物线交点\", (-4.7,6.4))",
        "Text(\"P：AB 中点，H：P 到 x 轴垂足\", (-4.7,5.8))",
        "Text(\"△ABH 面积 = \" + AreaABH, (-4.7,5.2))"
      ],
      dynamicControls: [
        { name: "k", description: "直线斜率", min: -1, max: 3, step: 0.1 }
      ],
      viewport: { xmin: -5, xmax: 5, ymin: -1.5, ymax: 7 },
      warnings: ["当前启用了 Mock 模式，没有调用 OpenAI。"],
      followupQuestion: null
    };
  }

  if (lower.includes("直线") && (lower.includes("斜率") || lower.includes("截距") || lower.includes("参数") || lower.includes("k"))) {
    return {
      problemSummary: "用滑动条控制直线的斜率和截距，观察直线族与抛物线的交点变化。",
      mathType: "analytic_geometry",
      constructionSteps: [
        "创建参数滑动条 k 和 b，分别表示直线的斜率和截距。",
        "绘制抛物线 y = x^2 / 2 作为参照曲线。",
        "用两点式定义直线 l，并标出它与抛物线的交点。",
        "用辅助线和标签帮助观察斜率、截距变化对交点位置的影响。"
      ],
      ggbCommands: [
        "k=Slider(-3,3,0.1,1,180,false,true,false,false)",
        "b=Slider(-1,3,0.1,1,180,false,true,false,false)",
        "f(x)=x^2/2",
        "l=Line((0,b),(1,k+b))",
        "A=Intersect(f,l,1)",
        "B=Intersect(f,l,2)",
        "slopeLine=Segment((0,b),(1,k+b))",
        "SetColor(f,31,120,83)",
        "SetLineThickness(f,4)",
        "SetColor(l,37,99,235)",
        "SetLineThickness(l,4)",
        "Text(\"斜率 k 与截距 b 控制直线族\", (-3,5))"
      ],
      dynamicControls: [
        { name: "k", description: "直线斜率", min: -3, max: 3, step: 0.1 },
        { name: "b", description: "直线截距", min: -1, max: 3, step: 0.1 }
      ],
      viewport: { xmin: -5, xmax: 5, ymin: -3, ymax: 7 },
      warnings: ["当前启用了 Mock 模式，没有调用 OpenAI。"],
      followupQuestion: null
    };
  }

  if (lower.includes("斜率") || lower.includes("切线") || lower.includes("割线") || lower.includes("slope") || lower.includes("tangent") || lower.includes("secant")) {
    return {
      problemSummary: "用滑动条控制抛物线上的切点，观察切线斜率和割线变化。",
      mathType: "analytic_geometry",
      constructionSteps: [
        "创建参数滑动条 t，表示切点 P 的横坐标。",
        "绘制抛物线 y = x^2。",
        "定义切点 P=(t,t^2)，并选取邻近点 Q 形成割线。",
        "绘制 P 点处切线，并用辅助线展示斜率变化。"
      ],
      ggbCommands: [
        "t=Slider(-2.5,2.5,0.1,1,180,false,true,false,false)",
        "f(x)=x^2",
        "P=(t,t^2)",
        "Q=(t+1,(t+1)^2)",
        "H=(t,0)",
        "secant=Line(P,Q)",
        "tangent=Tangent(P,f)",
        "slopeLine=Segment(P,H)",
        "SetColor(f,31,120,83)",
        "SetLineThickness(f,4)",
        "ShowLabel(P,true)",
        "Text(\"切线斜率随切点变化\", (-3,5))"
      ],
      dynamicControls: [
        { name: "t", description: "切点 P 的位置", min: -2.5, max: 2.5, step: 0.1 }
      ],
      viewport: { xmin: -4, xmax: 4, ymin: -1, ymax: 7 },
      warnings: ["当前启用了 Mock 模式，没有调用 OpenAI。"],
      followupQuestion: null
    };
  }

  if (hasDynamicIntent) {
    return {
      problemSummary: "用滑动条控制抛物线上的动点，并显示由动点形成的三角形面积变化。",
      mathType: "analytic_geometry",
      constructionSteps: [
        "创建参数滑动条 t，表示动点在抛物线上的横坐标。",
        "绘制抛物线 y = x^2 / 2。",
        "定义动点 P=(t,t^2/2)，并连接固定点 A、B 形成三角形。",
        "从 P 向 x 轴作垂线 PH，辅助观察三角形的高如何变化。",
        "用半透明填充显示三角形面积随 t 的变化。"
      ],
      ggbCommands: [
        "t=Slider(-3,3,0.1,1,180,false,true,false,false)",
        "f(x)=x^2/2",
        "A=(-2,0)",
        "B=(2,0)",
        "P=(t,t^2/2)",
        "H=(t,0)",
        "tri=Polygon(A,B,P)",
        "h=Segment(P,H)",
        "base=Segment(A,B)",
        "area=Area(tri)",
        "SetFilling(tri,0.35)",
        "SetColor(tri,96,165,250)",
        "SetColor(h,37,99,235)",
        "SetLineStyle(h,2)",
        "SetLineThickness(h,3)",
        "SetColor(base,31,41,55)",
        "SetLineThickness(base,4)",
        "SetColor(P,37,99,235)",
        "ShowLabel(P,true)",
        "Text(\"面积 = \" + area, (-3,4))"
      ],
      dynamicControls: [
        { name: "t", description: "动点 P 的位置", min: -3, max: 3, step: 0.1 }
      ],
      viewport: { xmin: -4, xmax: 4, ymin: -1, ymax: 6 },
      warnings: ["当前启用了 Mock 模式，没有调用 OpenAI。"],
      followupQuestion: null
    };
  }

  return {
    problemSummary: "构造一个等腰三角形，并绘制它的角平分线。",
    mathType: "geometry",
    constructionSteps: [
      "放置底边端点 A 和 B。",
      "放置点 C，使 AC 和 BC 构成等腰三角形。",
      "绘制三角形边，并从 C 作角平分线。"
    ],
    ggbCommands: [
      "A=(-3,0)",
      "B=(3,0)",
      "C=(0,4)",
      "Polygon(A,B,C)",
      "l=AngleBisector(A,C,B)",
      "D=Intersect(l, Segment(A,B))",
      "Segment(C,D)",
      "ShowLabel(A, true)",
      "ShowLabel(B, true)",
      "ShowLabel(C, true)",
      "SetColor(l, 220, 38, 38)"
    ],
    viewport: { xmin: -6, xmax: 6, ymin: -2, ymax: 6 },
    warnings: ["当前启用了 Mock 模式，没有调用 OpenAI。"],
    followupQuestion: null
  };
}

export function buildMockCommandsFromSteps({ problemSummary = "", mathType = "geometry", constructionSteps = [], viewport } = {}) {
  const stepText = [problemSummary, ...constructionSteps].join(" ");
  const shouldUseDynamicCommands = mathType !== "solid_geometry"
    && /动点|参数|动态|面积|斜率|切线|割线|切点|轨迹|路径|slope|tangent|secant|locus|path|变化/i.test(stepText);

  if (shouldUseDynamicCommands) {
    const dynamicResult = buildMockSolveResult(stepText);
    return {
      ...dynamicResult,
      problemSummary: problemSummary || dynamicResult.problemSummary || "根据修订步骤生成的动态绘图方案",
      mathType: dynamicResult.mathType || mathType,
      constructionSteps,
      viewport: viewport || dynamicResult.viewport,
      warnings: ["已根据用户修订的构造步骤重新生成动态命令。"],
      followupQuestion: null
    };
  }

  return {
    problemSummary: problemSummary || "根据修订步骤生成的绘图方案",
    mathType,
    constructionSteps,
    ggbCommands: mathType === "solid_geometry"
      ? [
        "A=(0,0,0)",
        "B=(3,0,0)",
        "C=(0,3,0)",
        "A1=(0,0,3)",
        "B1=(3,0,3)",
        "C1=(0,3,3)",
        "Segment(A,B)",
        "Segment(B,C)",
        "Segment(C,A)",
        "Segment(A1,B1)",
        "Segment(B1,C1)",
        "Segment(C1,A1)",
        "Segment(A,A1)",
        "Segment(B,B1)",
        "Segment(C,C1)"
      ]
      : [
        "A=(0,0)",
        "B=(4,0)",
        "C=(2,3)",
        "Polygon(A,B,C)",
        "Segment(A,C)",
        "Segment(B,C)"
      ],
    viewport: viewport || { xmin: -5, xmax: 5, ymin: -4, ymax: 5 },
    warnings: ["已根据用户修订的构造步骤重新生成命令。"],
    followupQuestion: null
  };
}
