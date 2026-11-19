export const APP_VERSION = '0.5.0';
export const STORAGE_KEY_V2 = 'devcpp-classroom:poc:v1';
export const DEFAULT_PROJECT_ID = 'default';
export const MAX_FILE_BYTES = 500_000;
export const MAX_PROJECT_BYTES = 2_000_000;
export const MAX_PROJECT_FILES = 50;

export const DEFAULT_C = '#include <stdio.h>\n\nint main(void) {\n    printf("Ola, mundo!\\n");\n    return 0;\n}\n';

export function languageFromName(name) {
  if (/\.c$/i.test(name)) return 'c';
  if (/\.(cpp|cc|cxx)$/i.test(name)) return 'cpp';
  throw new Error('Extensão não suportada para compilação');
}

export function validateFilename(name) {
  return typeof name === 'string'
    && /^[a-zA-Z0-9_ .-]+\.(c|cc|cpp|cxx|h|hpp)$/i.test(name)
    && name.length <= 100;
}

export function createProject() {
  return {
    id: DEFAULT_PROJECT_ID,
    name: 'Projeto',
    activeFile: 'main.c',
    files: { 'main.c': DEFAULT_C },
    updatedAt: Date.now(),
  };
}

export function projectSize(files) {
  return Object.entries(files).reduce(
    (sum, [name, source]) => sum + new TextEncoder().encode(name).length + new TextEncoder().encode(source).length,
    0,
  );
}

export function normalizeProject(input) {
  if (input && typeof input.name === 'string' && typeof input.source === 'string') {
    if (!validateFilename(input.name)) throw new Error('Projeto antigo inválido');
    return normalizeProject({
      id: DEFAULT_PROJECT_ID,
      name: 'Projeto',
      activeFile: input.name,
      files: { [input.name]: input.source },
      updatedAt: Date.now(),
    });
  }

  if (!input || typeof input !== 'object') return createProject();
  const files = input.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('Projeto inválido');

  const entries = Object.entries(files);
  if (entries.length === 0) throw new Error('Projeto vazio');
  if (entries.length > MAX_PROJECT_FILES) throw new Error('Demasiados ficheiros');

  const cleanFiles = {};
  for (const [name, source] of entries) {
    if (!validateFilename(name) || typeof source !== 'string') throw new Error('Ficheiro inválido');
    if (new TextEncoder().encode(source).length > MAX_FILE_BYTES) throw new Error('Ficheiro demasiado grande');
    cleanFiles[name] = source;
  }

  if (projectSize(cleanFiles) > MAX_PROJECT_BYTES) throw new Error('Projeto demasiado grande');

  const activeFile = cleanFiles[input.activeFile] !== undefined ? input.activeFile : Object.keys(cleanFiles)[0];
  return {
    id: DEFAULT_PROJECT_ID,
    name: typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 80) : 'Projeto',
    activeFile,
    files: cleanFiles,
    updatedAt: Number.isFinite(input.updatedAt) ? input.updatedAt : Date.now(),
  };
}

export function sourceFiles(project) {
  const normalized = normalizeProject(project);
  return Object.keys(normalized.files).filter(name => /\.(c|cc|cpp|cxx)$/i.test(name));
}

export function compilerLanguage(project) {
  return sourceFiles(project).some(name => /\.(cc|cpp|cxx)$/i.test(name)) ? 'cpp' : 'c';
}

export function runtimeFiles(project) {
  const normalized = normalizeProject(project);
  return Object.fromEntries(
    Object.entries(normalized.files).filter(([name]) => /\.(txt|dat|csv)$/i.test(name))
  );
}

export function addFile(project, name, source = '') {
  const normalized = normalizeProject(project);
  if (!validateFilename(name)) throw new Error('Nome de ficheiro inválido');
  const isNew = !(name in normalized.files);
  if (isNew && Object.keys(normalized.files).length >= MAX_PROJECT_FILES) throw new Error('Limite de ficheiros atingido');
  return normalizeProject({
    ...normalized,
    activeFile: name,
    files: { ...normalized.files, [name]: String(source) },
    updatedAt: Date.now(),
  });
}

export function removeFile(project, name) {
  const normalized = normalizeProject(project);
  const files = { ...normalized.files };
  if (!(name in files)) return normalized;
  if (Object.keys(files).length <= 1) throw new Error('O projeto precisa de pelo menos um ficheiro');
  delete files[name];
  return normalizeProject({
    ...normalized,
    files,
    activeFile: normalized.activeFile === name ? Object.keys(files)[0] : normalized.activeFile,
    updatedAt: Date.now(),
  });
}

export function publicCompileStatus(result) {
  return result?.success === true ? 'Compilação concluída.' : 'Compilação falhou.';
}


export function exportProjectPackage(project) {
  const normalized = normalizeProject(project);
  return JSON.stringify({
    format: 'devcpp-web-classroom-project',
    formatVersion: 1,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    project: normalized,
  }, null, 2);
}

export function importProjectPackage(text) {
  if (typeof text !== 'string' || text.length > MAX_PROJECT_BYTES * 2) throw new Error('Projeto inválido');
  const payload = JSON.parse(text);
  if (payload?.format !== 'devcpp-web-classroom-project' || payload?.formatVersion !== 1) {
    throw new Error('Formato de projeto não suportado');
  }
  return normalizeProject(payload.project);
}
