import express from "express";
import multer from "multer";
import { buildMockCommandsFromSteps, buildMockSolveResult } from "./mockAi.js";
import { generateCommandsWithOpenAI, solveWithOpenAI } from "./openaiClient.js";
import { normalizeSolveResult } from "./solveSchema.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES }
});

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "128kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, validatorVersion: "2026-06-23-parameter-assignments" });
  });

  app.post("/api/solve", upload.single("image"), async (req, res, next) => {
    try {
      const text = String(req.body?.text ?? "");
      const image = req.file;
      const apiKey = typeof req.get("X-OpenAI-API-Key") === "string"
        ? req.get("X-OpenAI-API-Key").trim()
        : "";
      const baseUrl = typeof req.get("X-OpenAI-Base-URL") === "string"
        ? req.get("X-OpenAI-Base-URL").trim()
        : "";
      const model = typeof req.get("X-OpenAI-Model") === "string"
        ? req.get("X-OpenAI-Model").trim()
        : "";

      if (!text.trim() && !image) {
        return res.status(400).json({ error: "请输入题目文字或上传题目图片。" });
      }

      if (image && !allowedImageTypes.has(image.mimetype)) {
        return res.status(415).json({ error: "仅支持 PNG、JPEG 和 WebP 图片。" });
      }

      const rawResult = process.env.USE_MOCK_AI === "1"
        ? buildMockSolveResult(text)
        : await solveWithOpenAI({ text, image, apiKey, baseUrl, model });

      const result = normalizeSolveResult(rawResult);

      if (!result.ggbCommands.length && !result.followupQuestion) {
        return res.status(422).json({
          error: "模型没有生成可安全执行的 GeoGebra 命令。",
          rejectedCommands: result.rejectedCommands
        });
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/commands", async (req, res, next) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const constructionSteps = Array.isArray(body.constructionSteps)
        ? body.constructionSteps.map((step) => String(step).trim()).filter(Boolean)
        : [];
      const apiKey = typeof req.get("X-OpenAI-API-Key") === "string"
        ? req.get("X-OpenAI-API-Key").trim()
        : "";
      const baseUrl = typeof req.get("X-OpenAI-Base-URL") === "string"
        ? req.get("X-OpenAI-Base-URL").trim()
        : "";
      const model = typeof req.get("X-OpenAI-Model") === "string"
        ? req.get("X-OpenAI-Model").trim()
        : "";

      if (!constructionSteps.length) {
        return res.status(400).json({ error: "请至少保留一条构造步骤。" });
      }

      const commandRequest = {
        problemSummary: String(body.problemSummary ?? "").trim(),
        mathType: String(body.mathType ?? "geometry").trim(),
        constructionSteps,
        viewport: body.viewport && typeof body.viewport === "object" ? body.viewport : undefined,
        apiKey,
        baseUrl,
        model
      };

      const rawResult = process.env.USE_MOCK_AI === "1"
        ? buildMockCommandsFromSteps(commandRequest)
        : await generateCommandsWithOpenAI(commandRequest);

      const result = normalizeSolveResult({
        ...rawResult,
        problemSummary: rawResult?.problemSummary || commandRequest.problemSummary,
        mathType: rawResult?.mathType || commandRequest.mathType,
        constructionSteps: rawResult?.constructionSteps?.length ? rawResult.constructionSteps : constructionSteps,
        viewport: rawResult?.viewport || commandRequest.viewport
      });

      if (!result.ggbCommands.length && !result.followupQuestion) {
        return res.status(422).json({
          error: "模型没有根据修订步骤生成可安全执行的 GeoGebra 命令。",
          rejectedCommands: result.rejectedCommands
        });
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "图片大小不能超过 8 MB。" });
    }

    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || "服务器发生异常。" });
  });

  return app;
}
