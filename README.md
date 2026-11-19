# Dev-C++ Web Classroom — v0.9 RC

Release candidate do IDE escolar C/C++ executado no navegador, sem backend de compilação e sem assistência automática ao aluno.

## Novidades da v0.9

- diagnóstico de compatibilidade do browser;
- distinção entre requisitos essenciais e capacidades opcionais;
- verificação de WebAssembly, Web Workers e IndexedDB;
- verificação de Service Worker, Cache Storage, Web Crypto e contexto HTTPS;
- estimativa de utilização/quota de armazenamento quando disponível;
- indicação de armazenamento persistente quando o browser a fornece;
- gravação best-effort ao ocultar/abandonar a página;
- teste automático de consistência da versão entre package, core, HTML e cache.

## Requisitos essenciais

Para o núcleo do IDE funcionar, a v0.9 exige:

- WebAssembly;
- Web Workers;
- IndexedDB.

Service Worker e Cache Storage são tratados como capacidades opcionais: a ausência deles degrada principalmente o modo offline, não a edição básica.

## Privacidade

O diagnóstico é exclusivamente local. Não existe telemetria de código, projetos, armazenamento ou browser para servidores próprios.

## Funcionalidades preservadas

A v0.9 mantém tudo o que foi validado nas versões anteriores:

- C17 e C++20;
- Clang/LLD WebAssembly;
- stdout progressivo;
- stdin pré-carregado;
- argc/argv;
- filesystem virtual read-only;
- biblioteca multi-projeto;
- renomear e duplicar ficheiros;
- backups e import/export;
- atalhos;
- preparação offline;
- limites de recursos e timeout;
- Worker isolado.

## Contrato pedagógico

Continua sem autocomplete, autocorreção, sugestões, lint, IA ou diagnósticos detalhados de compilação.

## Toolchain

`@yowasp/clang@21.1.4-3`

Versão fixa.

## Desenvolvimento

```bash
npm run dev
npm test
```

Node.js 20+.
