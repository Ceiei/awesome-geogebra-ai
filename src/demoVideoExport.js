export function createDemoVideoFilename(date = new Date()) {
  return `geogebra-ai-demo-${date.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.webm`;
}

export function getSupportedDemoVideoMimeType(MediaRecorderRef = globalThis.MediaRecorder) {
  if (!MediaRecorderRef || typeof MediaRecorderRef.isTypeSupported !== "function") return "video/webm";
  return MediaRecorderRef.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
}

export function createDemoVideoBlob(chunks, mimeType = "video/webm") {
  const usableChunks = Array.isArray(chunks) ? chunks.filter((chunk) => Number(chunk?.size) > 0) : [];
  if (!usableChunks.length) {
    throw new Error("未录制到有效视频，请重新选择当前浏览器标签页录制。");
  }

  return new Blob(usableChunks, { type: mimeType || "video/webm" });
}

export function normalizePngDataUrl(value) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error("GeoGebra 没有返回可导出画面");
  if (/^data:image\/png;base64,/i.test(text)) return text;
  return `data:image/png;base64,${text.replace(/\s/g, "")}`;
}

export async function getGgbPngDataUrl(api, {
  scale = 1,
  transparent = false,
  dpi = 96,
  timeoutMs = 1800
} = {}) {
  if (!api || typeof api.getPNGBase64 !== "function") {
    throw new Error("当前 GeoGebra 版本不支持直接导出演示帧");
  }

  const directResult = api.getPNGBase64(scale, transparent, dpi);
  if (typeof directResult === "string") return normalizePngDataUrl(directResult);

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("GeoGebra 导出演示帧超时"));
    }, timeoutMs);

    const finish = (value) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      try {
        resolve(normalizePngDataUrl(value));
      } catch (error) {
        reject(error);
      }
    };

    try {
      api.getPNGBase64(finish, scale, transparent, dpi);
    } catch {
      try {
        api.getPNGBase64(scale, transparent, dpi, finish);
      } catch (error) {
        if (!settled) {
          settled = true;
          globalThis.clearTimeout(timer);
          reject(error);
        }
      }
    }
  });
}

export function getDemoRecordingErrorMessage(error) {
  if (error?.name === "NotAllowedError") return "已取消录制，未生成视频";
  if (error?.name === "NotFoundError") return "没有可录制的浏览器窗口，请确认浏览器允许屏幕录制";
  if (error?.name === "NotReadableError") return "浏览器暂时无法读取录屏画面，请重新选择当前标签页";
  return error?.message || "录制演示视频失败";
}

export function getDemoRecordingChecklist() {
  return [
    "请选择当前网页或浏览器标签页，不要选择空白窗口。",
    "录制开始后会自动播放下方滑动条动画。",
    "播放结束后会自动下载 .webm 演示视频。"
  ];
}
