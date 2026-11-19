import { compilerLanguage, normalizeProject, runtimeFiles, sourceFiles } from './core.mjs';

const DEFAULT_COMPILE_TIMEOUT_MS = 60_000;
const DEFAULT_RUN_TIMEOUT_MS = 5_000;
const INTERACTIVE_INPUT_BYTES = 64 * 1024;
const INTERACTIVE_CONTROL_INTS = 2;
const INPUT_WAITING = 0;
const INPUT_READY = 1;
const INPUT_EOF = 2;
let sequence = 0;
let activeJob = null;

function createInteractiveInputChannel() {
  if (globalThis.crossOriginIsolated !== true || typeof SharedArrayBuffer !== 'function') return null;
  const controlBytes = INTERACTIVE_CONTROL_INTS * Int32Array.BYTES_PER_ELEMENT;
  const buffer = new SharedArrayBuffer(controlBytes + INTERACTIVE_INPUT_BYTES);
  return {
    buffer,
    control: new Int32Array(buffer, 0, INTERACTIVE_CONTROL_INTS),
    bytes: new Uint8Array(buffer, controlBytes),
  };
}

function answerInteractiveInput(channel, value) {
  if (!channel) return;
  if (value === null || value === undefined) {
    Atomics.store(channel.control, 1, 0);
    Atomics.store(channel.control, 0, INPUT_EOF);
    Atomics.notify(channel.control, 0, 1);
    return;
  }

  const encoded = new TextEncoder().encode(String(value) + '\n');
  const length = Math.min(encoded.length, channel.bytes.length);
  channel.bytes.fill(0);
  channel.bytes.set(encoded.subarray(0, length), 0);
  Atomics.store(channel.control, 1, length);
  Atomics.store(channel.control, 0, INPUT_READY);
  Atomics.notify(channel.control, 0, 1);
}

export function stopActiveCompilation() {
  if (!activeJob) return false;
  activeJob.stop();
  return true;
}

export function interactiveStdinSupported() {
  return createInteractiveInputChannel() !== null;
}

export async function compileAndRun(project, input = '', options = {}) {
  const safeProject = normalizeProject(project);
  const sources = sourceFiles(safeProject);
  if (sources.length === 0) return { success: false, stage: 'compile' };

  const request = {
    files: safeProject.files,
    language: compilerLanguage(safeProject),
    sources,
    runtimeFiles: runtimeFiles(safeProject),
  };
  const compileTimeoutMs = options.compileTimeoutMs ?? DEFAULT_COMPILE_TIMEOUT_MS;
  const runTimeoutMs = options.runTimeoutMs ?? DEFAULT_RUN_TIMEOUT_MS;
  const onPhase = typeof options.onPhase === 'function' ? options.onPhase : () => {};
  const onOutput = typeof options.onOutput === 'function' ? options.onOutput : () => {};
  const onInputRequest = typeof options.onInputRequest === 'function' ? options.onInputRequest : null;
  const args = Array.isArray(options.args) ? options.args.map(value => String(value)) : [];
  const interactiveInput = onInputRequest ? createInteractiveInputChannel() : null;

  stopActiveCompilation();
  const worker = new Worker(new URL('./compiler-worker.mjs', import.meta.url), { type: 'module' });
  const id = `job-${Date.now()}-${++sequence}`;

  return new Promise(resolve => {
    let settled = false;
    let phase = 'toolchain';
    let timer;
    let waitingForInput = false;

    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (interactiveInput && waitingForInput) answerInteractiveInput(interactiveInput, null);
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
      timer = setTimeout(() => finish({
        success: phase === 'run',
        stage: phase,
        timedOut: true,
        stdout: '',
        runtimeFailed: phase === 'run',
      }), ms);
    };

    const requestInput = async () => {
      if (!interactiveInput || !onInputRequest || settled) return;
      waitingForInput = true;
      clearTimeout(timer);
      try {
        const value = await onInputRequest();
        if (settled) return;
        answerInteractiveInput(interactiveInput, value);
      } catch {
        if (!settled) answerInteractiveInput(interactiveInput, null);
      } finally {
        waitingForInput = false;
        if (!settled) armTimeout(runTimeoutMs);
      }
    };

    worker.onmessage = event => {
      if (event.data?.id !== id) return;
      if (event.data.type === 'phase') {
        phase = event.data.phase;
        onPhase(phase, event.data.progress);
        armTimeout(phase === 'run' ? runTimeoutMs : compileTimeoutMs);
        return;
      }
      if (event.data.type === 'stdout') {
        onOutput(String(event.data.chunk ?? ''));
        return;
      }
      if (event.data.type === 'stdin_request') {
        void requestInput();
        return;
      }
      if (event.data.type === 'result') finish(event.data.result);
    };

    worker.onerror = () => finish({ success: false, stage: phase });
    armTimeout(compileTimeoutMs);
    worker.postMessage({
      id,
      project: request,
      input: String(input ?? ''),
      args,
      interactiveInput: interactiveInput?.buffer ?? null,
    });
  });
}
