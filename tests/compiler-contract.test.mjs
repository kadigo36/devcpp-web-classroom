import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TinyWasi } from '../src/wasi-host.mjs';

const worker = await readFile(new URL('../src/compiler-worker.mjs', import.meta.url), 'utf8');
const compiler = await readFile(new URL('../src/compiler.mjs', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const storage = await readFile(new URL('../src/storage.mjs', import.meta.url), 'utf8');
const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

test('worker usa API oficial runClang do YoWASP', () => {
  assert.match(worker, /@yowasp\/clang@21\.1\.4-3\/gen\/bundle\.js/);
  assert.match(worker, /const \{ runClang \}/);
  assert.match(worker, /await runClang\(/);
  assert.match(worker, /program\.wasm/);
  assert.doesNotMatch(worker, /toolchain\.commands/);
});

test('diagnósticos são silenciados antes da UI', () => {
  assert.match(worker, /stdout:\s*null/);
  assert.match(worker, /stderr:\s*null/);
  assert.doesNotMatch(worker, /result:\s*\{[^}]*stderr/s);
});

test('v1.0 mantém stdout incremental e ficheiros runtime', () => {
  assert.match(worker, /type:\s*'stdout'/);
  assert.match(worker, /runtimeFiles/);
  assert.match(compiler, /onOutput/);
  assert.match(compiler, /event\.data\.type === 'stdout'/);
});

test('interface mantém ausência de assistência', () => {
  assert.match(html, /spellcheck="false"/);
  assert.match(html, /autocomplete="off"/);
  assert.match(html, /id="args"/);
  assert.doesNotMatch(html, /monaco|codemirror|language-server|suggestion|correção do erro/i);
});

test('v1.0 mantém IndexedDB, snapshots e service worker', () => {
  assert.match(storage, /indexedDB\.open/);
  assert.match(storage, /createSnapshot/);
  assert.match(storage, /restoreSnapshot/);
  assert.match(sw, /devcpp-web-classroom-v1\.0/);
});

test('TinyWasi implementa stdin e stdout incremental', () => {
  const streamed = [];
  const wasi = new TinyWasi({ input: '21\n', onStdout: chunk => streamed.push(chunk) });
  const memory = new WebAssembly.Memory({ initial: 1 });
  wasi.attach({ exports: { memory } });
  const view = new DataView(memory.buffer);
  const bytes = new Uint8Array(memory.buffer);
  const api = wasi.imports();

  view.setUint32(0, 128, true);
  view.setUint32(4, 16, true);
  assert.equal(api.fd_read(0, 0, 1, 32), 0);
  assert.equal(view.getUint32(32, true), 3);
  assert.equal(new TextDecoder().decode(bytes.slice(128, 131)), '21\n');

  bytes.set(new TextEncoder().encode('ok\n'), 256);
  view.setUint32(8, 256, true);
  view.setUint32(12, 3, true);
  assert.equal(api.fd_write(1, 8, 1, 40), 0);
  assert.equal(wasi.text('stdout'), 'ok\n');
  assert.deepEqual(streamed, ['ok\n']);
});

test('TinyWasi expõe argv ao programa', () => {
  const wasi = new TinyWasi({ args: ['program.wasm', 'alpha', 'beta gamma'] });
  const memory = new WebAssembly.Memory({ initial: 1 });
  wasi.attach({ exports: { memory } });
  const view = new DataView(memory.buffer);
  const bytes = new Uint8Array(memory.buffer);
  const api = wasi.imports();

  assert.equal(api.args_sizes_get(0, 4), 0);
  assert.equal(view.getUint32(0, true), 3);
  assert.equal(api.args_get(16, 128), 0);

  const p1 = view.getUint32(20, true);
  const p2 = view.getUint32(24, true);
  const readCString = ptr => {
    let end = ptr;
    while (bytes[end] !== 0) end++;
    return new TextDecoder().decode(bytes.slice(ptr, end));
  };
  assert.equal(readCString(p1), 'alpha');
  assert.equal(readCString(p2), 'beta gamma');
});

test('TinyWasi abre, lê e faz seek num ficheiro virtual read-only', () => {
  const wasi = new TinyWasi({ files: { 'dados.txt': 'ABCDE' } });
  const memory = new WebAssembly.Memory({ initial: 1 });
  wasi.attach({ exports: { memory } });
  const view = new DataView(memory.buffer);
  const bytes = new Uint8Array(memory.buffer);
  const api = wasi.imports();

  const path = new TextEncoder().encode('dados.txt');
  bytes.set(path, 100);
  assert.equal(api.path_open(3, 0, 100, path.length, 0, 0n, 0n, 0, 80), 0);
  const fd = view.getUint32(80, true);
  assert.ok(fd >= 4);

  view.setUint32(0, 200, true);
  view.setUint32(4, 3, true);
  assert.equal(api.fd_read(fd, 0, 1, 84), 0);
  assert.equal(new TextDecoder().decode(bytes.slice(200, 203)), 'ABC');

  assert.equal(api.fd_seek(fd, 1n, 0, 88), 0);
  view.setUint32(0, 210, true);
  view.setUint32(4, 2, true);
  assert.equal(api.fd_read(fd, 0, 1, 92), 0);
  assert.equal(new TextDecoder().decode(bytes.slice(210, 212)), 'BC');
  assert.equal(api.fd_close(fd), 0);
});

test('filesystem virtual rejeita traversal e escrita', () => {
  const wasi = new TinyWasi({ files: { 'dados.txt': 'x' } });
  const memory = new WebAssembly.Memory({ initial: 1 });
  wasi.attach({ exports: { memory } });
  const bytes = new Uint8Array(memory.buffer);
  const api = wasi.imports();

  const bad = new TextEncoder().encode('../dados.txt');
  bytes.set(bad, 100);
  assert.notEqual(api.path_open(3, 0, 100, bad.length, 0, 0n, 0n, 0, 80), 0);

  const path = new TextEncoder().encode('dados.txt');
  bytes.set(path, 120);
  assert.notEqual(api.path_open(3, 0, 120, path.length, 1, 0n, 0n, 0, 80), 0);
});

test('TinyWasi trunca output excessivo sem bloquear o programa', () => {
  const wasi = new TinyWasi({ maxOutputBytes: 5 });
  const memory = new WebAssembly.Memory({ initial: 1 });
  wasi.attach({ exports: { memory } });
  const view = new DataView(memory.buffer);
  const bytes = new Uint8Array(memory.buffer);
  const api = wasi.imports();

  bytes.set(new TextEncoder().encode('123456789'), 128);
  view.setUint32(0, 128, true);
  view.setUint32(4, 9, true);
  assert.equal(api.fd_write(1, 0, 1, 32), 0);
  assert.equal(view.getUint32(32, true), 9);
  assert.equal(wasi.text('stdout'), '12345');
  assert.equal(wasi.outputTruncated, true);
});


test('v1.0 prepara cache offline apenas para a toolchain fixa', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(html, /id="prepareOffline"/);
  assert.match(sw, /devcpp-toolchain-v21\.1\.4-3/);
  assert.match(sw, /@yowasp\/clang@21\.1\.4-3/);
  assert.match(sw, /TOOLCHAIN_PREFIX/);
  assert.match(sw, /TOOLCHAIN_CACHE/);
  assert.match(main, /navigator\.storage\?\.persist/);
  assert.match(main, /Diagnóstico C/);
  assert.match(main, /Diagnóstico C\+\+/);
  assert.match(main, /!cResult\.success/);
  assert.match(main, /!cppResult\.success/);
});


test('v1.0 expõe biblioteca local multi-projeto', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(html, /id="projectSelect"/);
  assert.match(html, /id="renameProject"/);
  assert.match(html, /id="deleteProject"/);
  assert.match(storage, /ACTIVE_PROJECT_KEY/);
  assert.match(storage, /export async function listProjects/);
  assert.match(storage, /export async function deleteProject/);
  assert.match(main, /cloneProjectAsNew\(importProjectPackage/);
  assert.match(main, /listSnapshots\(project\.id\)/);
});


test('v1.0 expõe ações de ficheiro e atalhos sem assistência', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(html, /id="renameFile"/);
  assert.match(html, /id="duplicateFile"/);
  assert.match(main, /stdin\.addEventListener\('input', scheduleSave\)/);
  assert.match(main, /argsInput\.addEventListener\('input', scheduleSave\)/);
  assert.match(main, /event\.key\.toLowerCase\(\) === 's'/);
  assert.match(main, /event\.key === 'Enter'/);
  assert.match(main, /event\.key === 'Escape'/);
});


test('v1.0 expõe diagnóstico de ambiente e persistência de ciclo de vida', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const diagnostics = await readFile(new URL('../src/diagnostics.mjs', import.meta.url), 'utf8');
  assert.match(html, /id="diagnoseEnvironment"/);
  assert.match(html, /id="compatStatus"/);
  assert.match(diagnostics, /WebAssembly/);
  assert.match(diagnostics, /Web Worker/);
  assert.match(diagnostics, /IndexedDB/);
  assert.match(diagnostics, /storage\.estimate/);
  assert.match(main, /visibilitychange/);
  assert.match(main, /pagehide/);
  assert.match(sw, /\/src\/diagnostics\.mjs/);
});


test('stdin interativo usa SharedArrayBuffer sem expor diagnósticos', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const vercel = await readFile(new URL('../vercel.json', import.meta.url), 'utf8');

  assert.match(compiler, /SharedArrayBuffer/);
  assert.match(compiler, /stdin_request/);
  assert.match(compiler, /onInputRequest/);
  assert.match(worker, /stdin_request/);
  assert.match(main, /runtimeInputPanel/);
  assert.match(main, /requestRuntimeInput/);
  assert.match(html, /Programa à espera de entrada/);
  assert.match(vercel, /Cross-Origin-Opener-Policy/);
  assert.match(vercel, /Cross-Origin-Embedder-Policy/);
  assert.match(vercel, /require-corp/);
  assert.doesNotMatch(worker, /stderr:\s*[^n]/);
});

test('TinyWasi pede nova linha quando stdin pré-carregado termina', () => {
  const controlBytes = 2 * Int32Array.BYTES_PER_ELEMENT;
  const shared = new SharedArrayBuffer(controlBytes + 1024);
  const control = new Int32Array(shared, 0, 2);
  const sharedBytes = new Uint8Array(shared, controlBytes);
  const encoder = new TextEncoder();

  let requests = 0;
  const wasi = new TinyWasi({
    input: '',
    interactiveInput: shared,
    onStdinRequest: () => {
      requests++;
      const encoded = encoder.encode('37\n');
      sharedBytes.set(encoded);
      Atomics.store(control, 1, encoded.length);
      Atomics.store(control, 0, 1);
      Atomics.notify(control, 0, 1);
    },
  });

  const memory = new WebAssembly.Memory({ initial: 1 });
  wasi.attach({ exports: { memory } });
  const view = new DataView(memory.buffer);
  const bytes = new Uint8Array(memory.buffer);
  const api = wasi.imports();

  view.setUint32(0, 128, true);
  view.setUint32(4, 16, true);

  assert.equal(api.fd_read(0, 0, 1, 32), 0);
  assert.equal(requests, 1);
  assert.equal(view.getUint32(32, true), 3);
  assert.equal(new TextDecoder().decode(bytes.slice(128, 131)), '37\n');
});
