import {
  APP_VERSION,
  addFile,
  compilerLanguage,
  createProject,
  normalizeProject,
  publicCompileStatus,
  removeFile,
  validateFilename,
} from './core.mjs';
import { compileAndRun, stopActiveCompilation } from './compiler.mjs';
import { loadProject, saveProject } from './storage.mjs';

const $ = id => document.getElementById(id);
const editor = $('editor');
const filename = $('filename');
const saved = $('saved');
const output = $('output');
const stdin = $('stdin');
const compileButton = $('compile');
const stopButton = $('stop');
const phaseLabel = $('phase');
const fileList = $('fileList');
const languageLabel = $('language');

let project = await loadProject();
let saveTimer;

function activeSource() {
  return project.files[project.activeFile] ?? '';
}

function persistEditorIntoProject() {
  project = normalizeProject({
    ...project,
    files: {
      ...project.files,
      [project.activeFile]: editor.value,
    },
    updatedAt: Date.now(),
  });
}

async function persistNow() {
  try {
    persistEditorIntoProject();
    project = await saveProject(project);
    saved.textContent = 'Guardado';
  } catch {
    saved.textContent = 'Erro ao guardar';
  }
}

function scheduleSave() {
  saved.textContent = 'A guardar…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 400);
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
      await saveProject(project);
      render();
    };
    fileList.append(button);
  }
}

function render() {
  filename.value = project.activeFile;
  editor.value = activeSource();
  languageLabel.textContent = compilerLanguage(project).toUpperCase();
  renderFileList();
}

function phaseText(phase, progress) {
  if (phase === 'toolchain') {
    if (typeof progress === 'number') return `A carregar compilador… ${Math.round(progress * 100)}%`;
    return 'A carregar compilador…';
  }
  if (phase === 'compile') return 'A compilar…';
  if (phase === 'run') return 'A executar…';
  return '';
}

function setBusy(busy) {
  compileButton.disabled = busy;
  stopButton.disabled = !busy;
  editor.readOnly = busy;
  $('newProject').disabled = busy;
  $('newFile').disabled = busy;
  $('open').disabled = busy;
  $('deleteFile').disabled = busy;
}

editor.addEventListener('input', scheduleSave);
editor.addEventListener('keydown', event => {
  if (event.key === 'Tab') {
    event.preventDefault();
    const start = editor.selectionStart;
    editor.setRangeText('    ', start, editor.selectionEnd, 'end');
    scheduleSave();
  }
});

$('newProject').onclick = async () => {
  if (!confirm('Criar um novo projeto local? Exporta primeiro qualquer trabalho que pretendas preservar.')) return;
  project = createProject();
  project = await saveProject(project);
  output.textContent = '';
  stdin.value = '';
  render();
};

$('newFile').onclick = async () => {
  const name = prompt('Nome do novo ficheiro (.c, .cpp, .h, .hpp):', 'ficheiro.c');
  if (name === null) return;
  const clean = name.trim();
  if (!validateFilename(clean)) {
    output.textContent = 'Nome de ficheiro inválido.';
    return;
  }
  persistEditorIntoProject();
  project = addFile(project, clean, project.files[clean] ?? '');
  project = await saveProject(project);
  render();
};

$('deleteFile').onclick = async () => {
  if (!confirm(`Eliminar ${project.activeFile} do projeto local?`)) return;
  try {
    project = removeFile(project, project.activeFile);
    project = await saveProject(project);
    render();
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
    render();
    output.textContent = '';
  } catch {
    output.textContent = 'Não foi possível importar o ficheiro.';
  }
  event.target.value = '';
};

$('save').onclick = async () => {
  try {
    await persistNow();
    const source = project.files[project.activeFile];
    const url = URL.createObjectURL(new Blob([source], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = project.activeFile;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    output.textContent = 'Não foi possível exportar o ficheiro.';
  }
};

compileButton.onclick = async () => {
  try {
    await persistNow();
    output.textContent = '';
    phaseLabel.textContent = 'A preparar…';
    setBusy(true);

    const result = await compileAndRun(project, stdin.value, {
      onPhase: (phase, progress) => {
        phaseLabel.textContent = phaseText(phase, progress);
      },
    });

    if (result.stopped) {
      output.textContent = 'Execução interrompida.';
      return;
    }

    if (!result.success) {
      output.textContent = result.timedOut ? 'Compilação interrompida.' : publicCompileStatus(result);
      return;
    }

    if (result.timedOut) {
      output.textContent = 'Execução interrompida.';
      return;
    }

    const visible = result.stdout ?? '';
    output.textContent = visible || (result.runtimeFailed ? 'Execução terminou com erro.' : 'Programa executado sem saída.');
    if (result.runtimeFailed && visible) output.textContent += '\n\nExecução terminou com erro.';
  } catch {
    output.textContent = 'Não foi possível compilar.';
  } finally {
    phaseLabel.textContent = '';
    setBusy(false);
  }
};

stopButton.onclick = () => {
  if (stopActiveCompilation()) {
    output.textContent = 'Execução interrompida.';
    phaseLabel.textContent = '';
    setBusy(false);
  }
};

if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, { once: true });
}

document.title = `Dev-C++ Web Classroom v${APP_VERSION}`;
render();
setBusy(false);
