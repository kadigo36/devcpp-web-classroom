import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('1.0 inclui documentação de segurança privacidade e aceitação', async () => {
  const [security, privacy, acceptance, changelog] = await Promise.all([
    read('SECURITY.md'),
    read('PRIVACY.md'),
    read('docs/CLASSROOM_ACCEPTANCE.md'),
    read('CHANGELOG.md'),
  ]);

  assert.match(security, /Web Worker/);
  assert.match(security, /@yowasp\/clang@21\.1\.4-3/);
  assert.match(privacy, /não implementa telemetria/i);
  assert.match(privacy, /Google Drive não está integrado/i);
  assert.match(acceptance, /Compilação falhou/);
  assert.match(acceptance, /autocomplete\/autocorreção/);
  assert.match(changelog, /## 1\.0\.0/);
});

test('1.0 mantém toolchain fixa e interface sem assistência', async () => {
  const [worker, html] = await Promise.all([
    read('src/compiler-worker.mjs'),
    read('index.html'),
  ]);

  assert.match(worker, /@yowasp\/clang@21\.1\.4-3\/gen\/bundle\.js/);
  assert.match(worker, /stderr:\s*null/);
  assert.match(html, /spellcheck="false"/);
  assert.match(html, /autocomplete="off"/);
  assert.doesNotMatch(html, /monaco|codemirror|language-server/i);
});
