import { exportProjectPackage, importProjectPackage, normalizeProject } from './core.mjs';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DRIVE_FOLDER_NAME = 'Dev-C++ Web Classroom';

const TOKEN_KEY = 'devcpp:drive:token';
const RETURN_KEY = 'devcpp:drive:return';
const FOLDER_KEY = 'devcpp:drive:folder-id';
const API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const APP_MARKER_KEY = 'devcpp';
const APP_FOLDER_MARKER = 'root';
const APP_PROJECT_MARKER = 'project';

export class DriveAuthError extends Error {
  constructor(message = 'Autorização do Google Drive necessária.') {
    super(message);
    this.name = 'DriveAuthError';
  }
}

export class DriveConflictError extends Error {
  constructor(remote) {
    super('A versão no Google Drive foi alterada desde a última sincronização.');
    this.name = 'DriveConflictError';
    this.remote = remote;
  }
}

function safeJsonParse(value) {
  try { return JSON.parse(value); } catch { return null; }
}

export function getDriveSession() {
  const session = safeJsonParse(sessionStorage.getItem(TOKEN_KEY));
  if (!session?.accessToken || !Number.isFinite(session.expiresAt)) return null;
  if (session.expiresAt <= Date.now() + 30_000) {
    sessionStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return session;
}

export function driveConnected() {
  return getDriveSession() !== null;
}

export function disconnectDrive() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function beginDriveAuthorization(returnTo = '/') {
  sessionStorage.setItem(RETURN_KEY, String(returnTo || '/'));
  location.assign('/drive-auth.html');
}

export function consumeDriveReturnPath() {
  const value = sessionStorage.getItem(RETURN_KEY) || '/';
  sessionStorage.removeItem(RETURN_KEY);
  return value.startsWith('/') ? value : '/';
}

export async function getDriveOAuthConfig() {
  const response = await fetch('/api/drive-config', { cache: 'no-store' });
  if (!response.ok) throw new Error('Configuração OAuth indisponível.');
  const payload = await response.json();
  return {
    clientId: typeof payload?.clientId === 'string' ? payload.clientId.trim() : '',
  };
}

async function driveFetch(url, options = {}) {
  const session = getDriveSession();
  if (!session) throw new DriveAuthError();

  const headers = new Headers(options.headers ?? {});
  headers.set('Authorization', `Bearer ${session.accessToken}`);

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    disconnectDrive();
    throw new DriveAuthError('A sessão do Google Drive expirou.');
  }
  return response;
}

async function driveJson(url, options = {}) {
  const response = await driveFetch(url, options);
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error?.message || `Google Drive respondeu com HTTP ${response.status}.`);
  }
  return response.json();
}

function escapeDriveQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function getFolderById(id) {
  if (!id) return null;
  const response = await driveFetch(
    `${API_BASE}/files/${encodeURIComponent(id)}?fields=id,name,mimeType,trashed,appProperties`
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Não foi possível verificar a pasta do Google Drive.');
  const folder = await response.json();
  if (folder.trashed || folder.mimeType !== 'application/vnd.google-apps.folder') return null;
  if (folder.appProperties?.[APP_MARKER_KEY] !== APP_FOLDER_MARKER) return null;
  return folder;
}

async function findAppFolder() {
  const q = [
    "mimeType='application/vnd.google-apps.folder'",
    'trashed=false',
    `appProperties has { key='${APP_MARKER_KEY}' and value='${APP_FOLDER_MARKER}' }`,
  ].join(' and ');

  const params = new URLSearchParams({
    q,
    spaces: 'drive',
    fields: 'files(id,name,mimeType,modifiedTime,appProperties)',
    pageSize: '10',
  });
  const data = await driveJson(`${API_BASE}/files?${params}`);
  return data.files?.[0] ?? null;
}

async function createAppFolder() {
  return driveJson(`${API_BASE}/files?fields=id,name,mimeType,modifiedTime,appProperties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: {
        [APP_MARKER_KEY]: APP_FOLDER_MARKER,
        schema: '1',
      },
    }),
  });
}

export async function getOrCreateDriveFolder() {
  const stored = localStorage.getItem(FOLDER_KEY);
  let folder = await getFolderById(stored).catch(error => {
    if (error instanceof DriveAuthError) throw error;
    return null;
  });

  if (!folder) folder = await findAppFolder();
  if (!folder) folder = await createAppFolder();

  localStorage.setItem(FOLDER_KEY, folder.id);
  return folder;
}

export async function listDriveProjects() {
  const folder = await getOrCreateDriveFolder();
  const folderId = escapeDriveQueryValue(folder.id);
  const q = [
    `'${folderId}' in parents`,
    'trashed=false',
    `appProperties has { key='${APP_MARKER_KEY}' and value='${APP_PROJECT_MARKER}' }`,
  ].join(' and ');

  const params = new URLSearchParams({
    q,
    spaces: 'drive',
    fields: 'files(id,name,modifiedTime,size,appProperties)',
    orderBy: 'modifiedTime desc',
    pageSize: '100',
  });
  const data = await driveJson(`${API_BASE}/files?${params}`);
  return data.files ?? [];
}

export async function getDriveFileMetadata(fileId) {
  return driveJson(
    `${API_BASE}/files/${encodeURIComponent(fileId)}?fields=id,name,modifiedTime,trashed,appProperties`
  );
}

function multipartBody(metadata, content) {
  const boundary = `devcpp-${crypto.randomUUID?.() ?? Math.random().toString(16).slice(2)}`;
  const body = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n`,
    `--${boundary}--`,
  ].join('');
  return { boundary, body };
}

function driveFilename(project) {
  const safe = project.name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Projeto';
  return `${safe}.devcpp.json`;
}

function projectMetadata(project, folderId = null) {
  const metadata = {
    name: driveFilename(project),
    appProperties: {
      [APP_MARKER_KEY]: APP_PROJECT_MARKER,
      projectId: project.id,
      format: 'devcpp-v1',
    },
  };
  if (folderId) metadata.parents = [folderId];
  return metadata;
}

function attachDriveState(project, file) {
  return normalizeProject({
    ...project,
    drive: {
      fileId: file.id,
      modifiedTime: file.modifiedTime ?? null,
      syncedAt: new Date().toISOString(),
    },
  });
}

export async function saveProjectToDrive(project, { force = false } = {}) {
  const normalized = normalizeProject(project);
  const currentFileId = normalized.drive?.fileId ?? null;

  if (currentFileId && !force) {
    const remote = await getDriveFileMetadata(currentFileId);
    if (remote.trashed) throw new DriveConflictError(remote);
    if (normalized.drive?.modifiedTime && remote.modifiedTime !== normalized.drive.modifiedTime) {
      throw new DriveConflictError(remote);
    }
  }

  const content = exportProjectPackage(normalized);

  if (currentFileId) {
    const { boundary, body } = multipartBody(projectMetadata(normalized), content);
    const file = await driveJson(
      `${UPLOAD_BASE}/files/${encodeURIComponent(currentFileId)}?uploadType=multipart&fields=id,name,modifiedTime,appProperties`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    return attachDriveState(normalized, file);
  }

  const folder = await getOrCreateDriveFolder();
  const { boundary, body } = multipartBody(projectMetadata(normalized, folder.id), content);
  const file = await driveJson(
    `${UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,modifiedTime,appProperties`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  return attachDriveState(normalized, file);
}

export async function loadProjectFromDrive(file) {
  const response = await driveFetch(
    `${API_BASE}/files/${encodeURIComponent(file.id)}?alt=media`,
    { headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error('Não foi possível descarregar o projeto do Google Drive.');

  const imported = importProjectPackage(await response.text());
  return attachDriveState(imported, file);
}
