const categorySeeds = {
  geometry: [
    ["在三角形 ABC 中，AB=AC，作 ∠A 的角平分线交 BC 于 D。", ["A", "B", "C", "D"], ["angle_bisector", "equal_length"]],
    ["在直角三角形 ABC 中，∠C=90°，作斜边 AB 上的中线 CD。", ["A", "B", "C", "D"], ["perpendicular", "midpoint"]],
    ["已知圆 O 及圆上一点 A，作圆 O 在 A 点处的切线。", ["O", "A"], ["point_on_curve", "tangent"]],
    ["在平行四边形 ABCD 中连接 AC、BD，交于点 O。", ["A", "B", "C", "D", "O"], ["parallel", "midpoint"]],
    ["在三角形 ABC 中作三条高，并标出垂心 H。", ["A", "B", "C", "H"], ["perpendicular", "concurrent"]]
  ],
  function: [
    ["绘制函数 f(x)=x^2-3x+2，并标出与 x 轴的交点。", ["f", "A", "B"], ["point_on_curve"]],
    ["绘制函数 f(x)=2sin(x)，标出一个周期内的最高点和最低点。", ["f"], ["extremum"]],
    ["绘制函数 f(x)=ln(x) 与 g(x)=x-1，并标出交点。", ["f", "g"], ["intersection"]],
    ["绘制函数 f(x)=|x-2|+1，标出顶点并展示对称轴。", ["f"], ["symmetry"]],
    ["绘制函数 f(x)=1/x，并展示第一、第三象限内的分支和渐近线。", ["f"], ["asymptote"]]
  ],
  analytic_geometry: [
    ["已知椭圆 x^2/9+y^2/4=1，标出焦点并作过焦点的弦 AB。", ["A", "B", "F1", "F2"], ["point_on_curve"]],
    ["已知抛物线 y^2=4x，标出焦点 F、准线和抛物线上一点 P。", ["F", "P"], ["point_on_curve"]],
    ["已知双曲线 x^2/4-y^2/9=1，绘制渐近线并标出两个焦点。", ["F1", "F2"], ["asymptote"]],
    ["圆 x^2+y^2=4 与直线 y=x 相交于 A、B，连接 OA、OB。", ["O", "A", "B"], ["intersection"]],
    ["点 P 在抛物线 y=x^2/2 上运动，A=(-2,0)，B=(2,0)，求三角形 ABP 面积。", ["A", "B", "P"], ["point_on_curve", "area"]]
  ],
  solid_geometry: [
    ["在棱长为 2 的正方体 ABCD-A1B1C1D1 中，连接 AC1、BD1。", ["A", "B", "C", "D", "A1", "B1", "C1", "D1"], ["cube"]],
    ["在直三棱柱 ABC-A1B1C1 中，∠ACB=90°，作 AB、AC1 的中点 D、E 并连接 DE。", ["A", "B", "C", "A1", "B1", "C1", "D", "E"], ["midpoint", "prism"]],
    ["在四面体 ABCD 中，E、F 分别为 AB、CD 的中点，连接 EF。", ["A", "B", "C", "D", "E", "F"], ["midpoint", "tetrahedron"]],
    ["在圆锥 SO 中作过轴 SO 的截面，并标出母线 SA。", ["S", "O", "A"], ["cone", "plane"]],
    ["在长方体 ABCD-A1B1C1D1 中作截面 AC1D1。", ["A", "C1", "D1"], ["cuboid", "plane"]]
  ]
};

const categoryCounts = {
  geometry: 25,
  function: 25,
  analytic_geometry: 35,
  solid_geometry: 15
};

export const goldenProblems = Object.entries(categoryCounts).flatMap(([mathType, count]) => (
  Array.from({ length: count }, (_, index) => {
    const [text, requiredLabels, requiredRelations] = categorySeeds[mathType][index % categorySeeds[mathType].length];
    return {
      id: `${mathType}-${String(index + 1).padStart(2, "0")}`,
      text: `${text}${index >= categorySeeds[mathType].length ? `（变式 ${Math.floor(index / categorySeeds[mathType].length) + 1}）` : ""}`,
      mathType,
      inputKind: index < Math.ceil(count * 0.2) ? "image" : "text",
      requiredLabels,
      requiredRelations,
      requiredObjects: mathType === "solid_geometry" ? ["立体主体", "关键棱线"] : ["主体图形"],
      forbiddenObjectTypes: mathType === "solid_geometry" ? ["2d_only_replacement"] : ["unrequested_3d_object"],
      viewport: mathType === "solid_geometry"
        ? { xmin: -5, xmax: 7, ymin: -5, ymax: 7 }
        : { xmin: -8, xmax: 8, ymin: -6, ymax: 6 },
      expectsDynamicCandidate: mathType === "analytic_geometry" && index >= 10,
      expectsRegionFill: (mathType === "geometry" || mathType === "analytic_geometry") && index % 3 === 0
    };
  })
));

export function summarizeGoldenProblems(problems = goldenProblems) {
  return problems.reduce((summary, problem) => {
    summary.total += 1;
    summary.byType[problem.mathType] = (summary.byType[problem.mathType] || 0) + 1;
    if (problem.inputKind === "image") summary.imageCount += 1;
    if (problem.expectsDynamicCandidate) summary.dynamicCount += 1;
    if (problem.expectsRegionFill) summary.regionFillCount += 1;
    return summary;
  }, { total: 0, byType: {}, imageCount: 0, dynamicCount: 0, regionFillCount: 0 });
}
