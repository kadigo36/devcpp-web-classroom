# Dev-C++ Web Classroom — PoC v0.2

Prova de conceito de um IDE de C/C++ para sala de aula que compila e executa código **no navegador**, sem backend de compilação e sem executar ficheiros `.exe` no computador.

## Estado atual

- Editor C/C++ simples, deliberadamente sem autocomplete, autocorreção ou sugestões.
- Compilação local no navegador com **YoWASP Clang/LLD em WebAssembly**.
- C17 e C++20 na PoC.
- Execução de `program.wasm` através de um host WASI mínimo no próprio Web Worker.
- `stdin` preparado antes da execução, suficiente para validar `scanf` e `cin`.
- `stdout` apresentado na consola.
- Diagnósticos do compilador e `stderr` não são apresentados ao aluno.
- Timeout de execução para impedir ciclos infinitos de bloquear a página.
- Guardado automático do ficheiro atual no `localStorage`.
- Importação/exportação local de `.c`, `.cpp`, `.h` e `.hpp`.

## Importante sobre "local"

A compilação e a execução acontecem integralmente no navegador. Nesta PoC, o pacote do compilador é carregado de uma CDN na primeira utilização e depois pode beneficiar da cache HTTP do navegador. A próxima etapa para funcionamento offline determinístico é **vendorizar** os artefactos YoWASP no próprio projeto, eliminando a dependência da CDN.

Nenhum código do aluno é enviado para um servidor de compilação.

## Executar

Requer Node.js 20+ apenas para servir os ficheiros durante o desenvolvimento:

```bash
npm run dev
```

Abrir:

```text
http://localhost:4173
```

## Testes locais

```bash
npm test
```

Os testes locais verificam a lógica e o contrato da integração. A compilação real C/C++ necessita de um navegador com acesso inicial à CDN do YoWASP.

### Testes manuais da PoC

1. `examples/hello.c` — `printf`.
2. `examples/input.c` com stdin `21` — `scanf`, resultado esperado `Dobro: 42`.
3. `examples/hello.cpp` — `std::cout`.
4. `examples/input.cpp` com stdin `21` — `std::cin`, resultado esperado `Dobro: 42`.
5. Introduzir um erro de sintaxe — a UI deve mostrar apenas `Compilação falhou.`.
6. Executar `while(1){}` — a execução deve ser interrompida após o timeout.

## Limitações atuais

- `stdin` ainda não é interativo durante a execução; é fornecido antes de carregar em **Compilar e executar**.
- Não há sistema de ficheiros POSIX disponível ao programa; `fopen()` e APIs de SO não fazem parte da PoC.
- A biblioteca C/C++ e o comportamento WASI não são equivalentes ao Windows/MinGW do Dev-C++.
- C++ exceptions podem ter limitações na toolchain WASI.
- Google Drive/OAuth ainda não está integrado; continua planeado como sincronização manual por aluno.

## Segurança pedagógica

A aplicação não mostra:

- linha do erro;
- texto do diagnóstico do compilador;
- causa do erro;
- sugestões de correção;
- autocomplete;
- IA;
- autocorreção.

O compilador continua a gerar diagnósticos internamente, mas estes são descartados no Worker antes de qualquer resultado chegar à interface.
