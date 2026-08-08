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
  let recognizedText = String(text || "").trim();

  if (image) {
    onStage("recognizing");
    try {
      const recognition = await request("/api/recognize", {
        method: "POST",
        body: createForm(recognizedText, image),
        headers
      }, "题图识别失败，请检查模型是否支持图片后重试。");
      recognizedText = String(recognition.recognizedText || recognizedText).trim();
    } catch (error) {
      if (!recognizedText) throw error;
    }
    if (!recognizedText) {
      throw new Error("没有从题图中识别到有效题目，请换用更清晰的图片。");
    }
  }

  onStage("solving");
  const payload = await request("/api/solve", {
    method: "POST",
    body: createForm(recognizedText, null),
    headers
  }, "题目解析失败，请重新尝试。");

  return { payload, recognizedText };
}
