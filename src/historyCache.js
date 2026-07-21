export const HISTORY_CACHE_VERSION = 2;

export function normalizeProblemText(text) {
  return String(text ?? "").trim().replace(/\s+/g, " ");
}

export function createHistoryCacheKey({ text, imageFingerprint = "" }) {
  const normalizedText = normalizeProblemText(text);
  if (!normalizedText && !imageFingerprint) return "";

  return JSON.stringify({ version: HISTORY_CACHE_VERSION, text: normalizedText, imageFingerprint });
}

function isCurrentCacheKey(cacheKey) {
  try {
    return JSON.parse(cacheKey)?.version === HISTORY_CACHE_VERSION;
  } catch {
    return false;
  }
}

export function findHistoryCacheHit(history, cacheKey, { text, hasImage }) {
  if (!cacheKey) return null;

  const keyedMatch = history.find((item) => item.cacheKey === cacheKey && isCurrentCacheKey(item.cacheKey));
  if (keyedMatch) return keyedMatch;

  if (hasImage || isCurrentCacheKey(cacheKey)) return null;

  const normalizedText = normalizeProblemText(text);
  return history.find((item) => (
    !item.cacheKey
      && !item.imageName
      && normalizeProblemText(item.promptText) === normalizedText
  )) || null;
}

export function readHistoryItems(storageRef, { primaryKey, legacyKeys = [], limit = 8 }) {
  const seen = new Set();
  const items = [];

  for (const key of [primaryKey, ...legacyKeys].filter(Boolean)) {
    let parsed;
    try {
      parsed = JSON.parse(storageRef.getItem(key) || "[]");
    } catch {
      parsed = [];
    }

    if (!Array.isArray(parsed)) continue;

    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const dedupeKey = item.id || item.cacheKey || `${item.promptText || ""}-${item.timestamp || ""}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      items.push(item);
      if (items.length >= limit) return items;
    }
  }

  return items;
}
