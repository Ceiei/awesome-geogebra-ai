import { normalizeViewport, validateGgbCommands } from "./ggbValidation.js";
import { mergeDynamicControls } from "../shared/dynamicControls.js";
import { enhanceSolidGeometryCommands } from "../shared/solidGeometryEnhancer.js";
import { enhanceTeachingDiagramCommands } from "../shared/teachingDiagramEnhancer.js";
import { normalizeStyleCommandTargets } from "../shared/styleTargetNormalizer.js";

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
      "dynamicControls",
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
      dynamicControls: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "description", "min", "max", "step"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            min: { type: "number" },
            max: { type: "number" },
            step: { type: "number" }
          }
        }
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

export const commandJsonSchema = {
  name: "geogebra_commands_from_steps",
  strict: true,
  schema: solveJsonSchema.schema
};

export function normalizeSolveResult(raw) {
  const result = raw && typeof raw === "object" ? raw : {};
  const mathType = ["geometry", "function", "analytic_geometry", "solid_geometry"].includes(result.mathType)
    ? result.mathType
    : "geometry";
  const enhancedCommands = normalizeStyleCommandTargets(enhanceTeachingDiagramCommands({
    mathType,
    commands: enhanceSolidGeometryCommands({ mathType, commands: result.ggbCommands })
  }));
  const { validCommands, rejectedCommands } = validateGgbCommands(enhancedCommands);

  return {
    problemSummary: String(result.problemSummary ?? "").trim(),
    mathType,
    constructionSteps: Array.isArray(result.constructionSteps)
      ? result.constructionSteps.map((step) => String(step).trim()).filter(Boolean)
      : [],
    ggbCommands: validCommands,
    rejectedCommands,
    dynamicControls: mergeDynamicControls({
      commands: validCommands,
      dynamicControls: result.dynamicControls
    }),
    viewport: normalizeViewport(result.viewport),
    warnings: Array.isArray(result.warnings)
      ? result.warnings.map((warning) => String(warning).trim()).filter(Boolean)
      : [],
    followupQuestion: result.followupQuestion ? String(result.followupQuestion).trim() : null
  };
}
