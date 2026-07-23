import express from "express";
import multer from "multer";
import { buildMockCommandsFromSteps, buildMockSolveResult } from "./mockAi.js";
import {
  generateCommandsWithOpenAI,
  recognizeProblemWithOpenAI,
  reviewConstructionSemanticsWithOpenAI,
  solveWithOpenAI,
  testProviderConnection
} from "./openaiClient.js";
import { normalizeSolveResult } from "./solveSchema.js";
import { findTeachingTemplate } from "./teachingTemplates.js";
import { applyRepairWithinLock, createRepairLock, validateSemanticContract } from "../shared/semanticValidator.js";
import { SOLVE_SCHEMA_VERSION, VALIDATOR_VERSION } from "../shared/solveResultV2.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES }
});

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "128kb" }));
  app.use((req, res, next) => {
    req.traceId = typeof req.get("X-Trace-ID") === "string" && req.get("X-Trace-ID").trim()
      ? req.get("X-Trace-ID").trim().slice(0, 80)
      : crypto.randomUUID();
    res.set("Cache-Control", "no-store");
    res.set("X-Trace-ID", req.traceId);
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, schemaVersion: SOLVE_SCHEMA_VERSION, validatorVersion: VALIDATOR_VERSION });
  });

  app.post("/api/recognize", upload.single("image"), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: "请上传需要识别的题目图片。" });
      if (!allowedImageTypes.has(req.file.mimetype)) {
        return res.status(415).json({ error: "仅支持 PNG、JPEG 和 WebP 图片。" });
      }
      if (process.env.USE_MOCK_AI === "1") {
        return res.json({
          recognizedText: String(req.body?.text || "请在此校对题目识别文字。"),
          uncertainties: [],
          traceId: req.traceId
        });
      }
      const result = await recognizeProblemWithOpenAI({
        image: req.file,
        ...readProviderHeaders(req)
      });
      return res.json({ ...result, traceId: req.traceId });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/solve", upload.single("image"), async (req, res, next) => {
    try {
      const text = String(req.body?.text ?? "");
      const image = req.file;
      const { apiKey, baseUrl, model } = readProviderHeaders(req);

      if (!text.trim() && !image) {
        return res.status(400).json({ error: "请输入题目文字或上传题目图片。" });
      }

      if (image && !allowedImageTypes.has(image.mimetype)) {
        return res.status(415).json({ error: "仅支持 PNG、JPEG 和 WebP 图片。" });
      }

      const templateResult = image ? null : findTeachingTemplate(text);
      const rawResult = templateResult || (process.env.USE_MOCK_AI === "1"
        ? buildMockSolveResult(text)
        : await solveWithOpenAI({ text, image, apiKey, baseUrl, model }));

      const result = normalizeSolveResult(rawResult, { sourceText: text, model });

      if (!result.ggbCommands.length && !result.followupQuestion) {
        return res.status(422).json({
          error: "模型没有生成可安全执行的 GeoGebra 命令。",
          rejectedCommands: result.rejectedCommands
        });
      }

      const semanticReport = validateSemanticContract({
        contract: result.problemContract,
        originalContract: result.problemContract,
        mathType: result.mathType,
        commands: result.ggbCommands,
        objectManifest: result.objectManifest
      });

      res.json({ ...result, semanticReport, traceId: req.traceId });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/commands", async (req, res, next) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const constructionSteps = Array.isArray(body.constructionSteps)
        ? body.constructionSteps.map((step, index) => (
          typeof step === "string"
            ? step.trim()
            : {
              id: String(step?.id || `step-${index + 1}`),
              text: String(step?.text || "").trim(),
              objectLabels: Array.isArray(step?.objectLabels) ? step.objectLabels.map(String) : [],
              stage: Math.max(1, Number(step?.stage) || index + 1)
            }
        )).filter((step) => typeof step === "string" ? Boolean(step) : Boolean(step.text))
        : [];
      const { apiKey, baseUrl, model } = readProviderHeaders(req);

      if (!constructionSteps.length) {
        return res.status(400).json({ error: "请至少保留一条构造步骤。" });
      }

      const commandRequest = {
        problemSummary: String(body.problemSummary ?? "").trim(),
        mathType: String(body.mathType ?? "geometry").trim(),
        problemContract: body.problemContract && typeof body.problemContract === "object" ? body.problemContract : {},
        constructionSteps,
        viewport: body.viewport && typeof body.viewport === "object" ? body.viewport : undefined,
        apiKey,
        baseUrl,
        model
      };

      const templateResult = findTeachingTemplate([
        commandRequest.problemSummary,
        ...constructionSteps.map((step) => typeof step === "string" ? step : step.text)
      ].join(" "));
      const rawResult = templateResult || (process.env.USE_MOCK_AI === "1"
        ? buildMockCommandsFromSteps(commandRequest)
        : await generateCommandsWithOpenAI(commandRequest));

      const generated = normalizeSolveResult({
        ...rawResult,
        problemSummary: rawResult?.problemSummary || commandRequest.problemSummary,
        mathType: commandRequest.mathType,
        problemContract: commandRequest.problemContract,
        constructionSteps: rawResult?.constructionSteps?.length ? rawResult.constructionSteps : constructionSteps,
        viewport: rawResult?.viewport || commandRequest.viewport
      }, { sourceText: commandRequest.problemContract?.originalText || commandRequest.problemSummary, model });
      const result = applyRepairWithinLock({
        ...generated,
        problemSummary: commandRequest.problemSummary,
        mathType: commandRequest.mathType,
        problemContract: commandRequest.problemContract
      }, generated, {
        problemSummary: commandRequest.problemSummary,
        mathType: commandRequest.mathType,
        problemContract: commandRequest.problemContract,
        recognizedProblemText: commandRequest.problemContract?.originalText || generated.recognizedProblemText
      });

      if (!result.ggbCommands.length && !result.followupQuestion) {
        return res.status(422).json({
          error: "模型没有根据修订步骤生成可安全执行的 GeoGebra 命令。",
          rejectedCommands: result.rejectedCommands
        });
      }

      res.json({ ...result, traceId: req.traceId });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/repair", async (req, res, next) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const current = body.currentResult && typeof body.currentResult === "object" ? body.currentResult : null;
      const attempt = Number(body.attempt || 1);
      if (!current?.problemContract || !Array.isArray(current.ggbCommands)) {
        return res.status(400).json({ error: "缺少当前题目合同或绘图命令。" });
      }
      if (attempt < 1 || attempt > 2) {
        return res.status(409).json({ error: "自动修复最多执行两轮。" });
      }
      const lock = createRepairLock(current);
      const provider = readProviderHeaders(req);
      const rawResult = process.env.USE_MOCK_AI === "1"
        ? buildMockCommandsFromSteps({
          ...current,
          constructionSteps: current.constructionSteps
        })
        : await generateCommandsWithOpenAI({
          problemSummary: current.problemSummary,
          mathType: current.mathType,
          problemContract: current.problemContract,
          constructionSteps: current.constructionSteps,
          viewport: current.viewport,
          repairContext: body.runtimeReport || {},
          ...provider
        });
      const normalized = normalizeSolveResult({
        ...rawResult,
        problemSummary: lock.problemSummary,
        mathType: lock.mathType,
        problemContract: lock.problemContract,
        recognizedProblemText: lock.recognizedProblemText
      }, { sourceText: lock.recognizedProblemText, model: provider.model });
      const repaired = applyRepairWithinLock(current, normalized, lock);
      const semanticReport = validateSemanticContract({
        contract: repaired.problemContract,
        originalContract: lock.problemContract,
        mathType: repaired.mathType,
        commands: repaired.ggbCommands,
        objectManifest: repaired.objectManifest
      });
      return res.json({ ...repaired, semanticReport, repairAttempt: attempt, traceId: req.traceId });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/semantic-review", async (req, res, next) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      if (!body.problemContract || !Array.isArray(body.objectManifest)) {
        return res.status(400).json({ error: "缺少题目合同或对象清单。" });
      }
      if (process.env.USE_MOCK_AI === "1") {
        return res.json({ ok: true, issues: [], traceId: req.traceId });
      }
      const result = await reviewConstructionSemanticsWithOpenAI({
        problemContract: body.problemContract,
        mathType: body.mathType,
        objectManifest: body.objectManifest,
        objectStates: body.objectStates,
        commandSummary: Array.isArray(body.commandSummary) ? body.commandSummary.slice(0, 80) : [],
        ...readProviderHeaders(req)
      });
      return res.json({ ...result, traceId: req.traceId });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/provider/test", async (req, res, next) => {
    try {
      if (process.env.USE_MOCK_AI === "1") {
        return res.json({ ok: true, model: req.body?.model || "mock", supportsStructuredOutput: true, supportsVision: true, traceId: req.traceId });
      }
      const settings = {
        apiKey: String(req.body?.apiKey || "").trim() || readProviderHeaders(req).apiKey,
        baseUrl: String(req.body?.baseUrl || "").trim() || readProviderHeaders(req).baseUrl,
        model: String(req.body?.model || "").trim() || readProviderHeaders(req).model
      };
      const result = await testProviderConnection(settings);
      return res.json({ ...result, traceId: req.traceId });
    } catch (error) {
      return next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "图片大小不能超过 8 MB。" });
    }

    const status = error.statusCode || 500;
    const submittedSecrets = [
      _req.get?.("X-OpenAI-API-Key"),
      _req.body?.apiKey,
      process.env.OPENAI_API_KEY
    ];
    res.status(status).json({
      error: sanitizeErrorMessage(error.message || "服务器发生异常。", submittedSecrets),
      code: error.code || "request_failed",
      traceId: _req.traceId
    });
  });

  return app;
}

function readProviderHeaders(req) {
  return {
    apiKey: typeof req.get("X-OpenAI-API-Key") === "string" ? req.get("X-OpenAI-API-Key").trim() : "",
    baseUrl: typeof req.get("X-OpenAI-Base-URL") === "string" ? req.get("X-OpenAI-Base-URL").trim() : "",
    model: typeof req.get("X-OpenAI-Model") === "string" ? req.get("X-OpenAI-Model").trim() : ""
  };
}

function sanitizeErrorMessage(message, secrets = []) {
  let sanitized = String(message || "");
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length >= 6) sanitized = sanitized.replaceAll(secret, "[API_KEY]");
  }
  return sanitized
    .replace(/\bsk-[A-Za-z0-9._-]{8,}\b/g, "[API_KEY]")
    .replace(/\bAIza[A-Za-z0-9_-]{12,}\b/g, "[API_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .slice(0, 500);
}
