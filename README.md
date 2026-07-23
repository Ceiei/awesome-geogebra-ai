# GeoGebra + AI 智能绘图

一个将 AI 题意理解与 GeoGebra 交互式绘图结合的在线工具。输入数学题文字或上传题图后，AI 会生成绘图方案与 GeoGebra 图形；图形可在画布中继续拖动、缩放和编辑。

## 最新更新

### 2026-07-23

- 升级为 `SolveResultV2`：题目条件会形成不可变合同，重新生成命令和自动修复不能改动原题方程、题型、点名与关键关系。
- 新增 GeoGebra 命令结构化解析、依赖检查和匿名样式目标改写，可在绘制前发现未定义对象、重复命名和引用顺序问题。
- 绘制后自动读取 GeoGebra 对象坐标与数值，检查中点、平行、垂直、等长、共线、共面及非退化条件；复杂题按需进行一次受约束语义复核。
- 自动修复最多两轮，用户界面不展示逐条失败命令；无法确认图形正确时会停止并提示重新生成。
- 新增图片题 OCR 校对，先确认公式、上下标和点名，再进入正式解析。
- 新增备课模式与授课模式、分步显隐、步骤与对象联动、教师可读对象树和动态候选确认。
- GeoGebra 默认使用纯画布，立体几何自动进入 3D；可随时打开完整编辑器，切换时保留当前构造。
- 历史记录升级为 IndexedDB 本地项目库，支持搜索、收藏、删除、版本保存以及本地备份导入导出。
- `.ggb` 和网页版 `.html` 均从当前真实画布状态导出，保留拖动、样式、显隐、动态参数和分步演示，不包含 API Key。
- API 设置新增连接测试、错误分类和统一脱敏；GeoGebra CDN 加载支持超时、重试和网络诊断。
- 建立 100 题四题型回归基准，并增加命令解析、题目合同、数学关系、项目备份、隐私诊断和导出测试。

### 2026-07-22

- 新增按题型选择提示词模板，针对立体几何、解析几何、函数图像和平面几何分别强化 GeoGebra 命令生成规则。
- 绘图异常不再向用户展示命令失败或完整性检查提示，系统会自动把问题交给 AI 重新生成更稳定的命令并重绘。
- 精简主界面，移除课件保存、文件下载和演示视频导出入口，保留题目解析、命令编辑、交互绘图和动态演示。
- 恢复下载功能，支持下载 `.ggb` 文件和网页版 `.html`；网页版导出改用英文命令回放，避免轨迹等本地化命令导致打开失败。
- 优化对象属性面板：对象名称改为“点 A”“函数 f”“三角形 ABC”等可读描述，支持画布点击同步选中、高亮对象，并用一个按钮切换标签显示状态。

### 2026-07-21

- 解析几何动态图更适合课堂演示：会自动识别关键可动参数，并在画布下方生成滑动条。
- 面积、垂线、交点、中点等题目对象会更完整地标注，并自动补充半透明区域填充和辅助线。
- 支持播放动态演示，可直接拖动滑动条观察参数变化。
- 绘图命令会自动修复常见 GeoGebra 样式写法问题，用户侧只展示最终绘图状态。

## 网站入口

直接打开正式网站：[https://awesome-geogebra-ai.vercel.app/](https://awesome-geogebra-ai.vercel.app/)

支持平面几何、函数图像、解析几何和基础立体几何。

## 如何使用

1. 打开网站，点击右上角的“请设置 API KEY”。
2. 选择常用模型供应商，填入自己的 API Key 并保存。
3. 输入题目文字，或直接上传、粘贴 PNG/JPEG/WebP 题图。
4. 图片题先校对识别文字；文字题可直接点击“解析并生成方案”。
5. 查看并按需修改构造步骤；系统会锁定原题条件，仅重新生成绘图方式。
6. 点击“绘制到 GeoGebra”。平面题默认使用 2D，立体题自动使用 3D。
7. 在画布中拖动对象、切换显隐和样式，或进入授课模式按步骤演示。
8. 使用画布右上角下载菜单导出当前 `.ggb` 文件或可独立打开的网页版 `.html`。

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

- API Key 只保存在当前浏览器本机，不会写入 GitHub 仓库；解析请求会经过本站后端转发，服务端不持久化 Key。
- API 响应禁止缓存，错误信息和可下载诊断报告会移除 Key、题目正文和图片内容。
- 图片题需要选择支持视觉理解的模型。
- 请勿在公开场所分享自己的 API Key。
- 系统会自动校验图形与原题合同；无法通过完整性检查时不会把半成品标记为完成。
