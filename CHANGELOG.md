# Changelog

## 1.0.1

- corrige `scanf()` e `std::cin` para pedir entrada durante a execução;
- usa `SharedArrayBuffer + Atomics` dentro do Web Worker para suspender e retomar stdin;
- adiciona controlo de entrada interativa na consola;
- pausa o timeout enquanto o programa espera pelo utilizador;
- ativa COOP/COEP no Vercel para isolamento cross-origin;
- mantém fallback para stdin pré-carregado em browsers incompatíveis.


## 1.0.0

Primeira release estável.

- freeze do núcleo validado na v0.9 RC;
- documentação de segurança e privacidade;
- checklist formal de aceitação em sala de aula;
- testes de consistência de release;
- toolchain permanece fixa em YoWASP Clang 21.1.4-3.

## 0.9.0

- diagnóstico de compatibilidade do browser;
- quota/persistência de armazenamento;
- persistência best-effort no ciclo de vida;
- testes de consistência de versão.

## 0.8.0

- renomear e duplicar ficheiros;
- stdin/argv persistentes por projeto;
- atalhos de guardar, executar e parar.

## 0.7.0

- biblioteca local multi-projeto;
- IDs independentes;
- criar, renomear, alternar e eliminar projetos;
- importação como novo projeto;
- snapshots por projeto.

## 0.6.0

- preparação offline;
- cache dedicada da toolchain fixa;
- autoteste C e C++;
- pedido de armazenamento persistente.

## 0.5.0

- stdout progressivo;
- argc/argv;
- filesystem virtual read-only;
- fopen/leitura/seek sobre ficheiros de dados.

## 0.4.0

- backups/snapshots;
- export/import de projetos;
- limites de recursos e output.

## 0.3.0

- API oficial runClang;
- projetos multi-ficheiro;
- IndexedDB;
- PWA;
- CI GitHub.

## 0.2.0

- primeira integração da prova de conceito C/C++ WebAssembly.
