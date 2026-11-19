import test from 'node:test';
import assert from 'node:assert/strict';
import { languageFromName, validateFilename, publicCompileStatus, makeProject } from '../src/core.mjs';
import { stopActiveCompilation } from '../src/compiler.mjs';

test('extensões C e C++', () => {
  assert.equal(languageFromName('main.c'), 'c');
  assert.equal(languageFromName('main.cpp'), 'cpp');
  assert.throws(() => languageFromName('main.exe'));
});

test('nomes seguros', () => {
  assert.equal(validateFilename('main.c'), true);
  assert.equal(validateFilename('../secret.c'), false);
  assert.equal(validateFilename('test.exe'), false);
});

test('ficheiros com limite', () => {
  assert.deepEqual(makeProject('main.cpp', 'int main(){}'), { name: 'main.cpp', source: 'int main(){}' });
  assert.throws(() => makeProject('bad.exe', ''));
});

test('estado público não inclui diagnóstico', () => {
  const result = { success: false, stderr: 'main.c:4:3: error: expected ;' };
  assert.equal(publicCompileStatus(result), 'Compilação falhou.');
  assert.doesNotMatch(publicCompileStatus(result), /main\.c|expected|error/);
});

test('parar sem execução ativa é operação segura', () => {
  assert.equal(stopActiveCompilation(), false);
});
