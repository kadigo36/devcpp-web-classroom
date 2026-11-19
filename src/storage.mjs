import { DEFAULT_PROJECT_ID, STORAGE_KEY_V2, createProject, normalizeProject } from './core.mjs';

const DB_NAME = 'devcpp-web-classroom';
const DB_VERSION = 1;
const STORE = 'projects';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbPut(project) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(project);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function migrateLegacy() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2);
    if (!raw) return null;
    const migrated = normalizeProject(JSON.parse(raw));
    localStorage.removeItem(STORAGE_KEY_V2);
    return migrated;
  } catch {
    return null;
  }
}

export async function loadProject() {
  try {
    const stored = await idbGet(DEFAULT_PROJECT_ID);
    if (stored) return normalizeProject(stored);
  } catch {}

  const migrated = migrateLegacy();
  if (migrated) {
    try { await idbPut(migrated); } catch {}
    return migrated;
  }

  return createProject();
}

export async function saveProject(project) {
  const normalized = normalizeProject({ ...project, updatedAt: Date.now() });
  try {
    await idbPut(normalized);
    return normalized;
  } catch {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify({
      name: normalized.activeFile,
      source: normalized.files[normalized.activeFile],
    }));
    return normalized;
  }
}
