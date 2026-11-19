import { executeWasi } from './wasi-host.mjs';

// Pinned: não atualizar automaticamente. Mudanças de toolchain exigem revisão explícita.
const TOOLCHAIN_URL = 'https://cdn.jsdelivr.net/npm/@yowasp/clang@21.1.4-3/gen/bundle.js';
let toolchainPromise;

function loadToolchain() {
  toolchainPromise ??= import(TOOLCHAIN_URL);
  return toolchainPromise;
}

function compilerArgs(project) {
  const compiler = project.language === 'cpp' ? 'clang++' : 'clang';
  const standard = project.language === 'cpp' ? '-std=c++20' : '-std=c17';
  return [
    compiler,
    standard,
    '-O0',
    '-Wno-everything',
    '-fno-color-diagnostics',
    ...project.sources,
    '-o',
    'program.wasm',
    '-lm',
  ];
}

self.onmessage = async event => {
  const { id, project, input = '', args = [] } = event.data ?? {};
  if (!id || !project) return;

  try {
    self.postMessage({ id, type: 'phase', phase: 'toolchain' });
    const { runClang } = await loadToolchain();
    if (typeof runClang !== 'function') throw new Error('Toolchain incompatível');

    self.postMessage({ id, type: 'phase', phase: 'compile' });
    let outputs;
    try {
      outputs = await runClang(
        compilerArgs(project),
        project.files,
        {
          stdout: null,
          stderr: null,
          decodeASCII: false,
          fetchProgress: ({ totalLength, doneLength }) => {
            const progress = totalLength > 0 ? Math.min(1, doneLength / totalLength) : null;
            self.postMessage({ id, type: 'phase', phase: 'toolchain', progress });
          },
        },
      );
    } catch {
      self.postMessage({ id, type: 'result', result: { success: false, stage: 'compile' } });
      return;
    }

    const executable = outputs?.['program.wasm'];
    if (!(executable instanceof Uint8Array) && !(executable instanceof ArrayBuffer)) {
      self.postMessage({ id, type: 'result', result: { success: false, stage: 'compile' } });
      return;
    }

    self.postMessage({ id, type: 'phase', phase: 'run' });
    try {
      const run = await executeWasi(executable, input, {
        args,
        files: project.runtimeFiles,
        onStdout: chunk => self.postMessage({ id, type: 'stdout', chunk }),
      });
      self.postMessage({
        id,
        type: 'result',
        result: {
          success: true,
          stage: 'run',
          exitCode: run.exitCode,
          stdout: run.stdout,
          runtimeFailed: run.exitCode !== 0,
          outputTruncated: run.outputTruncated === true,
        },
      });
    } catch {
      self.postMessage({
        id,
        type: 'result',
        result: { success: true, stage: 'run', exitCode: null, stdout: '', runtimeFailed: true },
      });
    }
  } catch {
    self.postMessage({ id, type: 'result', result: { success: false, stage: 'toolchain' } });
  }
};
