# Dev-C++ Web Classroom — v0.8

IDE escolar C/C++ executado no navegador, sem backend de compilação e sem assistência automática ao aluno.

## Novidades da v0.8

A v0.8 melhora o fluxo diário sem acrescentar qualquer sistema de sugestão de código.

- renomear ficheiros;
- duplicar ficheiros;
- deteção de colisões de nomes;
- `stdin` guardado por projeto;
- argumentos `argc/argv` guardados por projeto;
- ao trocar de projeto, o contexto de execução desse projeto é restaurado;
- `Ctrl/Cmd+S`: guardar localmente;
- `Ctrl/Cmd+Enter`: compilar e executar;
- `Esc`: parar a execução;
- indicação visual dos atalhos.

## Gestão local

A biblioteca multi-projeto da v0.7 é preservada. Cada projeto guarda:

- ficheiros-fonte e headers;
- ficheiros de dados;
- ficheiro ativo;
- stdin;
- argumentos de execução;
- snapshots locais.

## Contrato pedagógico

Os atalhos e ações de ficheiro são apenas operações de IDE. Não existe:

- autocomplete;
- autocorreção;
- sugestão de código;
- lint;
- IA;
- diagnóstico detalhado do compilador.

Erros de compilação continuam a apresentar apenas:

`Compilação falhou.`

## Funcionalidades preservadas

- C17/C++20;
- Clang/LLD WebAssembly;
- stdout progressivo;
- filesystem virtual read-only;
- `argc/argv`;
- projetos multi-ficheiro;
- biblioteca de projetos;
- backups;
- export/import;
- preparação offline;
- limites de recursos;
- Worker isolado.

## Toolchain

`@yowasp/clang@21.1.4-3`

Versão fixa, sem atualização automática.

## Desenvolvimento

```bash
npm run dev
npm test
```

Node.js 20+.
