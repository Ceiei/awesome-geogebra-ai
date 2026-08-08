function statusMessage(status, fallbackMessage) {
  if (status === 413) return "题目图片过大，请压缩到 8 MB 以内后重试。";
  if (status === 408 || status === 504) return "解析服务响应超时，请稍后重试。";
  if (status === 502 || status === 503) return "解析服务暂时不可用，请稍后重试。";
  if (status === 404) return "解析接口不存在，请检查网站部署配置。";
  return fallbackMessage;
}

function readableTextError(text, status, fallbackMessage) {
  const compact = String(text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!compact) return statusMessage(status, fallbackMessage);
  if (/an error occurred|internal server error|function invocation failed|deployment/i.test(compact)) {
    return statusMessage(status, "解析服务发生异常，请稍后重试。");
  }
  if (/timeout|timed out|gateway time-out/i.test(compact)) {
    return "解析服务响应超时，请稍后重试。";
  }
  return compact.length <= 240 ? compact : statusMessage(status, fallbackMessage);
}

export async function parseApiResponse(response, fallbackMessage = "请求失败，请稍后重试。") {
  const raw = await response.text();
  let payload = null;

  if (raw.trim()) {
    try {
      payload = JSON.parse(raw);
    } catch {
      if (!response.ok) {
        throw new Error(readableTextError(raw, response.status, fallbackMessage));
      }
      throw new Error("解析服务返回了无法识别的数据，请重新尝试。");
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error || statusMessage(response.status, fallbackMessage));
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("解析服务没有返回有效结果，请重新尝试。");
  }
  return payload;
}

export async function requestJson(input, init, fallbackMessage) {
  let response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("解析请求已取消。请重新尝试。");
    }
    throw new Error("无法连接解析服务，请检查网络后重试。");
  }
  return parseApiResponse(response, fallbackMessage);
}
