import { requestJson } from "./apiClient.js";

function createForm(text, image, forceReparse = false) {
  const form = new FormData();
  form.append("text", String(text || ""));
  if (image) form.append("image", image);
  if (forceReparse) form.append("forceReparse", "1");
  return form;
}

export async function requestProblemSolution({
  text = "",
  image = null,
  forceReparse = false,
  headers = {},
  request = requestJson,
  onStage = () => {}
}) {
  const sourceText = String(text || "").trim();
  onStage(image ? "solving_image" : "solving");
  const payload = await request("/api/solve", {
    method: "POST",
    body: createForm(sourceText, image, forceReparse),
    headers
  }, image ? "题图理解与绘图方案生成失败，请重新尝试。" : "题目解析失败，请重新尝试。");
  const recognizedText = String(payload.recognizedProblemText || sourceText).trim();

  return { payload, recognizedText };
}

export async function requestProblemPlan({
  text = "",
  image = null,
  headers = {},
  request = requestJson,
  onStage = () => {}
}) {
  const sourceText = String(text || "").trim();
  onStage(image ? "planning_image" : "planning");
  const payload = await request("/api/plan", {
    method: "POST",
    body: createForm(sourceText, image),
    headers
  }, image ? "题图分析失败，请重新尝试。" : "题目分析失败，请重新尝试。");
  return {
    payload,
    recognizedText: String(payload.recognizedProblemText || sourceText).trim()
  };
}
