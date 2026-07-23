export const providerPresets = [
  {
    id: "openai",
    name: "OpenAI 官方",
    baseUrl: "",
    model: "",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    allowedHosts: ["api.openai.com"],
    supportsVisionByDefault: true,
    note: "Base URL 和模型名可留空，使用服务端默认值。"
  },
  {
    id: "aliyun",
    name: "阿里云百炼",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3-vl-plus",
    apiKeyUrl: "https://bailian.console.aliyun.com/",
    allowedHosts: ["dashscope.aliyuncs.com", "dashscope-us.aliyuncs.com"],
    supportsVisionByDefault: true,
    note: "默认使用支持图片理解的视觉模型。"
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    allowedHosts: ["api.deepseek.com"],
    supportsVisionByDefault: false,
    note: "默认模型适合文字题；图片题请改用视觉供应商。"
  },
  {
    id: "volcengine",
    name: "火山方舟",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-1-6-250615",
    apiKeyUrl: "https://console.volcengine.com/ark/",
    allowedHosts: ["ark.cn-beijing.volces.com", "ark.cn-shanghai.volces.com"],
    supportsVisionByDefault: true,
    note: "模型名应与方舟控制台的推理接入点一致。"
  },
  {
    id: "tencent",
    name: "腾讯混元",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    model: "hunyuan-turbos-latest",
    apiKeyUrl: "https://console.cloud.tencent.com/hunyuan",
    allowedHosts: ["api.hunyuan.cloud.tencent.com"],
    supportsVisionByDefault: false,
    note: "使用腾讯混元 OpenAI 兼容接口。"
  },
  {
    id: "baidu",
    name: "百度千帆",
    baseUrl: "https://qianfan.baidubce.com/v2",
    model: "ernie-4.0-turbo-8k",
    apiKeyUrl: "https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application",
    allowedHosts: ["qianfan.baidubce.com"],
    supportsVisionByDefault: false,
    note: "使用千帆 OpenAI 兼容接口。"
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-plus",
    apiKeyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    allowedHosts: ["open.bigmodel.cn"],
    supportsVisionByDefault: false,
    note: "模型以账号控制台权限为准。"
  },
  {
    id: "moonshot",
    name: "月之暗面",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
    apiKeyUrl: "https://platform.moonshot.cn/console/api-keys",
    allowedHosts: ["api.moonshot.cn"],
    supportsVisionByDefault: false,
    note: "图片能力取决于所选模型。"
  },
  {
    id: "minimax",
    name: "MiniMax",
    baseUrl: "https://api.minimax.chat/v1",
    model: "MiniMax-Text-01",
    apiKeyUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    allowedHosts: ["api.minimax.chat"],
    supportsVisionByDefault: false,
    note: "使用 MiniMax OpenAI 兼容接口。"
  },
  {
    id: "siliconflow",
    name: "硅基流动",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "Qwen/Qwen2.5-7B-Instruct",
    apiKeyUrl: "https://cloud.siliconflow.cn/account/ak",
    allowedHosts: ["api.siliconflow.cn", "api.siliconflow.com"],
    supportsVisionByDefault: false,
    note: "模型名需与平台模型列表完全一致。"
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
    apiKeyUrl: "https://aistudio.google.com/apikey",
    allowedHosts: ["generativelanguage.googleapis.com"],
    supportsVisionByDefault: true,
    note: "使用 Gemini 的 OpenAI 兼容入口。"
  }
];

export function findProviderByBaseUrl(baseUrl) {
  if (!baseUrl) return providerPresets.find((provider) => provider.id === "openai");
  try {
    const hostname = new URL(baseUrl).hostname;
    return providerPresets.find((provider) => provider.allowedHosts.includes(hostname)) || null;
  } catch {
    return null;
  }
}

export function getAllowedProviderHosts() {
  return [...new Set(providerPresets.flatMap((provider) => provider.allowedHosts))];
}
