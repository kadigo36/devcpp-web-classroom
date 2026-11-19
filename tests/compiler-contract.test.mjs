import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TinyWasi } from '../src/wasi-host.mjs';

const worker = await readFile(new URL('../src/compiler-worker.mjs', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('worker integra YoWASP Clang/LLD no navegador', () => {
  assert.match(worker, /@yowasp\/clang@21\.1\.4-3\/gen\/bundle\.js/);
  assert.match(worker, /toolchain\.commands\?\.\[compiler\]/);
  assert.match(worker, /program\.wasm/);
});

test('diagnósticos do compilador não são devolvidos à UI', () => {
  assert.match(worker, /diagnosticSink/);
  assert.doesNotMatch(worker, /stderr\s*:\s*run\.stderr|result:\s*\{[^}]*stderr/s, 'o resultado público não deve transportar stderr');
});

test('interface inclui compilação, paragem e stdin sem assistência', () => {
  assert.match(html, /id="compile"/);
  assert.match(html, /id="stop"/);
  assert.match(html, /id="stdin"/);
  assert.match(html, /spellcheck="false"/);
  assert.match(html, /autocomplete="off"/);
});

test('TinyWasi guarda e devolve stdout sem expor stderr automaticamente', () => {
  const wasi = new TinyWasi({ input: '42\n' });
  assert.equal(wasi.text('stdout'), '');
  assert.equal(wasi.text('stderr'), '');
});

test('TinyWasi implementa leitura stdin e escrita stdout em memória', () => {
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
  assert.equal(view.getUint32(40, true), 3);
  assert.equal(wasi.text('stdout'), 'ok\n');
});
