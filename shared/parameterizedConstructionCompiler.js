function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatNumber(value) {
  const rounded = Math.round(Number(value) * 1e6) / 1e6;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function slider(name, min, max, step) {
  return `${name}=Slider(${formatNumber(min)},${formatNumber(max)},${formatNumber(step)},1,180,false,true,false,false)`;
}

export function compileLineDistanceDihedralConstruction({
  distanceC,
  distanceD,
  angle,
  edgeLength = 5
}) {
  const radiusC = finiteNumber(distanceC, 2);
  const radiusD = finiteNumber(distanceD, 1);
  const angleDegrees = finiteNumber(angle, 60);
  const edge = Math.max(2, finiteNumber(edgeLength, 5));
  const axialMin = 0.5;
  const axialMax = edge - 0.5;
  const cRadialY = `${formatNumber(radiusC)}*cos(theta*pi/180)`;
  const cRadialZ = `${formatNumber(radiusC)}*sin(theta*pi/180)`;
  const dRadialY = `${formatNumber(radiusD)}*cos((theta+${formatNumber(angleDegrees)})*pi/180)`;
  const dRadialZ = `${formatNumber(radiusD)}*sin((theta+${formatNumber(angleDegrees)})*pi/180)`;

  const objects = [
    { label: "theta", teacherName: "点 C、D 绕 AB 旋转", objectType: "Slider", role: "parameter", visible: false, draggable: false },
    { label: "u", teacherName: "点 C 沿 AB 的位置", objectType: "Slider", role: "parameter", visible: false, draggable: false },
    { label: "v", teacherName: "点 D 沿 AB 的位置", objectType: "Slider", role: "parameter", visible: false, draggable: false },
    { label: "A", teacherName: "点 A", objectType: "Point", role: "original", draggable: false },
    { label: "B", teacherName: "点 B", objectType: "Point", role: "original", draggable: false },
    { label: "C", teacherName: "动点 C", objectType: "Point", role: "key", draggable: false },
    { label: "D", teacherName: "动点 D", objectType: "Point", role: "key", draggable: false },
    { label: "HC", teacherName: "点 C 到 AB 的垂足 HC", objectType: "Point", role: "helper", draggable: false },
    { label: "HD", teacherName: "点 D 到 AB 的垂足 HD", objectType: "Point", role: "helper", draggable: false },
    { label: "edgeAB", teacherName: "公共棱 AB", objectType: "Segment", role: "original", draggable: false },
    { label: "distanceC", teacherName: "垂线段 CHC", objectType: "Segment", role: "helper", draggable: false },
    { label: "distanceD", teacherName: "垂线段 DHD", objectType: "Segment", role: "helper", draggable: false },
    { label: "AC", teacherName: "线段 AC", objectType: "Segment", role: "original", draggable: false },
    { label: "AD", teacherName: "线段 AD", objectType: "Segment", role: "original", draggable: false },
    { label: "CD", teacherName: "线段 CD", objectType: "Segment", role: "key", draggable: false },
    { label: "CFrame0", teacherName: "半平面 ABC 边界点", objectType: "Point", role: "hidden", visible: false, draggable: false },
    { label: "CFrame1", teacherName: "半平面 ABC 边界点", objectType: "Point", role: "hidden", visible: false, draggable: false },
    { label: "DFrame0", teacherName: "半平面 ABD 边界点", objectType: "Point", role: "hidden", visible: false, draggable: false },
    { label: "DFrame1", teacherName: "半平面 ABD 边界点", objectType: "Point", role: "hidden", visible: false, draggable: false },
    { label: "regionABC", teacherName: "半平面 ABC 的示意区域", objectType: "Polygon", role: "helper", draggable: false },
    { label: "regionABD", teacherName: "半平面 ABD 的示意区域", objectType: "Polygon", role: "helper", draggable: false },
    { label: "planeABC", teacherName: "计算平面 ABC", objectType: "Plane", role: "hidden", visible: false, draggable: false },
    { label: "planeABD", teacherName: "计算平面 ABD", objectType: "Plane", role: "hidden", visible: false, draggable: false },
    { label: "planeACD", teacherName: "计算平面 ACD", objectType: "Plane", role: "hidden", visible: false, draggable: false }
  ];

  const commands = [
    slider("theta", -180, 180, 1),
    slider("u", axialMin, axialMax, 0.1),
    slider("v", axialMin, axialMax, 0.1),
    "A=(0,0,0)",
    `B=(${formatNumber(edge)},0,0)`,
    `C=(u,${cRadialY},${cRadialZ})`,
    `D=(v,${dRadialY},${dRadialZ})`,
    "HC=(u,0,0)",
    "HD=(v,0,0)",
    "edgeAB=Segment(A,B)",
    "distanceC=Segment(C,HC)",
    "distanceD=Segment(D,HD)",
    "AC=Segment(A,C)",
    "AD=Segment(A,D)",
    "CD=Segment(C,D)",
    `CFrame0=(0,${cRadialY},${cRadialZ})`,
    `CFrame1=(${formatNumber(edge)},${cRadialY},${cRadialZ})`,
    `DFrame0=(0,${dRadialY},${dRadialZ})`,
    `DFrame1=(${formatNumber(edge)},${dRadialY},${dRadialZ})`,
    "regionABC=Polygon(A,B,CFrame1,CFrame0)",
    "regionABD=Polygon(A,B,DFrame1,DFrame0)",
    "planeABC=Plane(A,B,C)",
    "planeABD=Plane(A,B,D)",
    "planeACD=Plane(A,C,D)"
  ];

  const dynamicControls = [
    { name: "theta", label: "点 C、D 绕 AB 旋转", description: "点 C、D 绕 AB 旋转", min: -180, max: 180, step: 1, defaultValue: 0, unit: "°", affectedObjects: ["C", "D", "HC", "HD", "distanceC", "distanceD", "AC", "AD", "CD", "regionABC", "regionABD"] },
    { name: "u", label: "点 C 沿 AB 的位置", description: "点 C 沿 AB 的位置", min: axialMin, max: axialMax, step: 0.1, defaultValue: edge / 2, affectedObjects: ["C", "HC", "distanceC", "AC", "CD"] },
    { name: "v", label: "点 D 沿 AB 的位置", description: "点 D 沿 AB 的位置", min: axialMin, max: axialMax, step: 0.1, defaultValue: edge * 0.65, affectedObjects: ["D", "HD", "distanceD", "AD", "CD"] }
  ];

  return {
    strategy: "native-parameterization",
    compilerVersion: "line-distance-dihedral-v1",
    parameters: { distanceC: radiusC, distanceD: radiusD, angle: angleDegrees, edgeLength: edge },
    objects,
    commands,
    dynamicControls
  };
}
