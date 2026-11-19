import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TinyWasi } from '../src/wasi-host.mjs';

const worker = await readFile(new URL('../src/compiler-worker.mjs', import.meta.url), 'utf8');
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

test('interface mantém ausência de assistência', () => {
  assert.match(html, /spellcheck="false"/);
  assert.match(html, /autocomplete="off"/);
  assert.doesNotMatch(html, /monaco|codemirror|language-server|suggestion|correção do erro/i);
});

test('v0.3 usa IndexedDB e service worker', () => {
  assert.match(storage, /indexedDB\.open/);
  assert.match(sw, /caches\.open/);
  assert.match(html, /manifest\.webmanifest/);
});

test('TinyWasi implementa stdin e stdout em memória', () => {
  const wasi = new TinyWasi({ input: '21\n' });
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
});
