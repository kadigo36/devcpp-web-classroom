# Dev-C++ Web Classroom — 1.0.1

Primeira versão estável do IDE escolar C/C++ executado no navegador.

**Produção:** https://devcpp-web-classroom.vercel.app

## Objetivo

Disponibilizar um ambiente de programação para aulas de C e C++ que não dependa de executáveis Windows nem de um servidor de compilação e que preserve um modo pedagógico estrito: o aluno escreve, compila e corrige o próprio código sem assistência automática.

## Funcionalidades da 1.0

- C17 e C++20;
- Clang/LLD WebAssembly executado no browser;
- compilação em Web Worker;
- execução WASI isolada e terminável;
- projetos multi-ficheiro;
- biblioteca local de vários projetos;
- ficheiros C/C++, headers e ficheiros de dados;
- stdout progressivo;
- stdin pré-carregado e entrada interativa para `scanf`/`std::cin`;
- `argc/argv`;
- filesystem virtual read-only;
- `fopen(..., "r")` para dados do projeto;
- backups locais e snapshots;
- exportação/importação `.devcpp.json`;
- renomear e duplicar ficheiros;
- persistência de stdin/argv por projeto;
- preparação offline da toolchain fixa;
- diagnóstico local de compatibilidade;
- atalhos de teclado;
- limites de recursos e timeout;
- PWA/Service Worker;
- CI e preview obrigatórios antes de produção.

## Contrato pedagógico

A 1.0 não fornece:

- autocomplete;
- autocorreção;
- sugestões de código;
- lint pedagógico;
- indicação da linha do erro;
- texto dos diagnósticos do compilador;
- IA.

Quando a compilação falha, a interface mostra apenas:

`Compilação falhou.`

## Segurança

O código do aluno executa num Web Worker e não recebe acesso direto ao DOM, tokens, Google Drive, filesystem real ou rede através do runtime WASI.

A toolchain está fixada em:

`@yowasp/clang@21.1.4-3`

Não existem atualizações automáticas do compilador.

Consultar [SECURITY.md](SECURITY.md).

## Privacidade

Os projetos são armazenados localmente no browser. A aplicação não possui backend próprio de compilação nem telemetria de código.

Consultar [PRIVACY.md](PRIVACY.md).

## Offline

O botão **Preparar offline** aquece C e C++, coloca os recursos pedidos da toolchain fixa em cache e tenta solicitar armazenamento persistente.

A primeira preparação requer Internet e o browser continua a poder gerir/evictar armazenamento segundo as suas próprias políticas.

## Limitações conhecidas da 1.0

- a entrada interativa requer `SharedArrayBuffer` e isolamento cross-origin; em browsers incompatíveis continua disponível o stdin pré-carregado;
- o filesystem WASI é deliberadamente read-only;
- a toolchain inicial é pesada e pode demorar em equipamento modesto;
- Google Drive não está integrado nesta release estável. A sincronização manual continua prevista como integração opcional posterior e exige credenciais OAuth aprovadas para o domínio da aplicação.

## Validação de sala de aula

Consultar [docs/CLASSROOM_ACCEPTANCE.md](docs/CLASSROOM_ACCEPTANCE.md).

## Desenvolvimento

```bash
npm run dev
npm test
```

Node.js 20+.

## Histórico

Consultar [CHANGELOG.md](CHANGELOG.md).


## Correção 1.0.1 — scanf / std::cin

Quando o programa tenta ler de stdin depois de consumir os dados pré-carregados, a execução fica suspensa dentro do Web Worker e a interface apresenta **Programa à espera de entrada**.

O aluno escreve o valor e carrega Enter. A linha é entregue ao runtime WASI e o programa continua a partir do `scanf` ou `std::cin`.

O mecanismo usa `SharedArrayBuffer + Atomics` e exige isolamento cross-origin. Em produção, o Vercel envia COOP/COEP para disponibilizar esta capacidade.
