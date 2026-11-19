import { languageFromName, makeProject } from './core.mjs';

const DEFAULT_COMPILE_TIMEOUT_MS = 45_000;
const DEFAULT_RUN_TIMEOUT_MS = 5_000;
let sequence = 0;
let activeJob = null;

export function stopActiveCompilation() {
  if (!activeJob) return false;
  activeJob.stop();
  return true;
}

export async function compileAndRun(project, input = '', options = {}) {
  const safeProject = makeProject(project?.name, project?.source);
  const language = languageFromName(safeProject.name);
  const request = { ...safeProject, language };
  const compileTimeoutMs = options.compileTimeoutMs ?? DEFAULT_COMPILE_TIMEOUT_MS;
  const runTimeoutMs = options.runTimeoutMs ?? DEFAULT_RUN_TIMEOUT_MS;
  const onPhase = typeof options.onPhase === 'function' ? options.onPhase : () => {};

  stopActiveCompilation();
  const worker = new Worker(new URL('./compiler-worker.mjs', import.meta.url), { type: 'module' });
  const id = `job-${Date.now()}-${++sequence}`;

  return new Promise(resolve => {
    let settled = false;
    let phase = 'toolchain';
    let timer;

    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      if (activeJob?.worker === worker) activeJob = null;
      resolve(result);
    };

    const stop = () => finish({
      success: phase === 'run',
      stage: phase,
      stopped: true,
      stdout: '',
      runtimeFailed: phase === 'run',
    });

    activeJob = { worker, stop };

    const armTimeout = ms => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        finish({
          success: phase === 'run',
          stage: phase,
          timedOut: true,
          stdout: '',
          runtimeFailed: phase === 'run',
        });
      }, ms);
    };

    worker.onmessage = event => {
      if (event.data?.id !== id) return;
      if (event.data.type === 'phase') {
        phase = event.data.phase;
        onPhase(phase);
        armTimeout(phase === 'run' ? runTimeoutMs : compileTimeoutMs);
        return;
      }
      if (event.data.type === 'result') finish(event.data.result);
    };

    worker.onerror = () => finish({ success: false, stage: phase });
    armTimeout(compileTimeoutMs);
    worker.postMessage({ id, project: request, input: String(input ?? '') });
  });
}
