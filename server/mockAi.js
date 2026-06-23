export function buildMockSolveResult(text = "") {
  const lower = text.toLowerCase();

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

  if (lower.includes("x^2") || lower.includes("parabola") || lower.includes("function")) {
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
