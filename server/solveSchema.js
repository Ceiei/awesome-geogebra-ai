import { normalizeViewport, validateGgbCommands } from "./ggbValidation.js";

export const solveJsonSchema = {
  name: "geogebra_construction_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "problemSummary",
      "mathType",
      "constructionSteps",
      "ggbCommands",
      "viewport",
      "warnings",
      "followupQuestion"
    ],
    properties: {
      problemSummary: { type: "string" },
      mathType: { type: "string", enum: ["geometry", "function", "analytic_geometry", "solid_geometry"] },
      constructionSteps: {
        type: "array",
        items: { type: "string" }
      },
      ggbCommands: {
        type: "array",
        items: { type: "string" }
      },
      viewport: {
        type: "object",
        additionalProperties: false,
        required: ["xmin", "xmax", "ymin", "ymax"],
        properties: {
          xmin: { type: "number" },
          xmax: { type: "number" },
          ymin: { type: "number" },
          ymax: { type: "number" }
        }
      },
      warnings: {
        type: "array",
        items: { type: "string" }
      },
      followupQuestion: {
        type: ["string", "null"]
      }
    }
  }
};

export function normalizeSolveResult(raw) {
  const result = raw && typeof raw === "object" ? raw : {};
  const { validCommands, rejectedCommands } = validateGgbCommands(result.ggbCommands);

  return {
    problemSummary: String(result.problemSummary ?? "").trim(),
    mathType: ["geometry", "function", "analytic_geometry", "solid_geometry"].includes(result.mathType)
      ? result.mathType
      : "geometry",
    constructionSteps: Array.isArray(result.constructionSteps)
      ? result.constructionSteps.map((step) => String(step).trim()).filter(Boolean)
      : [],
    ggbCommands: validCommands,
    rejectedCommands,
    viewport: normalizeViewport(result.viewport),
    warnings: Array.isArray(result.warnings)
      ? result.warnings.map((warning) => String(warning).trim()).filter(Boolean)
      : [],
    followupQuestion: result.followupQuestion ? String(result.followupQuestion).trim() : null
  };
}
