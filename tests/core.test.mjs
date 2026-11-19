import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_FILE_BYTES,
  MAX_PROGRAM_ARGS,
  MAX_PROJECT_FILES,
  addFile,
  cloneProjectAsNew,
  compilerLanguage,
  createProject,
  exportProjectPackage,
  importProjectPackage,
  normalizeProject,
  programArgsFromLines,
  publicCompileStatus,
  removeFile,
  renameProject,
  runtimeFiles,
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

test('ficheiros de dados vão apenas para o runtime', () => {
  let project = createProject();
  project = addFile(project, 'dados.txt', '10\n20\n');
  project = addFile(project, 'tabela.csv', 'a,b\n1,2\n');
  assert.deepEqual(sourceFiles(project), ['main.c']);
  assert.deepEqual(runtimeFiles(project), {
    'dados.txt': '10\n20\n',
    'tabela.csv': 'a,b\n1,2\n',
  });
});

test('headers pertencem ao projeto mas não são compilados diretamente', () => {
  let project = createProject();
  project = addFile(project, 'calc.h', 'int soma(int,int);');
  assert.equal(project.files['calc.h'], 'int soma(int,int);');
  assert.deepEqual(sourceFiles(project), ['main.c']);
});

test('nomes de ficheiro são restritos mas aceitam dados seguros', () => {
  assert.equal(validateFilename('main.c'), true);
  assert.equal(validateFilename('foo.hpp'), true);
  assert.equal(validateFilename('dados.txt'), true);
  assert.equal(validateFilename('tabela.csv'), true);
  assert.equal(validateFilename('../secret.c'), false);
  assert.equal(validateFilename('test.exe'), false);
});

test('remove ficheiro sem deixar projeto vazio', () => {
  let project = addFile(createProject(), 'helper.c', '');
  project = removeFile(project, 'helper.c');
  assert.equal(project.activeFile, 'main.c');
  assert.throws(() => removeFile(project, 'main.c'));
});

test('migra formato v0.2', () => {
  const project = normalizeProject({ name: 'old.cpp', source: 'int main(){}' });
  assert.equal(project.activeFile, 'old.cpp');
  assert.equal(project.files['old.cpp'], 'int main(){}');
});

test('export/import de projeto preserva ficheiros', () => {
  let project = addFile(createProject(), 'calc.h', 'int soma(int,int);');
  project = addFile(project, 'dados.dat', '42');
  const restored = importProjectPackage(exportProjectPackage(project));
  assert.deepEqual(restored.files, project.files);
  assert.equal(restored.activeFile, project.activeFile);
});

test('argumentos são definidos um por linha e limitados', () => {
  assert.deepEqual(programArgsFromLines('um\ndois três\n'), ['um', 'dois três']);
  assert.deepEqual(programArgsFromLines(''), []);
  assert.throws(() => programArgsFromLines(Array(MAX_PROGRAM_ARGS + 2).join('x\n')));
});

test('rejeita formato de pacote desconhecido', () => {
  assert.throws(() => importProjectPackage('{"format":"outro","formatVersion":1,"project":{}}'));
});

test('aplica limites de tamanho e quantidade', () => {
  assert.throws(() => normalizeProject({
    id: 'default', name: 'x', activeFile: 'big.c',
    files: { 'big.c': 'x'.repeat(MAX_FILE_BYTES + 1) },
  }));

  let project = createProject();
  for (let i = 1; i < MAX_PROJECT_FILES; i++) {
    project = addFile(project, `f${i}.h`, '');
  }
  assert.equal(Object.keys(project.files).length, MAX_PROJECT_FILES);
  assert.throws(() => addFile(project, 'extra.h', ''));
});

test('estado público nunca inclui diagnóstico', () => {
  const result = { success: false, stderr: 'main.c:4:3: error: expected ;' };
  assert.equal(publicCompileStatus(result), 'Compilação falhou.');
  assert.doesNotMatch(publicCompileStatus(result), /main\.c|expected|error/);
});

test('parar sem execução ativa é seguro', () => {
  assert.equal(stopActiveCompilation(), false);
});


test('v0.7 cria projetos independentes com ids distintos', () => {
  const a = createProject('A');
  const b = createProject('B');
  assert.notEqual(a.id, b.id);
  assert.equal(a.name, 'A');
  assert.equal(b.name, 'B');
});

test('normalização preserva id válido do projeto', () => {
  const p = normalizeProject({
    id: 'projeto_123',
    name: 'Teste',
    activeFile: 'main.c',
    files: { 'main.c': 'int main(void){return 0;}' },
    updatedAt: 1,
  });
  assert.equal(p.id, 'projeto_123');
});

test('clonar projeto cria novo id sem alterar os ficheiros', () => {
  const original = addFile(createProject('Original'), 'dados.txt', '42');
  const clone = cloneProjectAsNew(original, 'Cópia');
  assert.notEqual(clone.id, original.id);
  assert.equal(clone.name, 'Cópia');
  assert.deepEqual(clone.files, original.files);
});

test('renomear projeto valida nomes vazios', () => {
  const project = createProject('Antes');
  assert.equal(renameProject(project, 'Depois').name, 'Depois');
  assert.throws(() => renameProject(project, '   '));
});
