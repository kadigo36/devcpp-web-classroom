# Dev-C++ Web Classroom — 1.1.0

IDE escolar C/C++ executado no navegador, sem backend de compilação e sem assistência automática ao aluno.

**Produção:** https://devcpp-web-classroom.vercel.app

## Novidades da 1.1

A v1.1 adiciona sincronização manual opcional com Google Drive sem alterar o modelo local-first.

- botão **Ligar Drive**;
- pasta individual `Dev-C++ Web Classroom` criada no Drive da conta autorizada;
- **Guardar projeto no Drive**;
- **Abrir do Drive**;
- atualização do mesmo ficheiro remoto nas sincronizações seguintes;
- deteção de conflito através de `modifiedTime`;
- confirmação explícita antes de substituir uma versão remota alterada;
- metadados privados `appProperties` para identificar apenas ficheiros desta aplicação;
- scope OAuth mínimo `https://www.googleapis.com/auth/drive.file`;
- token de acesso guardado apenas em `sessionStorage`;
- página OAuth separada para preservar o `SharedArrayBuffer` usado por `scanf`/`std::cin`.

## Modelo local-first

O projeto continua a ser editado, compilado e executado localmente no browser.

O Google Drive é uma camada de sincronização/backup manual. O runtime C/C++ não recebe tokens, Google APIs nem acesso ao Drive.

## Google Drive

A aplicação cria ou reutiliza uma pasta `Dev-C++ Web Classroom` e guarda projetos como ficheiros `.devcpp.json`.

A integração exige Google Drive API ativa e um OAuth 2.0 Web Client ID. No Vercel, o Client ID é configurado na variável `GOOGLE_OAUTH_CLIENT_ID`.

Consultar `docs/DRIVE_SETUP.md`.

## Funcionalidades principais

- C17 e C++20;
- Clang/LLD WebAssembly;
- compilação e execução em Web Workers;
- `scanf` e `std::cin` interativos;
- stdout progressivo;
- projetos multi-ficheiro;
- biblioteca local multi-projeto;
- ficheiros virtuais read-only;
- `argc/argv`;
- backups e snapshots;
- export/import local;
- preparação offline;
- diagnóstico do browser;
- Google Drive manual opcional;
- CI + preview antes de produção.

## Contrato pedagógico

Continua sem autocomplete, autocorreção, sugestões, lint pedagógico, indicação de linha do erro, diagnósticos detalhados do Clang ou IA.

Falhas de compilação continuam visíveis apenas como `Compilação falhou.`

## Segurança e privacidade

Consultar `SECURITY.md` e `PRIVACY.md`.

## Desenvolvimento

`npm run dev`

`npm test`

Para testar OAuth localmente: `GOOGLE_OAUTH_CLIENT_ID="...apps.googleusercontent.com" npm run dev`.

Node.js 20+.
