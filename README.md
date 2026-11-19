# Dev-C++ Web Classroom — v0.7

IDE escolar C/C++ executado no navegador, sem backend de compilação e sem assistência automática ao aluno.

## Novidades da v0.7

A v0.7 transforma o armazenamento local numa **biblioteca de projetos**.

- vários projetos independentes no mesmo navegador;
- seletor do projeto atual;
- criar projetos com IDs próprios;
- renomear projetos;
- alternar entre projetos sem perder trabalho;
- eliminar apenas o projeto selecionado;
- importação de `.devcpp.json` como **novo projeto**, sem sobrescrever silenciosamente o projeto aberto;
- backups filtrados por projeto;
- migração compatível do antigo projeto `default`.

## Persistência

Cada projeto tem o seu próprio ID e registo em IndexedDB. O ID do último projeto aberto é mantido localmente para a aplicação voltar ao mesmo projeto numa utilização seguinte.

Ao eliminar o último projeto, a aplicação cria automaticamente um projeto vazio novo para evitar deixar o IDE sem workspace válido.

## Funcionalidades preservadas

- C17 e C++20;
- Clang/LLD WebAssembly no navegador;
- projetos multi-ficheiro;
- stdout progressivo;
- stdin preparado antes da execução;
- `argc/argv`;
- filesystem virtual read-only para `.txt`, `.dat` e `.csv`;
- backups e snapshots;
- export/import de projetos;
- limites de recursos e timeout;
- preparação offline da toolchain fixa;
- Web Worker isolado;
- PWA e IndexedDB.

## Contrato pedagógico

Continua sem autocomplete, autocorreção, sugestões, lint, IA ou diagnósticos detalhados de compilação.

Um erro de compilação continua visível apenas como:

`Compilação falhou.`

## Toolchain

`@yowasp/clang@21.1.4-3`

A versão permanece fixa. Não existem upgrades automáticos.

## Desenvolvimento

```bash
npm run dev
npm test
```

Node.js 20+.
