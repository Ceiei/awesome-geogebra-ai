import { describe, expect, it } from "vitest";
import { analyzeGgbCommands } from "./ggbCommandParser.js";
import { compileLineDistanceDihedralConstruction } from "./parameterizedConstructionCompiler.js";

describe("parameterized construction compiler", () => {
  it("compiles a native dynamic model for fixed line distances and dihedral angle", () => {
    const result = compileLineDistanceDihedralConstruction({
      distanceC: 2,
      distanceD: 1,
      angle: 60,
      edgeLength: 5
    });

    expect(result.strategy).toBe("native-parameterization");
    expect(result.dynamicControls.map((control) => control.name)).toEqual(["theta", "u", "v"]);
    expect(result.commands).toEqual(expect.arrayContaining([
      "theta=Slider(-180,180,1,1,180,false,true,false,false)",
      "u=Slider(0.5,4.5,0.1,1,180,false,true,false,false)",
      "C=(u,2*cos(theta*pi/180),2*sin(theta*pi/180))",
      "D=(v,1*cos((theta+60)*pi/180),1*sin((theta+60)*pi/180))",
      "regionABC=Polygon(A,B,CFrame1,CFrame0)",
      "regionABD=Polygon(A,B,DFrame1,DFrame0)"
    ]));
    expect(result.commands.some((command) => /Cylinder|=Angle\(/i.test(command))).toBe(false);
    expect(analyzeGgbCommands(result.commands)).toMatchObject({
      syntaxErrors: [],
      unresolved: [],
      duplicateLabels: []
    });
  });

  it("keeps the requested distances and angle in the compiled expressions", () => {
    const result = compileLineDistanceDihedralConstruction({ distanceC: 3, distanceD: 1.5, angle: 45 });

    expect(result.commands).toEqual(expect.arrayContaining([
      "C=(u,3*cos(theta*pi/180),3*sin(theta*pi/180))",
      "D=(v,1.5*cos((theta+45)*pi/180),1.5*sin((theta+45)*pi/180))"
    ]));
    expect(result.parameters).toMatchObject({ distanceC: 3, distanceD: 1.5, angle: 45 });
  });
});
