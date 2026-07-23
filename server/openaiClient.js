import "dotenv/config";
import OpenAI from "openai";
import { buildSystemPrompt } from "./promptProfiles.js";
import { commandJsonSchema, solveJsonSchema } from "./solveSchema.js";
import { findProviderByBaseUrl, getAllowedProviderHosts, providerPresets } from "../shared/providerPresets.js";

export { providerPresets };

const allowedBaseUrlHosts = getAllowedProviderHosts();

const defaultModelByHost = new Map(
  providerPresets.flatMap((provider) => provider.allowedHosts.map((host) => [host, provider.model]))
);

function buildJsonInstruction() {
  return [
    "请只返回一个 JSON 对象，不要使用 Markdown 代码块。",
    "JSON 必须符合 SolveResultV2，包含 schemaVersion、recognizedProblemText、problemSummary、mathType、problemContract、constructionSteps、objectManifest、ggbCommands、dynamicCandidates、dynamicControls、teachingNotes、viewport、warnings、followupQuestion。",
    "problemContract 必须忠实保存题目固定条件；不能补造题目未提供的方程或数值。",
    "constructionSteps 每项必须包含 id、text、objectLabels、stage。",
    "如果存在自然可变对象，将其放入 dynamicCandidates；只有题目明确要求动态演示时才同步放入 dynamicControls。",
    "mathType 只能是 geometry、function、analytic_geometry 或 solid_geometry。",
    "viewport 必须包含 xmin、xmax、ymin、ymax 四个数字。",
    "ggbCommands 必须是字符串数组，每个字符串是一条 GeoGebra 命令。"
  ].join("\n");
}

function buildCommandUserText({ problemSummary, mathType, problemContract, constructionSteps, viewport, repairContext }) {
  return [
    "请根据用户修订后的构造步骤，重新生成完整 GeoGebra 命令。",
    "如果修订步骤体现可变点、任意点、参数、面积变化、斜率变化、轨迹或切割过程，应生成 GeoGebra 原生 Slider 滑动条和依赖对象；即使步骤没有明确说“动态演示”，也要为自然可变对象补滑动条。",
    "不要重新解释或修改题目，不要省略已需要的基础对象定义。",
    "problemContract 是不可变合同。返回内容中的 mathType、recognizedProblemText、problemSummary 和 problemContract 必须与输入一致。",
    "如果步骤中提到点、线段、平面、函数、角度、距离或辅助对象，必须先定义对象再使用。",
    "",
    `题目摘要：${problemSummary || "未提供"}`,
    `数学类型：${mathType || "geometry"}`,
    `不可变题目合同：${JSON.stringify(problemContract || {})}`,
    `建议视野：${JSON.stringify(viewport || {})}`,
    "用户修订后的构造步骤：",
    constructionSteps.map((step, index) => `${index + 1}. ${typeof step === "string" ? step : step?.text || ""}`).join("\n"),
    repairContext ? `运行时修复信息：${JSON.stringify(repairContext)}` : "",
    "",
    buildJsonInstruction()
  ].join("\n");
}

function buildUserContent({ text, image }) {
  const content = [
    {
      type: "input_text",
      text: text?.trim()
        ? `题目文字：\n${text.trim()}`
        : "用户上传了一张题目图片。请读取图片中的数学题，并构造最合适的 GeoGebra 可视化。"
    }
  ];

  if (image) {
    content.push({
      type: "input_image",
      image_url: `data:${image.mimetype};base64,${image.buffer.toString("base64")}`
    });
  }

  return content;
}

function buildChatContent({ text, image }) {
  const content = [
    {
      type: "text",
      text: `${text?.trim() ? `题目文字：\n${text.trim()}` : "用户上传了一张题目图片。"}\n\n${buildJsonInstruction()}`
    }
  ];

  if (image) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${image.mimetype};base64,${image.buffer.toString("base64")}`
      }
    });
  }

  return content;
}

export function normalizeBaseUrl(baseUrl) {
  const fallback = process.env.OPENAI_BASE_URL || "";
  const candidate = baseUrl || fallback;
  if (!candidate) return "";

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    const error = new Error("Base URL 格式无效。");
    error.statusCode = 400;
    throw error;
  }

  if (parsed.protocol !== "https:") {
    const error = new Error("Base URL 必须使用 https。");
    error.statusCode = 400;
    throw error;
  }

  const host = parsed.hostname;
  const isAllowed = allowedBaseUrlHosts.includes(host) || host.endsWith(".maas.aliyuncs.com");
  if (!isAllowed) {
    const error = new Error("当前只允许已登记的 OpenAI 兼容官方地址。请在说明文档中选择供应商预设，或联系开发者补充白名单。");
    error.statusCode = 400;
    throw error;
  }

  return parsed.href.replace(/\/$/, "");
}

function extractJsonObject(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

async function solveWithResponsesApi({ client, model, text, image }) {
  const systemPrompt = buildSystemPrompt({ text });
  const response = await client.responses.create({
    model,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildUserContent({ text, image }) }
    ],
    text: {
      format: {
        type: "json_schema",
        ...solveJsonSchema
      }
    }
  });

  return response.output_text;
}

async function generateCommandsWithResponsesApi({ client, model, problemSummary, mathType, problemContract, constructionSteps, viewport, repairContext }) {
  const systemPrompt = buildSystemPrompt({
    text: problemSummary,
    mathType,
    constructionSteps
  });
  const response = await client.responses.create({
    model,
    input: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildCommandUserText({ problemSummary, mathType, problemContract, constructionSteps, viewport, repairContext })
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        ...commandJsonSchema
      }
    }
  });

  return response.output_text;
}

async function solveWithChatCompletions({ client, model, text, image }) {
  const systemPrompt = buildSystemPrompt({ text });
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: `${systemPrompt}\n${buildJsonInstruction()}` },
      { role: "user", content: buildChatContent({ text, image }) }
    ],
    response_format: { type: "json_object" }
  });

  return response.choices?.[0]?.message?.content || "";
}

async function generateCommandsWithChatCompletions({ client, model, problemSummary, mathType, problemContract, constructionSteps, viewport, repairContext }) {
  const systemPrompt = buildSystemPrompt({
    text: problemSummary,
    mathType,
    constructionSteps
  });
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: `${systemPrompt}\n${buildJsonInstruction()}` },
      {
        role: "user",
        content: buildCommandUserText({ problemSummary, mathType, problemContract, constructionSteps, viewport, repairContext })
      }
    ],
    response_format: { type: "json_object" }
  });

  return response.choices?.[0]?.message?.content || "";
}

function createOpenAIClient({ apiKey, baseUrl, model }) {
  const resolvedApiKey = apiKey || process.env.OPENAI_API_KEY;
  if (!resolvedApiKey) {
    const error = new Error("尚未配置 OPENAI_API_KEY。请在 .env 中设置，或启用 USE_MOCK_AI=1 进行本地界面测试。");
    error.statusCode = 500;
    throw error;
  }

  const resolvedBaseUrl = normalizeBaseUrl(baseUrl);
  const resolvedHost = resolvedBaseUrl ? new URL(resolvedBaseUrl).hostname : "";
  const providerDefaultModel = defaultModelByHost.get(resolvedHost) || "qwen-plus";
  const resolvedModel = model || process.env.OPENAI_MODEL || (resolvedBaseUrl ? providerDefaultModel : "gpt-5.5");
  const client = new OpenAI({
    apiKey: resolvedApiKey,
    ...(resolvedBaseUrl ? { baseURL: resolvedBaseUrl } : {})
  });

  return { client, resolvedBaseUrl, resolvedModel };
}

function parseModelJson(output) {
  if (!output) {
    const error = new Error("模型返回了空响应。");
    error.statusCode = 502;
    throw error;
  }

  try {
    return JSON.parse(extractJsonObject(output));
  } catch {
    const error = new Error("模型返回了无效 JSON。");
    error.statusCode = 502;
    throw error;
  }
}

export async function solveWithOpenAI({ text, image, apiKey, baseUrl, model }) {
  const { client, resolvedBaseUrl, resolvedModel } = createOpenAIClient({ apiKey, baseUrl, model });

  const output = resolvedBaseUrl
    ? await solveWithChatCompletions({ client, model: resolvedModel, text, image })
    : await solveWithResponsesApi({ client, model: resolvedModel, text, image });
  return parseModelJson(output);
}

export async function generateCommandsWithOpenAI({ problemSummary, mathType, problemContract, constructionSteps, viewport, repairContext, apiKey, baseUrl, model }) {
  const { client, resolvedBaseUrl, resolvedModel } = createOpenAIClient({ apiKey, baseUrl, model });

  const output = resolvedBaseUrl
    ? await generateCommandsWithChatCompletions({ client, model: resolvedModel, problemSummary, mathType, problemContract, constructionSteps, viewport, repairContext })
    : await generateCommandsWithResponsesApi({ client, model: resolvedModel, problemSummary, mathType, problemContract, constructionSteps, viewport, repairContext });
  return parseModelJson(output);
}

export async function reviewConstructionSemanticsWithOpenAI({
  problemContract,
  mathType,
  objectManifest,
  objectStates,
  commandSummary,
  apiKey,
  baseUrl,
  model
}) {
  const { client, resolvedBaseUrl, resolvedModel } = createOpenAIClient({ apiKey, baseUrl, model });
  const instruction = [
    "你是高中数学作图一致性审核器，只审核，不重写题目或命令。",
    "判断对象清单和关键数值是否满足不可变题目合同。",
    "只返回 JSON：{\"ok\":boolean,\"issues\":[{\"code\":string,\"message\":string,\"objectLabels\":string[]}]}。",
    "不要因为缺少完整证明过程而判错；只检查图形语义、关键对象和条件。",
    `题型：${mathType}`,
    `不可变题目合同：${JSON.stringify(problemContract || {})}`,
    `对象清单：${JSON.stringify(objectManifest || [])}`,
    `关键对象状态：${JSON.stringify(objectStates || {})}`,
    `命令摘要：${JSON.stringify(commandSummary || [])}`
  ].join("\n");

  let output;
  if (resolvedBaseUrl) {
    const response = await client.chat.completions.create({
      model: resolvedModel,
      messages: [{ role: "user", content: instruction }],
      response_format: { type: "json_object" }
    });
    output = response.choices?.[0]?.message?.content || "";
  } else {
    const response = await client.responses.create({
      model: resolvedModel,
      input: instruction,
      text: { format: { type: "json_object" } }
    });
    output = response.output_text;
  }
  const parsed = parseModelJson(output);
  return {
    ok: parsed.ok === true,
    issues: Array.isArray(parsed.issues)
      ? parsed.issues.slice(0, 12).map((issue) => ({
        code: String(issue?.code || "semantic_mismatch"),
        message: String(issue?.message || "图形与题目合同不一致"),
        objectLabels: Array.isArray(issue?.objectLabels) ? issue.objectLabels.map(String) : []
      }))
      : []
  };
}

export async function recognizeProblemWithOpenAI({ image, apiKey, baseUrl, model }) {
  if (!image) {
    const error = new Error("请上传需要识别的题目图片。");
    error.statusCode = 400;
    throw error;
  }
  const { client, resolvedBaseUrl, resolvedModel } = createOpenAIClient({ apiKey, baseUrl, model });
  const instruction = [
    "识别图片中的高中数学题，只返回 JSON。",
    "字段：recognizedText 字符串；uncertainties 数组。",
    "uncertainties 每项包含 text、reason、suggestion。",
    "保留公式、上下标、角度符号和点名，不要解题。"
  ].join("\n");

  let output;
  if (resolvedBaseUrl) {
    const response = await client.chat.completions.create({
      model: resolvedModel,
      messages: [
        { role: "system", content: instruction },
        {
          role: "user",
          content: [
            { type: "text", text: "请识别这张题目图片。" },
            { type: "image_url", image_url: { url: `data:${image.mimetype};base64,${image.buffer.toString("base64")}` } }
          ]
        }
      ],
      response_format: { type: "json_object" }
    });
    output = response.choices?.[0]?.message?.content || "";
  } else {
    const response = await client.responses.create({
      model: resolvedModel,
      input: [
        { role: "system", content: instruction },
        {
          role: "user",
          content: [{
            type: "input_image",
            image_url: `data:${image.mimetype};base64,${image.buffer.toString("base64")}`
          }]
        }
      ],
      text: { format: { type: "json_object" } }
    });
    output = response.output_text;
  }

  const parsed = parseModelJson(output);
  return {
    recognizedText: String(parsed.recognizedText || "").trim(),
    uncertainties: Array.isArray(parsed.uncertainties)
      ? parsed.uncertainties.slice(0, 12).map((item) => ({
        text: String(item?.text || ""),
        reason: String(item?.reason || ""),
        suggestion: String(item?.suggestion || "")
      }))
      : []
  };
}

export async function testProviderConnection({ apiKey, baseUrl, model }) {
  const { client, resolvedBaseUrl, resolvedModel } = createOpenAIClient({ apiKey, baseUrl, model });
  const provider = findProviderByBaseUrl(resolvedBaseUrl);
  try {
    if (resolvedBaseUrl) {
      const response = await client.chat.completions.create({
        model: resolvedModel,
        messages: [{ role: "user", content: "只回复 OK" }],
        max_tokens: 8
      });
      return {
        ok: Boolean(response.choices?.length),
        model: resolvedModel,
        supportsStructuredOutput: true,
        supportsVision: provider?.supportsVisionByDefault ?? null
      };
    }
    const response = await client.responses.create({
      model: resolvedModel,
      input: "只回复 OK",
      max_output_tokens: 8
    });
    return {
      ok: Boolean(response.output_text),
      model: resolvedModel,
      supportsStructuredOutput: true,
      supportsVision: provider?.supportsVisionByDefault ?? true
    };
  } catch (error) {
    const message = String(error?.message || "");
    const status = Number(error?.status || error?.statusCode || 502);
    let code = "connection_failed";
    if (status === 401 || /api.?key|unauthorized/i.test(message)) code = "invalid_api_key";
    else if (/model|deployment|endpoint/i.test(message)) code = "model_unavailable";
    else if (/timeout|timed out/i.test(message)) code = "timeout";
    const safeError = new Error(code === "invalid_api_key"
      ? "API Key 无效或没有访问权限。"
      : code === "model_unavailable"
        ? "模型不存在、未开通或接入点名称不正确。"
        : code === "timeout"
          ? "连接模型服务超时。"
          : "无法连接模型服务，请检查平台、地址和模型。");
    safeError.statusCode = status >= 400 && status < 600 ? status : 502;
    safeError.code = code;
    throw safeError;
  }
}
