import { DEFAULT_PROJECT_ID, STORAGE_KEY_V2, createProject, normalizeProject } from './core.mjs';

const DB_NAME = 'devcpp-web-classroom';
const DB_VERSION = 2;
const PROJECTS = 'projects';
const SNAPSHOTS = 'snapshots';
const MAX_SNAPSHOTS = 8;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SNAPSHOTS)) db.createObjectStore(SNAPSHOTS, { keyPath: 'snapshotId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    try { result = action(store); } catch (error) { db.close(); reject(error); return; }
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbGet(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS, 'readonly');
    const request = tx.objectStore(PROJECTS).get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbPut(project) {
  return withStore(PROJECTS, 'readwrite', store => store.put(project));
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

export async function createSnapshot(project, reason = 'manual') {
  const normalized = normalizeProject(project);
  const snapshot = {
    snapshotId: `${Date.now()}-${crypto.randomUUID?.() ?? Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
    reason,
    project: normalized,
  };

  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS, 'readwrite');
    tx.objectStore(SNAPSHOTS).put(snapshot);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  const snapshots = await listSnapshots();
  for (const stale of snapshots.slice(MAX_SNAPSHOTS)) {
    await deleteSnapshot(stale.snapshotId);
  }
  db.close();
  return snapshot;
}

export async function listSnapshots() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS, 'readonly');
    const request = tx.objectStore(SNAPSHOTS).getAll();
    request.onsuccess = () => {
      const rows = (request.result ?? []).sort((a, b) => b.createdAt - a.createdAt);
      resolve(rows);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function deleteSnapshot(snapshotId) {
  return withStore(SNAPSHOTS, 'readwrite', store => store.delete(snapshotId));
}

export async function restoreSnapshot(snapshotId) {
  const db = await openDb();
  const snapshot = await new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS, 'readonly');
    const request = tx.objectStore(SNAPSHOTS).get(snapshotId);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
  if (!snapshot) throw new Error('Snapshot não encontrado');
  return saveProject(snapshot.project);
}
