import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("solve API", () => {
  const originalMock = process.env.USE_MOCK_AI;

  afterEach(() => {
    if (originalMock === undefined) {
      delete process.env.USE_MOCK_AI;
    } else {
      process.env.USE_MOCK_AI = originalMock;
    }
  });

  it("rejects empty requests", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp()).post("/api/solve").field("text", "");
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("请输入题目");
  });

  it("accepts an image-only problem without a separate OCR confirmation request", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/solve")
      .attach("image", Buffer.from("image bytes"), {
        filename: "solid-geometry.png",
        contentType: "image/png"
      });

    expect(response.status).toBe(200);
    expect(response.body.schemaVersion).toBe(2);
    expect(response.body.ggbCommands.length).toBeGreaterThan(0);
  });

  it("accepts existing text as a hint during image recognition", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/recognize")
      .field("text", "在空间中，二面角 C-AB-D 为 60°。")
      .attach("image", Buffer.from("image bytes"), {
        filename: "solid-geometry.png",
        contentType: "image/png"
      });

    expect(response.status).toBe(200);
    expect(response.body.recognizedText).toBe("在空间中，二面角 C-AB-D 为 60°。");
  });

  it("marks API responses as non-cacheable and attaches a trace id", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp()).get("/api/health");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-trace-id"]).toBeTruthy();
  });

  it("returns a normalized mock solve result", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/solve")
      .field("text", "Plot y = x^2 - 3x + 2 and mark roots");

    expect(response.status).toBe(200);
    expect(response.body.mathType).toBe("function");
    expect(response.body.ggbCommands.length).toBeGreaterThan(0);
    expect(response.body.rejectedCommands).toEqual([]);
  });

  it("prioritizes dynamic area demonstrations over plain function matching", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/solve")
      .field("text", "设点 P 在抛物线 y=x^2/2 上运动，观察三角形 ABP 的面积变化。");

    expect(response.status).toBe(200);
    expect(response.body.mathType).toBe("analytic_geometry");
    expect(response.body.dynamicControls).toEqual([
      { name: "t", description: "动点 P 的位置", min: -3, max: 3, step: 0.1 }
    ]);
    expect(response.body.ggbCommands).toEqual(expect.arrayContaining([
      "t=Slider(-3,3,0.1,1,180,false,true,false,false)",
      "H=(t,0)",
      "tri=Polygon(A,B,P)",
      "h=Segment(P,H)",
      "SetFilling(tri,0.3)"
    ]));
  });

  it("returns dynamic tangent and secant helpers for slope demonstrations", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/solve")
      .field("text", "观察抛物线 y=x^2 上动点处切线斜率如何变化。");

    expect(response.status).toBe(200);
    expect(response.body.mathType).toBe("analytic_geometry");
    expect(response.body.dynamicControls).toEqual([
      { name: "t", description: "切点 P 的位置", min: -2.5, max: 2.5, step: 0.1 }
    ]);
    expect(response.body.ggbCommands).toEqual(expect.arrayContaining([
      "t=Slider(-2.5,2.5,0.1,1,180,false,true,false,false)",
      "secant=Line(P,Q)",
      "tangent=Tangent(P,f)",
      "SetColor(secant,31,41,55)",
      "SetColor(tangent,37,99,235)"
    ]));
  });

  it("returns a styled locus helper for trajectory demonstrations", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/solve")
      .field("text", "点 P 在抛物线 y=x^2/2 上运动，取 AP 中点 M，观察 M 的轨迹。");

    expect(response.status).toBe(200);
    expect(response.body.mathType).toBe("analytic_geometry");
    expect(response.body.dynamicControls).toEqual([
      { name: "t", description: "动点 P 的位置", min: -3, max: 3, step: 0.1 }
    ]);
    expect(response.body.rejectedCommands).toEqual([]);
    expect(response.body.ggbCommands).toEqual(expect.arrayContaining([
      "t=Slider(-3,3,0.1,1,180,false,true,false,false)",
      "M=Midpoint(A,P)",
      "path=Locus(M,t)",
      "SetColor(path,13,148,136)",
      "SetLineThickness(path,4)"
    ]));
  });

  it("returns slope and intercept sliders for line family demonstrations", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/solve")
      .field("text", "观察直线 y=kx+b 的斜率和截距变化时，与抛物线 y=x^2/2 的交点如何变化。");

    expect(response.status).toBe(200);
    expect(response.body.mathType).toBe("analytic_geometry");
    expect(response.body.dynamicControls).toEqual([
      { name: "k", description: "直线斜率", min: -3, max: 3, step: 0.1 },
      { name: "b", description: "直线截距", min: -1, max: 3, step: 0.1 }
    ]);
    expect(response.body.rejectedCommands).toEqual([]);
    expect(response.body.ggbCommands).toEqual(expect.arrayContaining([
      "k=Slider(-3,3,0.1,1,180,false,true,false,false)",
      "b=Slider(-1,3,0.1,1,180,false,true,false,false)",
      "l=Line((0,b),(1,k+b))",
      "A=Intersect(f,l,1)",
      "B=Intersect(f,l,2)",
      "SetColor(slopeLine,31,41,55)"
    ]));
  });

  it("keeps triangle area, perpendicular helper, and point labels for line-family area problems", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/solve")
      .field("text", "已知抛物线 C: y=x^2/2，直线 l: y=kx+1 与抛物线 C 交于 A、B 两点。设点 P 为线段 AB 的中点，过点 P 作 x 轴的垂线，垂足为 H。求点 P 的轨迹，并观察三角形 ABH 的面积如何变化。");

    expect(response.status).toBe(200);
    expect(response.body.mathType).toBe("analytic_geometry");
    expect(response.body.dynamicControls).toEqual([
      { name: "k", description: "直线斜率", min: -1, max: 3, step: 0.1 }
    ]);
    expect(response.body.rejectedCommands).toEqual([]);
    expect(response.body.ggbCommands).toEqual(expect.arrayContaining([
      "k=Slider(-1,3,0.1,1,180,false,true,false,false)",
      "A=Intersect(f,l,1)",
      "B=Intersect(f,l,2)",
      "P=Midpoint(A,B)",
      "vertical=OrthogonalLine(P,xAxisLine)",
      "H=Intersect(vertical,xAxisLine)",
      "TriangleABH=Polygon(A,B,H)",
      "height=Segment(P,H)",
      "AreaABH=Area(TriangleABH)",
      "SetFilling(TriangleABH,0.3)",
      "SetColor(height,107,114,128)",
      "ShowLabel(P,true)",
      "ShowLabel(H,true)"
    ]));
  });

  it("keeps focus, directrix, filled triangle, perpendicular foot, and locus for sideways parabola problems", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/solve")
      .field("text", "已知抛物线 C: y^2=4x，焦点为 F，准线为 x=-1。过点 T(t,0) 作斜率为 k 的直线 l，与抛物线交于 A、B 两点。设 M 为 AB 中点，过 M 作准线的垂线，垂足为 H。观察 M 的轨迹和三角形 FAB 的面积变化。");

    expect(response.status).toBe(200);
    expect(response.body.mathType).toBe("analytic_geometry");
    expect(response.body.dynamicControls).toEqual([
      { name: "t", description: "点 T 的横坐标", min: 0, max: 4, step: 0.1 },
      { name: "k", description: "直线斜率", min: 0.4, max: 2.4, step: 0.1 }
    ]);
    expect(response.body.rejectedCommands).toEqual([]);
    expect(response.body.ggbCommands).toEqual(expect.arrayContaining([
      "C: x=y^2/4",
      "k=Slider(0.4,2.4,0.1,1,180,false,true,false,false)",
      "F=(1,0)",
      "directrix=Line((-1,-7),(-1,7))",
      "l=Line(T,(t+1,k))",
      "A=Intersect(C,l,1)",
      "B=Intersect(C,l,2)",
      "M=Midpoint(A,B)",
      "H=(-1,y(M))",
      "height=Segment(M,H)",
      "TriangleFAB=Polygon(F,A,B)",
      "AreaFAB=Area(TriangleFAB)",
      "path=Locus(M,k)",
      "SetFilling(TriangleFAB,0.3)",
      "SetColor(height,107,114,128)",
      "SetColor(path,13,148,136)"
    ]));
  });

  it("uses the parameterized ellipse template without fabricating its equation", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/solve")
      .field("text", "解析几何：椭圆 x²/9+y²/4=1 上的动点 P 与两个焦点构成的三角形面积如何变化？");

    expect(response.status).toBe(200);
    expect(response.body.mathType).toBe("analytic_geometry");
    expect(response.body.rejectedCommands).toEqual([]);
    expect(response.body.dynamicControls).toEqual([
      { name: "t", description: "动点 P 的位置", min: -2.7, max: 2.7, step: 0.1 }
    ]);
    expect(response.body.dynamicCandidates[0]).toMatchObject({
      name: "t",
      label: "动点 P 的位置",
      enabled: true
    });
    expect(response.body.problemContract.fixedExpressions).toContain("x^2/9+y^2/4=1");
    expect(response.body.ggbCommands).toEqual(expect.arrayContaining([
      "E: x^2/9+y^2/4=1",
      "TriangleF1F2P=Polygon(F1,F2,P)",
      "AreaF1F2P=Area(TriangleF1F2P)"
    ]));
  });

  it("recognizes focus labels with Unicode subscripts in the built-in example", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/solve")
      .field("text", "已知椭圆 x²/9+y²/4=1，点 P 在椭圆上运动，求并观察三角形 PF₁F₂ 的面积变化。");
    expect(response.status).toBe(200);
    expect(response.body.generationMeta.templateId).toBe("ellipse-moving-point-area-v3");
    expect(response.body.problemContract.fixedExpressions).toContain("x^2/9+y^2/4=1");
  });

  it("uses the built-in quadratic interval endpoint template", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/solve")
      .field("text", "二次函数 f(x)=-(x-1)^2+4 在区间上的最大值和最小值随左右端点变化如何观察？");

    expect(response.status).toBe(200);
    expect(response.body.mathType).toBe("function");
    expect(response.body.rejectedCommands).toEqual([]);
    expect(response.body.dynamicControls).toEqual([
      { name: "a", description: "区间左端点", min: -3, max: 0.8, step: 0.1 },
      { name: "b", description: "区间右端点", min: 1.2, max: 4, step: 0.1 }
    ]);
    expect(response.body.ggbCommands).toEqual(expect.arrayContaining([
      "f(x)=-(x-1)^2+4",
      "leftHeight=Segment(A,A0)",
      "rightHeight=Segment(B,B0)",
      "intervalBase=Segment(A0,B0)"
    ]));
  });

  it("uses the built-in cube section template", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/solve")
      .field("text", "立体几何：棱长为4的正方体被水平平面截割，观察截面形状随高度变化。");

    expect(response.status).toBe(200);
    expect(response.body.mathType).toBe("solid_geometry");
    expect(response.body.rejectedCommands).toEqual([]);
    expect(response.body.dynamicControls).toEqual([
      { name: "h", description: "截面高度", min: 0, max: 4, step: 0.1 }
    ]);
    expect(response.body.dynamicCandidates[0]).toMatchObject({
      name: "h",
      label: "截面高度",
      min: 0,
      max: 4,
      enabled: true
    });
    expect(response.body.ggbCommands).toEqual(expect.arrayContaining([
      "h=Slider(0,4,0.1,1,180,false,true,false,false)",
      "P1=(0,0,h)",
      "cutSection=Polygon(P1,P2,P3,P4)"
    ]));
  });

  it("compiles teacher-edited cube section steps without calling the model", async () => {
    delete process.env.USE_MOCK_AI;
    const constructionSteps = [
      "绘制正方体 ABCD-A₁B₁C₁D₁，A(0,0,0)，B(4,0,0)，C(4,4,0)，D(0,4,0)，A₁(0,0,4)，B₁(4,0,4)，C₁(4,4,4)，D₁(0,4,4)。",
      "创建滑动条 h，范围 [0,4]，表示截平面 z=h 的高度。",
      "求截平面与 AA₁、BB₁、CC₁、DD₁ 的交点。",
      "连接交点形成截面正方形，并以多边形形式高亮，验证边长为 4。"
    ];
    const response = await request(createApp())
      .post("/api/commands")
      .send({ constructionSteps });

    expect(response.status).toBe(200);
    expect(response.body.mathType).toBe("solid_geometry");
    expect(response.body.rejectedCommands).toEqual([]);
    expect(response.body.ggbCommands).toEqual(expect.arrayContaining([
      "A=(0,0,0)",
      "C1=(4,4,4)",
      "edgeAA1=Segment(A,A1)",
      "cutSection=Polygon(P1,P2,P3,P4)"
    ]));
  });

  it("keeps horizontal and vertical cube sections mathematically distinct", async () => {
    delete process.env.USE_MOCK_AI;
    const horizontalProblem = "棱长为 4 的正方体 ABCD-A₁B₁C₁D₁ 被水平平面截割，观察截面随高度变化。";
    const verticalProblem = "棱长为 4 的正方体 ABCD-A₁B₁C₁D₁ 被垂直平面截割，观察截面随高度变化。";

    const horizontalPlan = await request(createApp()).post("/api/plan").field("text", horizontalProblem);
    const verticalPlan = await request(createApp()).post("/api/plan").field("text", verticalProblem);
    expect(horizontalPlan.status).toBe(200);
    expect(verticalPlan.status).toBe(200);
    expect(horizontalPlan.body.constructionSteps.map((step) => step.text).join(" ")).toContain("z=h");
    expect(verticalPlan.body.constructionSteps.map((step) => step.text).join(" ")).toContain("x=s");
    expect(verticalPlan.body.constructionSteps.map((step) => step.text).join(" ")).not.toContain("z=h");

    const horizontalCommands = await request(createApp())
      .post("/api/commands")
      .send({ constructionSteps: horizontalPlan.body.constructionSteps });
    const verticalCommands = await request(createApp())
      .post("/api/commands")
      .send({ constructionSteps: verticalPlan.body.constructionSteps });
    expect(horizontalCommands.body.ggbCommands).toEqual(expect.arrayContaining([
      "h=Slider(0,4,0.1,1,180,false,true,false,false)",
      "P1=(0,0,h)",
      "P3=(4,4,h)"
    ]));
    expect(verticalCommands.body.ggbCommands).toEqual(expect.arrayContaining([
      "s=Slider(0,4,0.1,1,180,false,true,false,false)",
      "P1=(s,0,0)",
      "P3=(s,4,4)"
    ]));
    expect(verticalCommands.body.ggbCommands).not.toContain("P1=(0,0,h)");
  });

  it("uses orientation and position controls when the cube section plane is arbitrary", async () => {
    delete process.env.USE_MOCK_AI;
    const problem = "棱长为 4 的正方体 ABCD-A₁B₁C₁D₁ 被平面截割，观察截面形状变化。";
    const plan = await request(createApp()).post("/api/plan").field("text", problem);

    expect(plan.status).toBe(200);
    const stepText = plan.body.constructionSteps.map((step) => step.text).join(" ");
    expect(stepText).toContain("任意截平面");
    expect(stepText).toContain("截面方位角");
    expect(stepText).not.toContain("水平截面 z=h");
    expect(stepText).not.toContain("垂直截面 x=s");

    const commands = await request(createApp())
      .post("/api/commands")
      .send({ constructionSteps: plan.body.constructionSteps });
    expect(commands.status).toBe(200);
    expect(commands.body.generationMeta).toMatchObject({ sectionOrientation: "arbitrary" });
    expect(commands.body.ggbCommands).toEqual(expect.arrayContaining([
      "azimuth=Slider(0,360,1,1,180,false,true,false,false)",
      "tilt=Slider(1,179,1,1,180,false,true,false,false)",
      "baseFace=Polygon(A,B,C,D)",
      "cubeSolid=Prism(baseFace,A1)",
      "cutSection=Intersect(cutPlane,cubeSolid)"
    ]));
    expect(commands.body.ggbCommands).not.toContain("P1=(0,0,h)");
    expect(commands.body.dynamicControls.map((control) => control.name)).toEqual(["azimuth", "tilt", "planeShift"]);
  });

  it("returns a domain-independent semantic model and reports edited construction meaning", async () => {
    delete process.env.USE_MOCK_AI;
    const horizontalProblem = "棱长为 4 的正方体被水平平面截割，观察截面变化。";
    const horizontalPlan = await request(createApp()).post("/api/plan").field("text", horizontalProblem);

    expect(horizontalPlan.status).toBe(200);
    expect(horizontalPlan.body.mathematicalModel).toMatchObject({ version: 1, mathType: "solid_geometry" });
    expect(horizontalPlan.body.constructionModel.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "orientation", value: "horizontal" })
    ]));

    const editedSteps = horizontalPlan.body.constructionSteps.map((step, index) => (
      index === 1
        ? { ...step, text: "创建方位角、倾角和位置参数，构造任意截平面。" }
        : step
    ));
    const commands = await request(createApp()).post("/api/commands").send({
      constructionSteps: editedSteps,
      previousConstructionModel: horizontalPlan.body.constructionModel
    });

    expect(commands.status).toBe(200);
    expect(commands.body.compilationReport).toEqual({ ok: true, errors: [] });
    expect(commands.body.constructionGraph.nodes.length).toBe(commands.body.ggbCommands.length);
    expect(commands.body.semanticDiff.changed).toBe(true);
    expect(commands.body.semanticDiff.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "orientation", before: ["horizontal"], after: ["arbitrary"] })
    ]));
  });

  it("uses a constraint-preserving template for line distances and a dihedral angle", async () => {
    process.env.USE_MOCK_AI = "1";
    const problem = "10. 在空间中，A、B为两个定点，动点C到直线AB的距离为2，动点D到直线AB的距离为1．若二面角C−AB−D为60°，则（ ） A. ∠CAD≥60° B. CD≥√3 C. 当AB⊥CD时，CD⊥平面ABD D. 当AB⊥平面ACD时，AC⊥AD";
    const response = await request(createApp())
      .post("/api/solve")
      .field("text", problem);

    expect(response.status).toBe(200);
    expect(response.body.mathType).toBe("solid_geometry");
    expect(response.body.generationMeta).toMatchObject({
      templateId: "line-distance-dihedral-v5",
      constructionStrategy: "native-parameterization",
      compilerVersion: "line-distance-dihedral-v1"
    });
    expect(response.body.dynamicControls).toEqual([
      { name: "theta", description: "点 C、D 绕 AB 旋转", min: -180, max: 180, step: 1 },
      { name: "u", description: "点 C 沿 AB 的位置", min: 0.5, max: 4.5, step: 0.1 },
      { name: "v", description: "点 D 沿 AB 的位置", min: 0.5, max: 4.5, step: 0.1 }
    ]);
    expect(response.body.ggbCommands).toEqual(expect.arrayContaining([
      "C=(u,2*cos(theta*pi/180),2*sin(theta*pi/180))",
      "D=(v,1*cos((theta+60)*pi/180),1*sin((theta+60)*pi/180))",
      "distanceC=Segment(C,HC)",
      "distanceD=Segment(D,HD)",
      "regionABC=Polygon(A,B,CFrame1,CFrame0)",
      "regionABD=Polygon(A,B,DFrame1,DFrame0)",
      "SetFilling(regionABC,0.08)",
      "SetFilling(regionABD,0.08)"
    ]));
    expect(response.body.ggbCommands.some((command) => /Cylinder/i.test(command))).toBe(false);
    expect(response.body.ggbCommands.some((command) => /=Angle\(/i.test(command))).toBe(false);
    expect(response.body.semanticReport).toMatchObject({ ok: true, requiresSemanticReview: false });
  });

  it("rejects unsupported image MIME types", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/solve")
      .field("text", "Draw this")
      .attach("image", Buffer.from("not an image"), {
        filename: "problem.txt",
        contentType: "text/plain"
      });

    expect(response.status).toBe(415);
  });

  it("rejects command regeneration without construction steps", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp()).post("/api/commands").send({ constructionSteps: [] });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("构造步骤");
  });

  it("returns only ordered construction steps from the plan endpoint", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/plan")
      .field("text", "构造三角形 ABC，并作角平分线。");

    expect(response.status).toBe(200);
    expect(response.body.constructionSteps.length).toBeGreaterThan(0);
    expect(response.body).not.toHaveProperty("ggbCommands");
    expect(response.body).not.toHaveProperty("teachingNotes");
  });

  it("generates commands from steps even when unrelated problem fields are supplied", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/commands")
      .send({
        problemSummary: "正方体立体几何，这个字段必须被忽略",
        mathType: "solid_geometry",
        constructionSteps: ["放置 A、B、C 三点。", "连接三点形成三角形。"]
      });

    expect(response.status).toBe(200);
    expect(response.body.mathType).toBe("geometry");
    expect(response.body.ggbCommands).toContain("region1=Polygon(A,B,C)");
  });

  it("bypasses a matching built-in template for an explicit reparse", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/solve")
      .field("text", "已知椭圆 x²/9+y²/4=1，点 P 在椭圆上运动，观察三角形面积变化。")
      .field("forceReparse", "1");

    expect(response.status).toBe(200);
    expect(response.body.generationMeta?.templateId).not.toBe("ellipse-moving-point-area-v3");
  });

  it("performs a constrained semantic review for complex constructions", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/semantic-review")
      .send({
        mathType: "solid_geometry",
        problemContract: {
          originalText: "正方体",
          mathType: "solid_geometry",
          fixedExpressions: [],
          requiredLabels: ["A"],
          requiredObjects: [],
          constraints: [],
          targets: [],
          locked: true
        },
        objectManifest: [{ label: "A" }],
        objectStates: { A: { coordinates: [0, 0, 0] } },
        commandSummary: ["A=(0,0,0)"]
      });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, issues: [] });
  });

  it("regenerates safe commands from edited construction steps", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/commands")
      .send({
        problemSummary: "构造三角形",
        mathType: "geometry",
        constructionSteps: ["放置 A、B、C 三点。", "连接三条边。"],
        viewport: { xmin: -5, xmax: 5, ymin: -4, ymax: 5 }
      });

    expect(response.status).toBe(200);
    expect(response.body.constructionSteps.map((step) => step.text)).toEqual(["放置 A、B、C 三点。", "连接三条边。"]);
    expect(response.body.ggbCommands).toContain("region1=Polygon(A,B,C)");
  });

  it("keeps the teacher-edited construction steps in regenerated results", async () => {
    process.env.USE_MOCK_AI = "1";
    const editedSteps = ["放置 A、B、C 三点。", "新增中点 M 并连接 AM。"];
    const response = await request(createApp())
      .post("/api/commands")
      .send({
        problemSummary: "构造三角形并添加中线",
        mathType: "geometry",
        constructionSteps: editedSteps,
        previousConstructionSteps: ["放置 A、B、C 三点。", "连接三条边。"],
        previousCommands: ["A=(0,0)"]
      });

    expect(response.status).toBe(200);
    expect(response.body.constructionSteps.map((step) => step.text)).toEqual(editedSteps);
  });

  it("regenerates dynamic commands when edited steps describe a moving point area", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/commands")
      .send({
        problemSummary: "观察动点形成的三角形面积变化",
        mathType: "analytic_geometry",
        constructionSteps: [
          "创建参数滑动条 t，表示点 P 在抛物线上的横坐标。",
          "定义 P=(t,t^2/2)，连接 A、B、P 形成三角形。",
          "填充三角形并显示面积变化。"
        ],
        viewport: { xmin: -4, xmax: 4, ymin: -1, ymax: 6 }
      });

    expect(response.status).toBe(200);
    expect(response.body.constructionSteps.map((step) => step.text)).toEqual([
      "创建参数滑动条 t，表示点 P 在抛物线上的横坐标。",
      "定义 P=(t,t^2/2)，连接 A、B、P 形成三角形。",
      "填充三角形并显示面积变化。"
    ]);
    expect(response.body.dynamicControls).toEqual([
      { name: "t", description: "动点 P 的位置", min: -3, max: 3, step: 0.1 }
    ]);
    expect(response.body.ggbCommands).toEqual(expect.arrayContaining([
      "t=Slider(-3,3,0.1,1,180,false,true,false,false)",
      "tri=Polygon(A,B,P)",
      "area=Area(tri)",
      "SetFilling(tri,0.3)"
    ]));
  });

  it("regenerates line-family dynamic commands from edited construction steps", async () => {
    process.env.USE_MOCK_AI = "1";
    const response = await request(createApp())
      .post("/api/commands")
      .send({
        problemSummary: "观察直线斜率和截距变化",
        mathType: "analytic_geometry",
        constructionSteps: [
          "创建 k 和 b 两个滑动条，分别控制直线斜率和截距。",
          "绘制直线 y=kx+b 与抛物线 y=x^2/2 的交点。",
          "拖动 k、b 观察交点位置变化。"
        ],
        viewport: { xmin: -5, xmax: 5, ymin: -3, ymax: 7 }
      });

    expect(response.status).toBe(200);
    expect(response.body.constructionSteps.map((step) => step.text)).toEqual([
      "创建 k 和 b 两个滑动条，分别控制直线斜率和截距。",
      "绘制直线 y=kx+b 与抛物线 y=x^2/2 的交点。",
      "拖动 k、b 观察交点位置变化。"
    ]);
    expect(response.body.dynamicControls).toEqual([
      { name: "k", description: "直线斜率", min: -3, max: 3, step: 0.1 },
      { name: "b", description: "直线截距", min: -1, max: 3, step: 0.1 }
    ]);
    expect(response.body.rejectedCommands).toEqual([]);
    expect(response.body.ggbCommands).toEqual(expect.arrayContaining([
      "k=Slider(-3,3,0.1,1,180,false,true,false,false)",
      "b=Slider(-1,3,0.1,1,180,false,true,false,false)",
      "l=Line((0,b),(1,k+b))",
      "A=Intersect(f,l,1)",
      "B=Intersect(f,l,2)",
      "SetColor(slopeLine,31,41,55)"
    ]));
  });
});
