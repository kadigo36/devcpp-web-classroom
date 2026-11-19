import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addFile,
  compilerLanguage,
  createProject,
  normalizeProject,
  publicCompileStatus,
  removeFile,
  sourceFiles,
  validateFilename,
} from '../src/core.mjs';
import { stopActiveCompilation } from '../src/compiler.mjs';

test('cria projeto C válido', () => {
  const project = createProject();
  assert.equal(project.activeFile, 'main.c');
  assert.equal(compilerLanguage(project), 'c');
  assert.deepEqual(sourceFiles(project), ['main.c']);
});

test('adiciona C++ e seleciona clang++ para ligação', () => {
  let project = createProject();
  project = addFile(project, 'helper.cpp', 'int helper(){return 1;}');
  assert.equal(project.activeFile, 'helper.cpp');
  assert.equal(compilerLanguage(project), 'cpp');
  assert.deepEqual(sourceFiles(project).sort(), ['helper.cpp', 'main.c']);
});

test('headers pertencem ao projeto mas não são compilados diretamente', () => {
  let project = createProject();
  project = addFile(project, 'calc.h', 'int soma(int,int);');
  assert.equal(project.files['calc.h'], 'int soma(int,int);');
  assert.deepEqual(sourceFiles(project), ['main.c']);
});

test('nomes de ficheiro são restritos', () => {
  assert.equal(validateFilename('main.c'), true);
  assert.equal(validateFilename('foo.hpp'), true);
  assert.equal(validateFilename('../secret.c'), false);
  assert.equal(validateFilename('test.exe'), false);
});

test('remove ficheiro sem deixar projeto vazio', () => {
  let project = addFile(createProject(), 'helper.c', '');
  project = removeFile(project, 'helper.c');
  assert.equal(project.activeFile, 'main.c');
  assert.throws(() => removeFile(project, 'main.c'));
});

test('migra formato v0.2 para projeto v0.3', () => {
  const project = normalizeProject({ name: 'old.cpp', source: 'int main(){}' });
  assert.equal(project.activeFile, 'old.cpp');
  assert.equal(project.files['old.cpp'], 'int main(){}');
});

test('estado público nunca inclui diagnóstico', () => {
  const result = { success: false, stderr: 'main.c:4:3: error: expected ;' };
  assert.equal(publicCompileStatus(result), 'Compilação falhou.');
  assert.doesNotMatch(publicCompileStatus(result), /main\.c|expected|error/);
});

test('parar sem execução ativa é seguro', () => {
  assert.equal(stopActiveCompilation(), false);
});
