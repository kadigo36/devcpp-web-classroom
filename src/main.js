import { STORAGE_KEY, DEFAULT_C, makeProject, publicCompileStatus } from './core.mjs';
import { compileAndRun, stopActiveCompilation } from './compiler.mjs';

const $ = id => document.getElementById(id);
const editor = $('editor');
const filename = $('filename');
const saved = $('saved');
const output = $('output');
const stdin = $('stdin');
const compileButton = $('compile');
const stopButton = $('stop');
const phaseLabel = $('phase');

let project = { name: 'main.c', source: DEFAULT_C };
try {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
  project = makeProject(stored.name, stored.source);
} catch {}

function render() {
  filename.value = project.name;
  editor.value = project.source;
}

function persist() {
  try {
    project = makeProject(filename.value, editor.value);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    saved.textContent = 'Guardado localmente';
  } catch {
    saved.textContent = 'Não foi possível guardar — verifica o nome ou tamanho do ficheiro';
  }
}

let timer;
function schedule() {
  saved.textContent = 'Alterações por guardar';
  clearTimeout(timer);
  timer = setTimeout(persist, 500);
}

function setBusy(busy) {
  compileButton.disabled = busy;
  stopButton.disabled = !busy;
  editor.readOnly = busy;
  filename.disabled = busy;
}

function phaseText(phase) {
  if (phase === 'toolchain') return 'A carregar compilador local…';
  if (phase === 'compile') return 'A compilar…';
  if (phase === 'run') return 'A executar…';
  return '';
}

editor.addEventListener('input', schedule);
filename.addEventListener('input', schedule);
editor.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const s = editor.selectionStart;
    editor.setRangeText('    ', s, editor.selectionEnd, 'end');
    schedule();
  }
});

$('new').onclick = () => {
  if (!confirm('Criar novo ficheiro? Exporta primeiro o trabalho que pretendes preservar.')) return;
  project = { name: 'main.c', source: DEFAULT_C };
  render();
  persist();
  output.textContent = '';
};

$('open').onclick = () => $('file').click();
$('file').onchange = async e => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    project = makeProject(f.name, await f.text());
    render();
    persist();
    output.textContent = '';
  } catch {
    output.textContent = 'Não foi possível abrir o ficheiro.';
  }
  e.target.value = '';
};

$('save').onclick = () => {
  try {
    persist();
    const p = makeProject(filename.value, editor.value);
    const url = URL.createObjectURL(new Blob([p.source], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = p.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    output.textContent = 'Não foi possível exportar o ficheiro.';
  }
};

compileButton.onclick = async () => {
  try {
    persist();
    const current = makeProject(filename.value, editor.value);
    output.textContent = '';
    phaseLabel.textContent = 'A preparar…';
    setBusy(true);

    const result = await compileAndRun(current, stdin.value, {
      onPhase: phase => { phaseLabel.textContent = phaseText(phase); },
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

render();
setBusy(false);
