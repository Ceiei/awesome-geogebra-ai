const GGB_SCRIPT_URL = "https://www.geogebra.org/apps/deployggb.js";
let loadingPromise = null;

export function loadGeoGebra({
  documentRef = document,
  timeoutMs = 12000,
  forceRetry = false
} = {}) {
  if (globalThis.GGBApplet) return Promise.resolve(globalThis.GGBApplet);
  if (loadingPromise && !forceRetry) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const existing = documentRef.querySelector('script[data-geogebra-loader="true"]');
    if (forceRetry) existing?.remove();
    const script = forceRetry || !existing ? documentRef.createElement("script") : existing;
    const timer = globalThis.setTimeout(() => {
      loadingPromise = null;
      reject(new Error("GeoGebra 加载超时，请检查网络后重试。"));
    }, timeoutMs);

    const finish = () => {
      globalThis.clearTimeout(timer);
      if (globalThis.GGBApplet) {
        resolve(globalThis.GGBApplet);
      } else {
        loadingPromise = null;
        reject(new Error("GeoGebra 资源未正确加载。"));
      }
    };
    const fail = () => {
      globalThis.clearTimeout(timer);
      loadingPromise = null;
      reject(new Error("GeoGebra 加载失败，请检查网络后重试。"));
    };

    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });
    if (!existing || forceRetry) {
      script.src = GGB_SCRIPT_URL;
      script.async = true;
      script.dataset.geogebraLoader = "true";
      documentRef.head.append(script);
    }
  });
  return loadingPromise;
}
