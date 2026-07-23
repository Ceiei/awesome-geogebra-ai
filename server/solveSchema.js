import { normalizeViewport, validateGgbCommands } from "./ggbValidation.js";
import { mergeDynamicControls } from "../shared/dynamicControls.js";
import { enhanceSolidGeometryCommands } from "../shared/solidGeometryEnhancer.js";
import { enhanceTeachingDiagramCommands } from "../shared/teachingDiagramEnhancer.js";
import { normalizeStyleCommandTargets } from "../shared/styleTargetNormalizer.js";
import { normalizeSolveResultV2 } from "../shared/solveResultV2.js";
import { applyTeachingTheme } from "../shared/teachingTheme.js";
import { labelAnonymousConstructions } from "../shared/ggbCommandParser.js";

export const solveJsonSchema = {
  name: "geogebra_construction_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "schemaVersion",
      "recognizedProblemText",
      "problemSummary",
      "mathType",
      "problemContract",
      "constructionSteps",
      "objectManifest",
      "ggbCommands",
      "dynamicCandidates",
      "dynamicControls",
      "teachingNotes",
      "viewport",
      "warnings",
      "followupQuestion"
    ],
    properties: {
      schemaVersion: { type: "number", enum: [2] },
      recognizedProblemText: { type: "string" },
      problemSummary: { type: "string" },
      mathType: { type: "string", enum: ["geometry", "function", "analytic_geometry", "solid_geometry"] },
      problemContract: {
        type: "object",
        additionalProperties: false,
        required: ["version", "originalText", "mathType", "fixedExpressions", "requiredLabels", "requiredObjects", "constraints", "targets", "locked"],
        properties: {
          version: { type: "number" },
          originalText: { type: "string" },
          mathType: { type: "string", enum: ["geometry", "function", "analytic_geometry", "solid_geometry"] },
          fixedExpressions: { type: "array", items: { type: "string" } },
          requiredLabels: { type: "array", items: { type: "string" } },
          requiredObjects: { type: "array", items: { type: "string" } },
          constraints: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "type", "objects", "value", "expression", "description"],
              properties: {
                id: { type: "string" },
                type: { type: "string" },
                objects: { type: "array", items: { type: "string" } },
                value: { type: ["number", "string", "null"] },
                expression: { type: "string" },
                description: { type: "string" }
              }
            }
          },
          targets: { type: "array", items: { type: "string" } },
          locked: { type: "boolean" }
        }
      },
      constructionSteps: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "text", "objectLabels", "stage"],
          properties: {
            id: { type: "string" },
            text: { type: "string" },
            objectLabels: { type: "array", items: { type: "string" } },
            stage: { type: "number" }
          }
        }
      },
      objectManifest: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "teacherName", "objectType", "role", "dependencies", "stepId", "stage", "visible", "draggable"],
          properties: {
            label: { type: "string" },
            teacherName: { type: "string" },
            objectType: { type: "string" },
            role: { type: "string", enum: ["original", "key", "conclusion", "helper", "trajectory", "region", "measurement", "parameter", "hidden"] },
            dependencies: { type: "array", items: { type: "string" } },
            stepId: { type: "string" },
            stage: { type: "number" },
            visible: { type: "boolean" },
            draggable: { type: "boolean" }
          }
        }
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
      dynamicCandidates: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "label", "description", "min", "max", "step", "defaultValue", "unit", "affectedObjects", "enabled", "reason"],
          properties: {
            name: { type: "string" },
            label: { type: "string" },
            description: { type: "string" },
            min: { type: "number" },
            max: { type: "number" },
            step: { type: "number" },
            defaultValue: { type: "number" },
            unit: { type: "string" },
            affectedObjects: { type: "array", items: { type: "string" } },
            enabled: { type: "boolean" },
            reason: { type: "string" }
          }
        }
      },
      teachingNotes: {
        type: "object",
        additionalProperties: false,
        required: ["conclusion", "keyReasons", "observationPrompt"],
        properties: {
          conclusion: { type: "string" },
          keyReasons: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "text", "objectLabels"],
              properties: {
                id: { type: "string" },
                text: { type: "string" },
                objectLabels: { type: "array", items: { type: "string" } }
              }
            }
          },
          observationPrompt: { type: "string" }
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

export function normalizeSolveResult(raw, context = {}) {
  const result = raw && typeof raw === "object" ? raw : {};
  const mathType = ["geometry", "function", "analytic_geometry", "solid_geometry"].includes(result.mathType)
    ? result.mathType
    : "geometry";
  const enhancedCommands = normalizeStyleCommandTargets(enhanceTeachingDiagramCommands({
    mathType,
    commands: enhanceSolidGeometryCommands({ mathType, commands: labelAnonymousConstructions(result.ggbCommands) })
  }));
  const { validCommands, rejectedCommands } = validateGgbCommands(enhancedCommands);

  const legacyResult = {
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
  let normalized = normalizeSolveResultV2({
    ...result,
    ...legacyResult
  }, {
    sourceText: context.sourceText || result.recognizedProblemText || result.problemContract?.originalText || "",
    model: context.model || "",
    provider: context.provider || ""
  });
  const themedCommands = applyTeachingTheme(normalized.ggbCommands, normalized.objectManifest, { mathType: normalized.mathType });
  const themedValidation = validateGgbCommands(themedCommands);
  normalized = normalizeSolveResultV2({
    ...normalized,
    ggbCommands: themedValidation.validCommands
  }, {
    sourceText: normalized.recognizedProblemText,
    model: context.model || "",
    provider: context.provider || ""
  });

  return {
    ...normalized,
    rejectedCommands: [...rejectedCommands, ...themedValidation.rejectedCommands]
  };
}
