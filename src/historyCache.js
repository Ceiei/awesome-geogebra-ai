export function normalizeProblemText(text) {
  return String(text ?? "").trim().replace(/\s+/g, " ");
}

export function createHistoryCacheKey({ text, imageFingerprint = "" }) {
  const normalizedText = normalizeProblemText(text);
  if (!normalizedText && !imageFingerprint) return "";

  return JSON.stringify({ version: 1, text: normalizedText, imageFingerprint });
}

export function findHistoryCacheHit(history, cacheKey, { text, hasImage }) {
  if (!cacheKey) return null;

  const keyedMatch = history.find((item) => item.cacheKey === cacheKey);
  if (keyedMatch) return keyedMatch;

  if (hasImage) return null;

  const normalizedText = normalizeProblemText(text);
  return history.find((item) => (
    !item.cacheKey
      && !item.imageName
      && normalizeProblemText(item.promptText) === normalizedText
  )) || null;
}
