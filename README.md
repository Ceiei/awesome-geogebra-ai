# GeoGebra + AI 智能绘图

这是一个 Web MVP：用户输入文字题目或上传题目图片后，后端调用 AI 理解题意并生成经过校验的 GeoGebra 绘图方案。前端会先展示 AI 对题目的理解、构造步骤和命令列表，用户确认后再绘制到嵌入式 GeoGebra 画布中。

## 安装

```bash
npm install
cp .env.example .env
```

如需调用真实 AI，可以在网页左侧设置用户自己的 API Key；它只保存在当前浏览器本机，并在解析题目时发送给本机后端。也可以在 `.env` 中设置 `OPENAI_API_KEY` 作为默认后端 Key。

## API Key 和模型供应商

网页左侧的“模型 API 设置”支持供应商预设。选择预设后再填入该平台的 API Key 即可；如果模型名和你的账号权限不匹配，改成控制台里实际可用的模型名。

| 平台 | Base URL | 默认模型示例 | 获取 API Key |
| --- | --- | --- | --- |
| OpenAI 官方 | 留空 | 留空或 OpenAI 模型名 | https://platform.openai.com/api-keys |
| 阿里云百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus`，图片题可用 `qwen-vl-plus` | https://bailian.console.aliyun.com/ |
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` | https://platform.deepseek.com/api_keys |
| 火山方舟 | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-seed-1-6-250615` 或控制台接入点名 | https://console.volcengine.com/ark/ |
| 腾讯混元 | `https://api.hunyuan.cloud.tencent.com/v1` | `hunyuan-turbos-latest` | https://console.cloud.tencent.com/hunyuan |
| 百度千帆 | `https://qianfan.baidubce.com/v2` | `ernie-4.0-turbo-8k` | https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-plus` | https://open.bigmodel.cn/usercenter/apikeys |
| 月之暗面 | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` | https://platform.moonshot.cn/console/api-keys |
| MiniMax | `https://api.minimax.chat/v1` | `MiniMax-Text-01` | https://platform.minimaxi.com/user-center/basic-information/interface-key |
| 硅基流动 | `https://api.siliconflow.cn/v1` | `Qwen/Qwen2.5-7B-Instruct` | https://cloud.siliconflow.cn/account/ak |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.0-flash` | https://aistudio.google.com/apikey |

注意事项：

- 使用非 OpenAI 官方 Key 时，必须同时设置该平台的 `Base URL` 和 `模型名`。只填 Key 不填 Base URL，会被发到 OpenAI 官方接口并返回 401。
- 图片题需要视觉模型；部分平台或默认模型只支持文字输入。
- Anthropic Claude 等非 OpenAI 兼容协议的平台暂不在这个 MVP 支持范围内，后续可单独加适配器。
- 后端只允许上表中的官方兼容域名，避免把本机服务变成任意 URL 代理。

如果只想本地测试界面和绘图流程，可以设置：

```bash
USE_MOCK_AI=1
```

## 运行

```bash
npm run dev
```

打开 `http://localhost:5173/`。API 运行在 `http://localhost:3001/`，Vite 会把 `/api` 请求代理到后端。

## 公开部署

本项目包含 Express 后端，因此不能只使用 GitHub Pages。推荐部署到 Render 的 Web Service：

1. 将代码推送到 GitHub 仓库。
2. 在 [Render Dashboard](https://dashboard.render.com/) 选择 `New > Blueprint`，连接该仓库。
3. Render 会读取根目录的 `render.yaml`，执行 `npm ci && npm run build`，再以 `npm start` 启动服务。
4. 部署成功后，Render 会提供一个 `https://<service>.onrender.com` 公开地址；每次推送主分支会自动重新部署。

默认情况下，公开网站要求每个访问者在页面中输入自己的模型 API Key；浏览器只会在本机保存该 Key，并在请求时发送给服务端转发到所选模型平台。不要在 Render 环境变量或 Git 仓库中填写个人 API Key，除非你已经为访问控制、配额和滥用风险做好了服务端保护。

Render 的 Web Service 支持 Node/Express，并可从 GitHub 分支自动构建和部署；服务必须监听平台提供的 `PORT`，本项目已支持这一方式。[Render Web Services 文档](https://render.com/docs/web-services)

## 测试

```bash
npm test
npm run build
```

API 接口 `POST /api/solve` 接收 multipart form data：

- `text`：可选，题目文字
- `image`：可选，PNG、JPEG 或 WebP 题目图片，最大 8 MB

`text` 和 `image` 至少需要提供一个。

## 安全边界

模型必须返回严格 JSON，包括题目摘要、构造步骤、视野范围和 GeoGebra 命令字符串。后端会先用保守的 MVP 命令白名单校验，再把命令返回给浏览器。生成的 JavaScript、脚本命令、文件操作、破坏性命令和不支持的命令名都会被拦截。

## 说明

GeoGebra 默认从 `https://www.geogebra.org/apps/deployggb.js` 加载。如果后续需要离线部署，可以改为自托管 GeoGebra Math Apps bundle，并设置 applet 的 HTML5 codebase。

网页里的 API Key 设置适合本地 Demo 和个人使用。不要把 Key 写进前端代码、提交到 Git，或用于公开部署的多用户站点；公开部署应使用登录账号和服务端加密存储，或每次会话临时输入。后端当前只允许上表中的 OpenAI 兼容官方域名，避免把本机服务变成任意 URL 代理。
