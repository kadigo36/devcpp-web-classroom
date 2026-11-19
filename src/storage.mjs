import { DEFAULT_PROJECT_ID, STORAGE_KEY_V2, createProject, normalizeProject } from './core.mjs';

const DB_NAME = 'devcpp-web-classroom';
const DB_VERSION = 2;
const PROJECTS = 'projects';
const SNAPSHOTS = 'snapshots';
const ACTIVE_PROJECT_KEY = 'devcpp-classroom:active-project';
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

async function idbGet(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS, 'readonly');
    const req = tx.objectStore(PROJECTS).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbPut(project) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS, 'readwrite');
    tx.objectStore(PROJECTS).put(project);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbDelete(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS, 'readwrite');
    tx.objectStore(PROJECTS).delete(id);
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

export function getActiveProjectId() {
  return localStorage.getItem(ACTIVE_PROJECT_KEY) || DEFAULT_PROJECT_ID;
}

export function setActiveProjectId(id) {
  localStorage.setItem(ACTIVE_PROJECT_KEY, id);
}

export async function listProjects() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS, 'readonly');
    const req = tx.objectStore(PROJECTS).getAll();
    req.onsuccess = () => resolve((req.result ?? []).map(normalizeProject).sort((a,b)=>b.updatedAt-a.updatedAt));
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function loadProject(id = getActiveProjectId()) {
  try {
    const stored = await idbGet(id);
    if (stored) {
      setActiveProjectId(stored.id);
      return normalizeProject(stored);
    }
  } catch {}

  if (id !== DEFAULT_PROJECT_ID) {
    const fallback = await idbGet(DEFAULT_PROJECT_ID).catch(() => null);
    if (fallback) {
      setActiveProjectId(fallback.id);
      return normalizeProject(fallback);
    }
  }

  const migrated = migrateLegacy();
  if (migrated) {
    try { await idbPut(migrated); } catch {}
    setActiveProjectId(migrated.id);
    return migrated;
  }

  const fresh = createProject('Projeto', DEFAULT_PROJECT_ID);
  await idbPut(fresh).catch(() => {});
  setActiveProjectId(fresh.id);
  return fresh;
}

export async function saveProject(project) {
  const normalized = normalizeProject({ ...project, updatedAt: Date.now() });
  await idbPut(normalized);
  setActiveProjectId(normalized.id);
  return normalized;
}

export async function deleteProject(id) {
  await idbDelete(id);
  const projects = await listProjects();
  if (projects.length === 0) {
    const fresh = createProject();
    await saveProject(fresh);
    return fresh;
  }
  setActiveProjectId(projects[0].id);
  return projects[0];
}

export async function createSnapshot(project, reason = 'manual') {
  const normalized = normalizeProject(project);
  const snapshot = {
    snapshotId: `${Date.now()}-${crypto.randomUUID?.() ?? Math.random().toString(16).slice(2)}`,
    projectId: normalized.id,
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
  db.close();

  const snapshots = await listSnapshots(normalized.id);
  for (const stale of snapshots.slice(MAX_SNAPSHOTS)) {
    await deleteSnapshot(stale.snapshotId);
  }
  return snapshot;
}

export async function listSnapshots(projectId = null) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS, 'readonly');
    const req = tx.objectStore(SNAPSHOTS).getAll();
    req.onsuccess = () => {
      let rows = req.result ?? [];
      if (projectId) rows = rows.filter(x => (x.projectId ?? x.project?.id) === projectId);
      resolve(rows.sort((a,b)=>b.createdAt-a.createdAt));
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function deleteSnapshot(snapshotId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS, 'readwrite');
    tx.objectStore(SNAPSHOTS).delete(snapshotId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function restoreSnapshot(snapshotId) {
  const db = await openDb();
  const snapshot = await new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOTS, 'readonly');
    const req = tx.objectStore(SNAPSHOTS).get(snapshotId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
  if (!snapshot) throw new Error('Snapshot não encontrado');
  return saveProject(snapshot.project);
}
