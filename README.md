# Dev-C++ Web Classroom — v0.6

IDE escolar de C/C++ executado no navegador, sem backend de compilação e sem assistência automática ao aluno.

## Novidades da v0.6

- Cache dedicada para a toolchain fixa `@yowasp/clang@21.1.4-3`.
- Botão **Preparar offline**.
- Autoteste real de C e C++ durante a preparação.
- O estado só é marcado como concluído se os dois programas de diagnóstico compilarem e executarem.
- Pedido opcional de armazenamento persistente através da API do browser.
- Mantém stdout progressivo, `argc/argv`, filesystem virtual read-only, backups e limites das versões anteriores.

## Preparação offline

A primeira preparação requer Internet.

Ao carregar em **Preparar offline**, a aplicação:

1. aguarda que o Service Worker esteja ativo;
2. tenta solicitar armazenamento persistente ao browser;
3. compila e executa um programa C mínimo;
4. compila e executa um programa C++ com componentes da biblioteca standard;
5. guarda em cache os recursos da toolchain que forem pedidos durante o processo;
6. só apresenta sucesso se C e C++ passarem.

O Service Worker interceta os pedidos feitos para a versão **fixa** da toolchain no jsDelivr e guarda as respostas numa cache separada.

## Limitação importante

A v0.6 melhora muito o cenário offline, mas não promete que todos os browsers mantenham a cache indefinidamente.

Sem armazenamento persistente, o browser pode eliminar dados em situações de pressão de armazenamento. O pedido de persistência pode ser aceite ou recusado de acordo com as regras do próprio browser.

Também não é possível compilar offline num dispositivo que nunca tenha feito a preparação inicial.

## Runtime

A v0.6 preserva:

- C17 e C++20;
- stdout progressivo;
- stdin preparado antes da execução;
- argumentos `argc/argv`;
- ficheiros virtuais `.txt`, `.dat` e `.csv`;
- `fopen(..., "r")`, leitura e seek;
- bloqueio de escrita e path traversal;
- timeout;
- limite de output;
- execução em Web Worker.

## Contrato pedagógico

Continua sem:

- autocomplete;
- autocorreção;
- sugestões;
- lint;
- indicação da linha do erro;
- diagnósticos detalhados de Clang;
- IA.

Erros de compilação continuam visíveis apenas como:

`Compilação falhou.`

## Segurança da cadeia de fornecimento

A aplicação não usa uma versão flutuante da toolchain.

```text
@yowasp/clang@21.1.4-3
```

A cache da v0.6 só trata pedidos cujo URL corresponde a essa versão fixa. Alterar a versão do compilador continua a exigir uma alteração explícita no código e nova validação.

## Desenvolvimento

```bash
npm run dev
npm test
```

Node.js 20+.
