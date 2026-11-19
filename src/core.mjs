export const STORAGE_KEY = 'devcpp-classroom:poc:v1';
export const DEFAULT_C = '#include <stdio.h>\n\nint main(void) {\n    printf("Ola, mundo!\\n");\n    return 0;\n}\n';
export function languageFromName(name) {
  if (/\.c$/i.test(name)) return 'c';
  if (/\.(cpp|cc|cxx)$/i.test(name)) return 'cpp';
  throw new Error('Extensão não suportada para compilação');
}
export function validateFilename(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9_ .-]+\.(c|cpp|h|hpp)$/i.test(name) && name.length <= 100;
}
export function publicCompileStatus(result) {
  return result?.success === true ? 'Compilação concluída.' : 'Compilação falhou.';
}
export function makeProject(name, source) {
  if (!validateFilename(name) || typeof source !== 'string' || source.length > 500_000) throw new Error('Ficheiro inválido');
  return {name,source};
}
