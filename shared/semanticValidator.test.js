import { describe, expect, it } from "vitest";
import { applyRepairWithinLock, createRepairLock, validateSemanticContract } from "./semanticValidator.js";

const contract = {
  originalText: "抛物线 y²=4x",
  mathType: "analytic_geometry",
  fixedExpressions: ["y^2=4x"],
  requiredLabels: ["C"],
  requiredObjects: [],
  constraints: [],
  targets: [],
  locked: true
};

describe("semantic validator", () => {
  it("accepts algebraically equivalent fixed equations", () => {
    const report = validateSemanticContract({
      contract,
      mathType: "analytic_geometry",
      commands: ["C: x=y^2/4"]
    });
    expect(report.ok).toBe(true);
  });

  it("rejects changed equations and missing labels", () => {
    const report = validateSemanticContract({
      contract,
      mathType: "analytic_geometry",
      commands: ["E: x=y^2/8"]
    });
    expect(report.ok).toBe(false);
    expect(report.issues.map((item) => item.code)).toEqual(expect.arrayContaining([
      "fixed_expression_missing",
      "required_label_missing"
    ]));
  });

  it("keeps the immutable contract during repair", () => {
    const current = {
      recognizedProblemText: contract.originalText,
      problemSummary: "原摘要",
      mathType: contract.mathType,
      problemContract: contract,
      ggbCommands: ["C: x=y^2/4"]
    };
    const lock = createRepairLock(current);
    const repaired = applyRepairWithinLock(current, {
      problemSummary: "被篡改",
      mathType: "solid_geometry",
      problemContract: { ...contract, fixedExpressions: ["x^2+y^2=1"] },
      ggbCommands: ["C: y^2=4x"]
    }, lock);
    expect(repaired.problemSummary).toBe("原摘要");
    expect(repaired.mathType).toBe("analytic_geometry");
    expect(repaired.problemContract).toEqual(contract);
  });

  it("checks midpoint and coplanar coordinates numerically", () => {
    const report = validateSemanticContract({
      contract: {
        ...contract,
        requiredLabels: [],
        fixedExpressions: [],
        constraints: [
          { type: "midpoint", objects: ["M", "A", "B"], description: "M 是 AB 中点" },
          { type: "coplanar", objects: ["A", "B", "C", "D"], description: "四点共面" }
        ]
      },
      mathType: "analytic_geometry",
      commands: ["A=(0,0)", "B=(2,0)", "C=(0,2)", "D=(1,1)", "M=(2,0)"],
      objectStates: {
        A: { coordinates: [0, 0, 0] },
        B: { coordinates: [2, 0, 0] },
        C: { coordinates: [0, 2, 0] },
        D: { coordinates: [1, 1, 0] },
        M: { coordinates: [2, 0, 0] }
      }
    });
    expect(report.ok).toBe(false);
    expect(report.issues.some((item) => item.code === "constraint_midpoint")).toBe(true);
    expect(report.issues.some((item) => item.code === "constraint_coplanar")).toBe(false);
  });

  it("matches teacher terminology such as ellipse and focus to typed objects", () => {
    const report = validateSemanticContract({
      contract: {
        ...contract,
        fixedExpressions: ["x^2/9+y^2/4=1"],
        requiredLabels: ["F1", "F2"],
        requiredObjects: ["椭圆", "焦点", "三角形"]
      },
      mathType: "analytic_geometry",
      commands: [
        "E: x^2/9+y^2/4=1",
        "F1=(-2,0)",
        "F2=(2,0)",
        "P=(0,2)",
        "tri=Polygon(F1,F2,P)"
      ],
      objectManifest: [
        { label: "E", teacherName: "曲线 E", objectType: "Equation" },
        { label: "F1", teacherName: "点 F1", objectType: "Point" },
        { label: "F2", teacherName: "点 F2", objectType: "Point" },
        { label: "tri", teacherName: "三角形 F1F2P", objectType: "Polygon" }
      ]
    });
    expect(report.ok).toBe(true);
  });
});
