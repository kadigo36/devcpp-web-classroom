import { executeWasi } from './wasi-host.mjs';

// Versão fixa para a PoC: evita alterações inesperadas no compilador entre aulas.
const TOOLCHAIN_URL = 'https://cdn.jsdelivr.net/npm/@yowasp/clang@21.1.4-3/gen/bundle.js';
let toolchainPromise;

function loadToolchain() {
  toolchainPromise ??= import(TOOLCHAIN_URL);
  return toolchainPromise;
}

function compilerArgs(language, filename) {
  const compiler = language === 'cpp' ? 'clang++' : 'clang';
  const standard = language === 'cpp' ? '-std=c++20' : '-std=c17';
  return {
    compiler,
    args: [
      standard,
      '-O0',
      '-Wno-everything',
      '-fno-color-diagnostics',
      filename,
      '-o',
      'program.wasm',
      '-lm',
    ],
  };
}

function diagnosticSink() {
  // Os diagnósticos são deliberadamente descartados. A UI recebe apenas sucesso/falha.
  return () => {};
}

self.onmessage = async event => {
  const { id, project, input = '' } = event.data ?? {};
  if (!id || !project) return;

  try {
    self.postMessage({ id, type: 'phase', phase: 'toolchain' });
    const toolchain = await loadToolchain();
    const { compiler, args } = compilerArgs(project.language, project.name);
    const command = toolchain.commands?.[compiler];
    if (typeof command !== 'function') throw new Error('Compilador WebAssembly indisponível.');

    self.postMessage({ id, type: 'phase', phase: 'compile' });
    let outputs;
    try {
      outputs = await command(
        args,
        { [project.name]: project.source },
        { stdout: diagnosticSink(), stderr: diagnosticSink(), decodeASCII: false },
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
      const run = await executeWasi(executable, input);
      self.postMessage({
        id,
        type: 'result',
        result: {
          success: true,
          stage: 'run',
          exitCode: run.exitCode,
          stdout: run.stdout,
          runtimeFailed: run.exitCode !== 0,
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
