# Checklist de aceitação — Dev-C++ Web Classroom 1.0

Este documento define testes manuais antes de disponibilizar o IDE numa aula ou equipamento novo.

## Ambiente

- [ ] Abrir a aplicação por HTTPS.
- [ ] Executar **Verificar ambiente**.
- [ ] WebAssembly = OK.
- [ ] Web Worker = OK.
- [ ] IndexedDB = OK.
- [ ] Se necessário, executar **Preparar offline** enquanto existe Internet.

## C

- [ ] Compilar um programa simples com `printf`.
- [ ] Testar variáveis e aritmética.
- [ ] Testar `if/else`.
- [ ] Testar `for` e `while`.
- [ ] Testar arrays e funções.
- [ ] Testar `scanf` com stdin preparado.
- [ ] Testar `scanf` sem stdin pré-carregado e confirmar que aparece **Programa à espera de entrada**.
- [ ] Escrever um valor, carregar Enter e confirmar que o programa continua.
- [ ] Testar dois `scanf` consecutivos e confirmar dois pedidos de entrada.

## C++

- [ ] Compilar `std::cout`.
- [ ] Testar `std::cin` sem stdin pré-carregado e confirmar entrada interativa.
- [ ] Testar `std::string`.
- [ ] Testar `std::vector`.
- [ ] Testar funções e classes básicas usadas pela turma.

## Erros

- [ ] Introduzir erro de sintaxe deliberado.
- [ ] Confirmar que o aluno vê apenas **Compilação falhou.**
- [ ] Confirmar ausência de linha do erro, explicação ou sugestão.
- [ ] Confirmar ausência de autocomplete/autocorreção.

## Isolamento

- [ ] Executar ciclo infinito e confirmar interrupção/timeout.
- [ ] Testar programa com output excessivo e confirmar truncagem.
- [ ] Confirmar que `../ficheiro` não abre no filesystem virtual.
- [ ] Confirmar que operações de escrita em ficheiros virtuais são rejeitadas.

## Ficheiros/projetos

- [ ] Criar vários ficheiros C/C++ no mesmo projeto.
- [ ] Criar um ficheiro `.txt` e lê-lo com `fopen(..., "r")`.
- [ ] Renomear ficheiro.
- [ ] Duplicar ficheiro.
- [ ] Criar dois projetos e alternar entre eles.
- [ ] Exportar um projeto `.devcpp.json`.
- [ ] Importá-lo como novo projeto.
- [ ] Criar e restaurar um backup.

## Persistência

- [ ] Escrever código, fechar/reabrir a aplicação e confirmar recuperação.
- [ ] Confirmar stdin e argumentos do projeto após reabrir.
- [ ] Confirmar que o projeto ativo é recuperado.

## Atalhos

- [ ] Ctrl/Cmd+S guarda.
- [ ] Ctrl/Cmd+Enter compila/executa.
- [ ] Esc interrompe quando aplicável.

## Aprovação

A aplicação só deve ser considerada validada para um equipamento/sala depois dos testes relevantes ao conteúdo da disciplina passarem.
