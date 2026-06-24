import "dotenv/config";
import OpenAI from "openai";
import { allowedCommandsForPrompt } from "./ggbValidation.js";
import { solveJsonSchema } from "./solveSchema.js";

export const providerPresets = [
  {
    id: "aliyun",
    name: "阿里云百炼",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen3-vl-plus",
    allowedHosts: ["dashscope.aliyuncs.com", "dashscope-us.aliyuncs.com"]
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    allowedHosts: ["api.deepseek.com"]
  },
  {
    id: "volcengine",
    name: "火山方舟",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-1-6-250615",
    allowedHosts: ["ark.cn-beijing.volces.com", "ark.cn-shanghai.volces.com"]
  },
  {
    id: "tencent",
    name: "腾讯混元",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    defaultModel: "hunyuan-turbos-latest",
    allowedHosts: ["api.hunyuan.cloud.tencent.com"]
  },
  {
    id: "baidu",
    name: "百度千帆",
    baseUrl: "https://qianfan.baidubce.com/v2",
    defaultModel: "ernie-4.0-turbo-8k",
    allowedHosts: ["qianfan.baidubce.com"]
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-plus",
    allowedHosts: ["open.bigmodel.cn"]
  },
  {
    id: "moonshot",
    name: "月之暗面",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    allowedHosts: ["api.moonshot.cn"]
  },
  {
    id: "minimax",
    name: "MiniMax",
    baseUrl: "https://api.minimax.chat/v1",
    defaultModel: "MiniMax-Text-01",
    allowedHosts: ["api.minimax.chat"]
  },
  {
    id: "siliconflow",
    name: "硅基流动",
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "Qwen/Qwen2.5-7B-Instruct",
    allowedHosts: ["api.siliconflow.cn", "api.siliconflow.com"]
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    allowedHosts: ["generativelanguage.googleapis.com"]
  }
];

const allowedBaseUrlHosts = [
  "api.openai.com",
  ...providerPresets.flatMap((provider) => provider.allowedHosts)
];

const defaultModelByHost = new Map(
  providerPresets.flatMap((provider) => provider.allowedHosts.map((host) => [host, provider.defaultModel]))
);

function buildSystemPrompt() {
  return [
    "You transform math problems into GeoGebra constructions for an interactive applet.",
    "Return only the requested strict JSON shape.",
    "Use Simplified Chinese for user-facing fields: problemSummary, constructionSteps, warnings, and followupQuestion.",
    "Target 2D geometry, functions, analytic geometry, and solid geometry in GeoGebra 3D. For solid geometry, use true 3D point coordinates such as A=(0,0,0) and safe commands such as Segment, Polygon, Prism, Pyramid, Cube, Sphere, Cylinder, Cone, Plane, and Tetrahedron.",
    "Use English GeoGebra command names.",
    "Use parentheses (...) for GeoGebra command calls, never square brackets. Define every referenced object before it is used; for example, create dist=Distance(D, plane) before Text(\"距离 = \" + dist, (3,3,2)).",
    "For the angle between a line and a plane in 3D, use Angle(Line(D,E), plane) after defining the plane. Do not use a separately constructed normal vector or Angle(Vector(...), Vector(...)) for this purpose.",
    "For a prism or polyhedron, explicitly draw every edge with named Segment commands before adding auxiliary planes. Use an infinite Plane only for calculations, then hide it. For a visible auxiliary plane, draw the corresponding finite Polygon face with filling at most 0.06 so it cannot obscure the solid. Do not add SetLabelMode, Text, or decorative commands unless they are essential to the requested visualization.",
    "Do not generate JavaScript, HTML, scripts, buttons, file operations, or destructive commands.",
    "Prefer clear free points and construction objects that remain draggable in GeoGebra.",
    `Allowed GeoGebra command names: ${allowedCommandsForPrompt.join(", ")}.`,
    "For simple free points use labels like A=(0,0).",
    "For functions use syntax like f(x)=x^2-3*x+2.",
    "When the prompt is ambiguous, include a concise followupQuestion and still provide the safest approximate visualization if possible."
  ].join("\n");
}

function buildJsonInstruction() {
  return [
    "请只返回一个 JSON 对象，不要使用 Markdown 代码块。",
    "JSON 字段必须包含：problemSummary, mathType, constructionSteps, ggbCommands, viewport, warnings, followupQuestion。",
    "mathType 只能是 geometry、function、analytic_geometry 或 solid_geometry。",
    "viewport 必须包含 xmin、xmax、ymin、ymax 四个数字。",
    "ggbCommands 必须是字符串数组，每个字符串是一条 GeoGebra 命令。"
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
  const response = await client.responses.create({
    model,
    input: [
      { role: "system", content: buildSystemPrompt() },
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

async function solveWithChatCompletions({ client, model, text, image }) {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: `${buildSystemPrompt()}\n${buildJsonInstruction()}` },
      { role: "user", content: buildChatContent({ text, image }) }
    ],
    response_format: { type: "json_object" }
  });

  return response.choices?.[0]?.message?.content || "";
}

export async function solveWithOpenAI({ text, image, apiKey, baseUrl, model }) {
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

  const output = resolvedBaseUrl
    ? await solveWithChatCompletions({ client, model: resolvedModel, text, image })
    : await solveWithResponsesApi({ client, model: resolvedModel, text, image });
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
