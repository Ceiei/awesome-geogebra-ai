import { requestJson } from "./apiClient.js";

function createForm(text, image) {
  const form = new FormData();
  form.append("text", String(text || ""));
  if (image) form.append("image", image);
  return form;
}

export async function requestProblemSolution({
  text = "",
  image = null,
  headers = {},
  request = requestJson,
  onStage = () => {}
}) {
  const sourceText = String(text || "").trim();
  onStage(image ? "solving_image" : "solving");
  const payload = await request("/api/solve", {
    method: "POST",
    body: createForm(sourceText, image),
    headers
  }, image ? "题图理解与绘图方案生成失败，请重新尝试。" : "题目解析失败，请重新尝试。");
  const recognizedText = String(payload.recognizedProblemText || sourceText).trim();

  return { payload, recognizedText };
}
