const DATABASE_NAME = "geogebra-ai-projects";
const DATABASE_VERSION = 1;
const STORE_NAME = "projects";

function openDatabase(indexedDBRef = globalThis.indexedDB) {
  if (!indexedDBRef) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDBRef.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
        store.createIndex("chapter", "chapter");
        store.createIndex("favorite", "favorite");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, callback, indexedDBRef) {
  const database = await openDatabase(indexedDBRef);
  if (!database) return callback(null);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result;
    try {
      result = callback(store);
    } catch (error) {
      database.close();
      reject(error);
      return;
    }
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export async function listProjects(indexedDBRef) {
  const database = await openDatabase(indexedDBRef);
  if (!database) return [];
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      database.close();
      resolve((request.result || []).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
    };
    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  });
}

export async function saveProject(project, indexedDBRef) {
  const now = new Date().toISOString();
  const normalized = {
    id: String(project?.id || crypto.randomUUID()),
    title: String(project?.title || "未命名题目"),
    promptText: String(project?.promptText || ""),
    imageName: project?.imageName || null,
    imageFingerprint: String(project?.imageFingerprint || ""),
    cacheKey: String(project?.cacheKey || ""),
    chapter: String(project?.chapter || ""),
    tags: Array.isArray(project?.tags) ? project.tags.map(String) : [],
    favorite: Boolean(project?.favorite),
    createdAt: String(project?.createdAt || project?.timestamp || now),
    updatedAt: now,
    versions: Array.isArray(project?.versions) && project.versions.length
      ? project.versions
      : [{ id: crypto.randomUUID(), createdAt: now, result: project?.result || null }],
    result: project?.result || null,
    viewMode: project?.viewMode || null
  };
  await withStore("readwrite", (store) => store?.put(normalized), indexedDBRef);
  return normalized;
}

export async function deleteProject(id, indexedDBRef) {
  await withStore("readwrite", (store) => store?.delete(id), indexedDBRef);
}

export async function importProjects(items, indexedDBRef) {
  const projects = Array.isArray(items) ? items : [];
  for (const project of projects) await saveProject(project, indexedDBRef);
  return listProjects(indexedDBRef);
}

export function createProjectBackup(projects) {
  return JSON.stringify({
    format: "geogebra-ai-projects",
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: projects || []
  }, null, 2);
}

export function parseProjectBackup(text) {
  const parsed = JSON.parse(String(text || ""));
  if (parsed?.format !== "geogebra-ai-projects" || !Array.isArray(parsed.projects)) {
    throw new Error("不是有效的 GeoGebra AI 项目备份。");
  }
  return parsed.projects;
}

export async function migrateLegacyHistory(items, indexedDBRef) {
  const existing = await listProjects(indexedDBRef);
  const existingIds = new Set(existing.map((item) => item.id));
  for (const item of items || []) {
    if (!item?.id || existingIds.has(item.id)) continue;
    await saveProject(item, indexedDBRef);
  }
  return listProjects(indexedDBRef);
}
