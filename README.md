# GeoGebra + AI 智能绘图

一个将 AI 题意理解与 GeoGebra 交互式绘图结合的在线工具。输入数学题文字或上传题图后，AI 会生成绘图方案与 GeoGebra 图形；图形可在画布中继续拖动、缩放和编辑。

## 网站入口

直接打开正式网站：[https://awesome-geogebra-ai.vercel.app/](https://awesome-geogebra-ai.vercel.app/)

支持平面几何、函数图像、解析几何和基础立体几何。

## 如何使用

1. 打开网站，点击右上角的“请设置 API KEY”。
2. 选择常用模型供应商，填入自己的 API Key 并保存。
3. 输入题目文字，或直接上传、粘贴 PNG/JPEG/WebP 题图。
4. 点击“解析题目”，查看 AI 给出的题意理解、构造步骤和绘图命令。
5. 点击“绘制到 GeoGebra”，在画布中拖动点和图形；立体题可切换到 `3D` 视图。

相同题目再次提交时，网站会自动读取本机历史解析结果，不会重复调用模型。图片题会按图片内容匹配，避免不同题图误用历史结果。

## 获取 API Key

网站默认由使用者自带 API Key。选择供应商后，通常无需手动填写 Base URL 或模型名；只有在账号权限或模型选择特殊时，才在设置弹窗中调整。

| 平台 | API Key 申请入口 | 说明 |
| --- | --- | --- |
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | 图片题请使用支持视觉的模型。 |
| 阿里云百炼 | [bailian.console.aliyun.com](https://bailian.console.aliyun.com/) | 默认使用支持图片理解的 `qwen3-vl-plus`。 |
| DeepSeek | [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) | 适合文字题，不支持题图识别。 |
| 火山方舟 | [console.volcengine.com/ark](https://console.volcengine.com/ark/) | 可在设置中选择控制台可用模型。 |
| 腾讯混元 | [console.cloud.tencent.com/hunyuan](https://console.cloud.tencent.com/hunyuan) | 使用兼容接口。 |
| 百度千帆 | [console.bce.baidu.com/qianfan](https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application) | 使用兼容接口。 |
| 智谱 GLM | [open.bigmodel.cn/usercenter/apikeys](https://open.bigmodel.cn/usercenter/apikeys) | 模型以控制台权限为准。 |
| 月之暗面 | [platform.moonshot.cn/console/api-keys](https://platform.moonshot.cn/console/api-keys) | 视觉能力取决于所选模型。 |
| MiniMax | [platform.minimaxi.com](https://platform.minimaxi.com/user-center/basic-information/interface-key) | 使用兼容接口。 |
| 硅基流动 | [cloud.siliconflow.cn](https://cloud.siliconflow.cn/account/ak) | 模型名称以平台列表为准。 |
| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | 支持图片理解。 |

## 使用说明

- API Key 只保存在当前浏览器本机，不会写入 GitHub 仓库。
- 图片题需要选择支持视觉理解的模型。
- 请勿在公开场所分享自己的 API Key。
- AI 生成的图形用于辅助理解和探索；重要结论请结合题目条件自行核对。
