# Dev-C++ Web Classroom — v0.5

IDE escolar de C/C++ executado no navegador, sem backend de compilação e sem assistência automática ao aluno.

## Novidades da v0.5

- **stdout progressivo**: `printf` e `cout` podem aparecer na consola enquanto o programa está a executar.
- **Argumentos de programa (`argc/argv`)**: um argumento por linha na interface.
- **Filesystem virtual read-only** para ficheiros `.txt`, `.dat` e `.csv`.
- Suporte inicial a `fopen(..., "r")`, `fread`/`fscanf`, `fseek` e `fclose` sobre ficheiros do projeto.
- O programa continua sem acesso ao disco real, rede, Google Drive ou sistema operativo.
- Proteção contra path traversal (`../`) e operações de escrita no filesystem virtual.
- Mantém backups locais, export/import de projeto, limites de recursos e PWA da v0.4.

## Modelo de execução

```text
Código C/C++
   ↓
YoWASP Clang/LLD (WebAssembly)
   ↓
program.wasm
   ↓
Worker isolado
   ↓
TinyWasi
   ├─ stdin pré-carregado
   ├─ stdout progressivo
   ├─ argc/argv
   └─ ficheiros virtuais read-only
```

## Ficheiros de dados

Ficheiros com extensões:

- `.txt`
- `.dat`
- `.csv`

podem fazer parte do projeto e ficam disponíveis ao programa durante a execução.

Exemplo:

```c
FILE *f = fopen("dados.txt", "r");
```

O ficheiro existe apenas no filesystem virtual do programa. Não existe acesso ao disco do computador.

## Argumentos

A interface apresenta **Argumentos do programa**, com um argumento por linha.

Por exemplo:

```text
teste
42
nome com espaços
```

é exposto como `argv[1]`, `argv[2]` e `argv[3]`.

## Entrada interativa

A v0.5 **ainda não afirma ter stdin verdadeiramente interativo durante a execução**.

O conteúdo de stdin continua a ser preparado antes de executar. Esta limitação é intencional: não vamos simular um terminal bloqueante e apresentá-lo como funcional antes de existir uma implementação tecnicamente robusta.

## Contrato pedagógico

A aplicação continua sem:

- autocomplete;
- autocorreção;
- sugestões;
- lint;
- mensagens detalhadas do compilador;
- identificação da linha do erro;
- IA.

Um erro de compilação continua a aparecer apenas como:

`Compilação falhou.`

## Segurança

O filesystem virtual é read-only nesta versão.

- sem acesso ao filesystem real;
- sem `../`;
- sem paths absolutos;
- sem criação, remoção ou alteração de ficheiros;
- sem APIs de rede;
- execução em Worker terminável;
- limite de output;
- limites por ficheiro/projeto;
- timeout de compilação e runtime.

## Toolchain

Toolchain fixa:

`@yowasp/clang@21.1.4-3`

Não é atualizada automaticamente.

A compilação e execução são locais no browser, mas a primeira carga da toolchain ainda depende da CDN.

## Exemplos

- `examples/hello.c`
- `examples/hello.cpp`
- `examples/input.c`
- `examples/input.cpp`
- `examples/args.c`
- `examples/fileio.c`
- `examples/dados.txt`

## Desenvolvimento

```bash
npm run dev
npm test
```

Requer Node.js 20+.
