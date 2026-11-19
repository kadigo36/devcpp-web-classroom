import {
  APP_VERSION,
  addFile,
  compilerLanguage,
  cloneProjectAsNew,
  createProject,
  exportProjectPackage,
  importProjectPackage,
  normalizeProject,
  programArgsFromLines,
  duplicateFile,
  publicCompileStatus,
  removeFile,
  renameFile,
  renameProject,
  validateFilename,
} from './core.mjs';
import { compileAndRun, interactiveStdinSupported, stopActiveCompilation } from './compiler.mjs';
import { diagnoseEnvironment, formatDiagnostics } from './diagnostics.mjs';
import {
  createSnapshot,
  deleteProject,
  listProjects,
  listSnapshots,
  loadProject,
  restoreSnapshot,
  saveProject,
  setActiveProjectId,
} from './storage.mjs';

const $ = id => document.getElementById(id);
const editor = $('editor');
const filename = $('filename');
const saved = $('saved');
const output = $('output');
const stdin = $('stdin');
const argsInput = $('args');
const compileButton = $('compile');
const stopButton = $('stop');
const phaseLabel = $('phase');
const fileList = $('fileList');
const languageLabel = $('language');
const networkStatus = $('networkStatus');
const compatStatus = $('compatStatus');
const projectSelect = $('projectSelect');
const runtimeInputPanel = $('runtimeInputPanel');
const runtimeInput = $('runtimeInput');
const sendRuntimeInput = $('sendRuntimeInput');
const menuToggle = $('menuToggle');
const menuClose = $('menuClose');
const menuBackdrop = $('menuBackdrop');
const appMenu = $('appMenu');
const currentProjectName = $('currentProjectName');

let project = await loadProject();
let saveTimer;
let pendingRuntimeInputResolve = null;

function activeSource() {
  return project.files[project.activeFile] ?? '';
}

function persistEditorIntoProject() {
  project = normalizeProject({
    ...project,
    files: { ...project.files, [project.activeFile]: editor.value },
    runConfig: { stdin: stdin.value, args: argsInput.value },
    updatedAt: Date.now(),
  });
}

async function persistNow() {
  try {
    persistEditorIntoProject();
    project = await saveProject(project);
    saved.textContent = 'Guardado';
    return true;
  } catch {
    saved.textContent = 'Erro ao guardar';
    return false;
  }
}

function scheduleSave() {
  saved.textContent = 'A guardar…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 400);
}

function downloadText(name, text, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderFileList() {
  fileList.replaceChildren();
  for (const name of Object.keys(project.files).sort((a, b) => a.localeCompare(b))) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'file-item' + (name === project.activeFile ? ' active' : '');
    button.textContent = name;
    button.onclick = async () => {
      if (name === project.activeFile) return;
      persistEditorIntoProject();
      project = normalizeProject({ ...project, activeFile: name });
      project = await saveProject(project);
      await render();
    };
    fileList.append(button);
  }
}

async function renderProjectSelect() {
  const projects = await listProjects();
  projectSelect.replaceChildren();
  for (const item of projects) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    option.selected = item.id === project.id;
    projectSelect.append(option);
  }
}

async function render() {
  currentProjectName.textContent = project.name;
  currentProjectName.title = project.name;
  filename.value = project.activeFile;
  editor.value = activeSource();
  stdin.value = project.runConfig?.stdin ?? '';
  argsInput.value = project.runConfig?.args ?? '';
  languageLabel.textContent = compilerLanguage(project).toUpperCase();
  renderFileList();
  await renderProjectSelect();
}

function phaseText(phase, progress) {
  if (phase === 'toolchain') {
    if (typeof progress === 'number') return `A carregar compilador… ${Math.round(progress * 100)}%`;
    return navigator.onLine ? 'A carregar compilador…' : 'Compilador indisponível sem cache/rede.';
  }
  if (phase === 'compile') return 'A compilar…';
  if (phase === 'run') return 'A executar…';
  return '';
}

function setBusy(busy) {
  const ids = [
    'newProject', 'renameProject', 'deleteProject', 'newFile', 'renameFile', 'duplicateFile', 'open', 'save', 'exportProject', 'importProject',
    'backupProject', 'restoreProject', 'prepareOffline', 'diagnoseEnvironment', 'deleteFile',
  ];
  for (const id of ids) $(id).disabled = busy;
  compileButton.disabled = busy;
  stopButton.disabled = !busy;
  editor.readOnly = busy;
  projectSelect.disabled = busy;
}

function updateNetworkStatus() {
  networkStatus.textContent = navigator.onLine ? 'Online' : 'Offline';
  networkStatus.dataset.state = navigator.onLine ? 'online' : 'offline';
}

function setMenuOpen(open) {
  const isOpen = open === true;
  appMenu.classList.toggle('open', isOpen);
  appMenu.setAttribute('aria-hidden', String(!isOpen));
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuBackdrop.hidden = !isOpen;
  document.body.classList.toggle('menu-open', isOpen);
  if (isOpen) queueMicrotask(() => menuClose.focus());
  else if (document.activeElement === menuClose || appMenu.contains(document.activeElement)) {
    queueMicrotask(() => menuToggle.focus());
  }
}
function closeAppMenu(){ setMenuOpen(false); }
function openAppMenu(){ setMenuOpen(true); }
menuToggle.onclick = () => appMenu.classList.contains('open') ? closeAppMenu() : openAppMenu();
menuClose.onclick = closeAppMenu;
menuBackdrop.onclick = closeAppMenu;
appMenu.addEventListener('click', event => {
  if (event.target.closest('[data-menu-action]')) closeAppMenu();
});


function closeRuntimeInput(value = null) {
  const resolve = pendingRuntimeInputResolve;
  pendingRuntimeInputResolve = null;
  runtimeInputPanel.hidden = true;
  runtimeInput.value = '';
  if (resolve) resolve(value);
}

function requestRuntimeInput() {
  if (!interactiveStdinSupported()) return Promise.resolve(null);
  if (pendingRuntimeInputResolve) closeRuntimeInput(null);

  runtimeInputPanel.hidden = false;
  runtimeInput.value = '';
  queueMicrotask(() => runtimeInput.focus());

  return new Promise(resolve => {
    pendingRuntimeInputResolve = resolve;
  });
}

function submitRuntimeInput() {
  if (!pendingRuntimeInputResolve) return;
  const value = runtimeInput.value;
  closeRuntimeInput(value);
}

sendRuntimeInput.onclick = submitRuntimeInput;
runtimeInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitRuntimeInput();
  }
});

editor.addEventListener('input', scheduleSave);
stdin.addEventListener('input', scheduleSave);
argsInput.addEventListener('input', scheduleSave);
editor.addEventListener('keydown', event => {
  if (event.key === 'Tab') {
    event.preventDefault();
    const start = editor.selectionStart;
    editor.setRangeText('    ', start, editor.selectionEnd, 'end');
    scheduleSave();
  }
});

projectSelect.onchange = async () => {
  closeAppMenu();
  try {
    await persistNow();
    project = await loadProject(projectSelect.value);
    setActiveProjectId(project.id);
    output.textContent = '';
    stdin.value = '';
    argsInput.value = '';
    await render();
  } catch {
    output.textContent = 'Não foi possível abrir o projeto.';
  }
};

$('newProject').onclick = async () => {
  const name = prompt('Nome do novo projeto:', 'Novo projeto');
  if (name === null) return;
  try {
    await persistNow();
    project = await saveProject(createProject(name));
    output.textContent = '';
    stdin.value = '';
    argsInput.value = '';
    await render();
  } catch {
    output.textContent = 'Não foi possível criar o projeto.';
  }
};

$('renameProject').onclick = async () => {
  const name = prompt('Novo nome do projeto:', project.name);
  if (name === null) return;
  try {
    project = await saveProject(renameProject(project, name));
    await render();
  } catch {
    output.textContent = 'Nome de projeto inválido.';
  }
};

$('deleteProject').onclick = async () => {
  if (!confirm(`Eliminar o projeto "${project.name}" deste navegador?`)) return;
  try {
    await persistNow();
    await createSnapshot(project, 'before-delete-project').catch(() => {});
    project = await deleteProject(project.id);
    output.textContent = 'Projeto eliminado.';
    stdin.value = '';
    argsInput.value = '';
    await render();
  } catch {
    output.textContent = 'Não foi possível eliminar o projeto.';
  }
};

$('newFile').onclick = async () => {
  const name = prompt('Nome do novo ficheiro (.c, .cpp, .h, .hpp, .txt, .dat, .csv):', 'ficheiro.c');
  if (name === null) return;
  const clean = name.trim();
  if (!validateFilename(clean)) {
    output.textContent = 'Nome de ficheiro inválido.';
    return;
  }
  try {
    persistEditorIntoProject();
    project = addFile(project, clean, project.files[clean] ?? '');
    project = await saveProject(project);
    await render();
  } catch {
    output.textContent = 'Não foi possível criar o ficheiro.';
  }
};

$('renameFile').onclick = async () => {
  const next = prompt('Novo nome do ficheiro:', project.activeFile);
  if (next === null) return;
  try {
    await persistNow();
    project = await saveProject(renameFile(project, project.activeFile, next.trim()));
    await render();
  } catch {
    output.textContent = 'Não foi possível renomear o ficheiro.';
  }
};

$('duplicateFile').onclick = async () => {
  const source = project.activeFile;
  const dot = source.lastIndexOf('.');
  const suggested = dot > 0 ? `${source.slice(0, dot)}-copia${source.slice(dot)}` : `${source}-copia`;
  const target = prompt('Nome da cópia:', suggested);
  if (target === null) return;
  try {
    await persistNow();
    project = await saveProject(duplicateFile(project, source, target.trim()));
    await render();
  } catch {
    output.textContent = 'Não foi possível duplicar o ficheiro.';
  }
};

$('deleteFile').onclick = async () => {
  if (!confirm(`Eliminar ${project.activeFile} do projeto local?`)) return;
  try {
    await persistNow();
    await createSnapshot(project, 'before-delete-file').catch(() => {});
    project = removeFile(project, project.activeFile);
    project = await saveProject(project);
    await render();
  } catch {
    output.textContent = 'O projeto precisa de pelo menos um ficheiro.';
  }
};

$('open').onclick = () => $('file').click();
$('file').onchange = async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (!validateFilename(file.name) || file.size > 500_000) throw new Error();
    persistEditorIntoProject();
    project = addFile(project, file.name, await file.text());
    project = await saveProject(project);
    await render();
    output.textContent = '';
  } catch {
    output.textContent = 'Não foi possível importar o ficheiro.';
  }
  event.target.value = '';
};

$('save').onclick = async () => {
  try {
    await persistNow();
    downloadText(project.activeFile, project.files[project.activeFile]);
  } catch {
    output.textContent = 'Não foi possível exportar o ficheiro.';
  }
};

$('exportProject').onclick = async () => {
  try {
    await persistNow();
    const safeName = project.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'projeto';
    downloadText(`${safeName}.devcpp.json`, exportProjectPackage(project), 'application/json;charset=utf-8');
  } catch {
    output.textContent = 'Não foi possível exportar o projeto.';
  }
};

$('importProject').onclick = () => $('projectFile').click();
$('projectFile').onchange = async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 4_000_000) throw new Error();
    const imported = cloneProjectAsNew(importProjectPackage(await file.text()));
    await persistNow();
    project = await saveProject(imported);
    output.textContent = 'Projeto importado como novo projeto.';
    await render();
  } catch {
    output.textContent = 'Projeto inválido ou demasiado grande.';
  } finally {
    event.target.value = '';
  }
};

async function runEnvironmentDiagnosis(showDetails = true) {
  try {
    const report = await diagnoseEnvironment(globalThis);
    compatStatus.textContent = report.requiredOk ? 'Compatibilidade: OK' : 'Compatibilidade: falhou';
    compatStatus.dataset.state = report.requiredOk ? 'online' : 'offline';
    if (showDetails) output.textContent = formatDiagnostics(report);
    return report;
  } catch {
    compatStatus.textContent = 'Compatibilidade: desconhecida';
    compatStatus.dataset.state = 'offline';
    if (showDetails) output.textContent = 'Não foi possível verificar a compatibilidade deste navegador.';
    return null;
  }
}

$('diagnoseEnvironment').onclick = () => runEnvironmentDiagnosis(true);

$('prepareOffline').onclick = async () => {
  setBusy(true);
  output.textContent = 'A preparar compilador para utilização offline…';
  phaseLabel.textContent = 'A preparar C…';

  try {
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.ready;
    }

    let persistent = null;
    if (navigator.storage?.persist) {
      try { persistent = await navigator.storage.persist(); } catch {}
    }

    const cProbe = {
      id: 'default',
      name: 'Diagnóstico C',
      activeFile: 'probe.c',
      files: { 'probe.c': 'int main(void) { return 0; }' },
      updatedAt: Date.now(),
    };

    const cppProbe = {
      id: 'default',
      name: 'Diagnóstico C++',
      activeFile: 'probe.cpp',
      files: {
        'probe.cpp': '#include <iostream>\n#include <string>\n#include <vector>\nint main() { std::vector<std::string> v{"ok"}; return v.empty(); }',
      },
      updatedAt: Date.now(),
    };

    const cResult = await compileAndRun(cProbe, '', {
      compileTimeoutMs: 120_000,
      runTimeoutMs: 10_000,
      onPhase: (phase, progress) => {
        phaseLabel.textContent = phaseText(phase, progress);
      },
    });
    if (!cResult.success || cResult.runtimeFailed || cResult.timedOut) throw new Error('C probe failed');

    phaseLabel.textContent = 'A preparar C++…';
    const cppResult = await compileAndRun(cppProbe, '', {
      compileTimeoutMs: 120_000,
      runTimeoutMs: 10_000,
      onPhase: (phase, progress) => {
        phaseLabel.textContent = phaseText(phase, progress);
      },
    });
    if (!cppResult.success || cppResult.runtimeFailed || cppResult.timedOut) throw new Error('C++ probe failed');

    let cachedResources = null;
    if ('caches' in globalThis) {
      try {
        const cache = await caches.open('devcpp-toolchain-v21.1.4-3');
        cachedResources = (await cache.keys()).length;
      } catch {}
    }

    const persistenceText = persistent === true
      ? 'armazenamento persistente ativo'
      : persistent === false
        ? 'armazenamento persistente não garantido pelo browser'
        : 'persistência não verificada';

    const cacheText = Number.isInteger(cachedResources)
      ? `${cachedResources} recursos da toolchain em cache`
      : 'cache da toolchain preparada';

    output.textContent = `Preparação concluída. C: OK · C++: OK · ${cacheText} · ${persistenceText}.`;
  } catch {
    output.textContent = 'Não foi possível concluir a preparação offline. É necessária ligação à Internet na primeira preparação.';
  } finally {
    if (pendingRuntimeInputResolve) closeRuntimeInput(null);
    phaseLabel.textContent = '';
    setBusy(false);
  }
};

$('backupProject').onclick = async () => {
  try {
    await persistNow();
    await createSnapshot(project, 'manual');
    output.textContent = 'Backup local criado.';
  } catch {
    output.textContent = 'Não foi possível criar o backup local.';
  }
};

$('restoreProject').onclick = async () => {
  try {
    const snapshots = await listSnapshots(project.id);
    if (snapshots.length === 0) {
      output.textContent = 'Não existem backups locais.';
      return;
    }
    const choices = snapshots.map((snapshot, index) =>
      `${index + 1}. ${new Date(snapshot.createdAt).toLocaleString('pt-PT')} · ${snapshot.reason}`
    ).join('\n');
    const selected = prompt(`Escolhe o backup a restaurar:\n\n${choices}`, '1');
    if (selected === null) return;
    const index = Number(selected) - 1;
    if (!Number.isInteger(index) || !snapshots[index]) throw new Error();
    await persistNow();
    await createSnapshot(project, 'before-restore').catch(() => {});
    project = await restoreSnapshot(snapshots[index].snapshotId);
    output.textContent = 'Backup restaurado.';
    await render();
  } catch {
    output.textContent = 'Não foi possível restaurar o backup.';
  }
};

compileButton.onclick = async () => {
  try {
    await persistNow();
    const args = programArgsFromLines(argsInput.value);
    let streamedOutput = '';

    output.textContent = '';
    phaseLabel.textContent = 'A preparar…';
    setBusy(true);

    const result = await compileAndRun(project, stdin.value, {
      args,
      onInputRequest: interactiveStdinSupported() ? requestRuntimeInput : undefined,
      onPhase: (phase, progress) => {
        phaseLabel.textContent = phaseText(phase, progress);
      },
      onOutput: chunk => {
        streamedOutput += chunk;
        output.textContent = streamedOutput;
      },
    });

    if (result.stopped) {
      output.textContent = streamedOutput
        ? streamedOutput + '\n\n[Execução interrompida.]'
        : 'Execução interrompida.';
      return;
    }
    if (!result.success) {
      output.textContent = result.timedOut ? 'Compilação interrompida.' : publicCompileStatus(result);
      return;
    }
    if (result.timedOut) {
      output.textContent = streamedOutput
        ? streamedOutput + '\n\n[Execução interrompida.]'
        : 'Execução interrompida.';
      return;
    }

    const visible = streamedOutput || result.stdout || '';
    output.textContent = visible || (result.runtimeFailed ? 'Execução terminou com erro.' : 'Programa executado sem saída.');
    if (result.outputTruncated) output.textContent += '\n\n[Saída truncada por limite de segurança.]';
    if (result.runtimeFailed && visible) output.textContent += '\n\nExecução terminou com erro.';
  } catch {
    output.textContent = 'Não foi possível compilar.';
  } finally {
    phaseLabel.textContent = '';
    setBusy(false);
  }
};

stopButton.onclick = () => {
  if (pendingRuntimeInputResolve) closeRuntimeInput(null);
  if (stopActiveCompilation()) {
    output.textContent = 'Execução interrompida.';
    phaseLabel.textContent = '';
    setBusy(false);
  }
};

addEventListener('keydown', event => {
  const modifier = event.ctrlKey || event.metaKey;

  if (modifier && event.key.toLowerCase() === 's') {
    event.preventDefault();
    persistNow();
    return;
  }

  if (modifier && event.key === 'Enter') {
    event.preventDefault();
    if (!compileButton.disabled) compileButton.click();
    return;
  }

  if (event.key === 'Escape') {
    if (appMenu.classList.contains('open')) {
      event.preventDefault();
      closeAppMenu();
      if (stopButton.disabled) return;
    }
    if (!stopButton.disabled) {
      event.preventDefault();
      stopButton.click();
    }
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void persistNow();
});

addEventListener('pagehide', () => {
  try { persistEditorIntoProject(); } catch {}
  void saveProject(project).catch(() => {});
});

addEventListener('online', updateNetworkStatus);
addEventListener('offline', updateNetworkStatus);
updateNetworkStatus();
await runEnvironmentDiagnosis(false);

if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, { once: true });
}

document.title = `Dev-C++ Web Classroom v${APP_VERSION}`;
await render();
setBusy(false);
