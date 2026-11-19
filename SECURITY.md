# Segurança — Dev-C++ Web Classroom 1.0

## Modelo de ameaça

O projeto assume código C/C++ não confiável escrito por alunos.

A execução ocorre dentro de um Web Worker e o programa compilado recebe apenas o subconjunto WASI implementado pela aplicação.

## Isolamento

O programa do aluno não recebe, através do runtime:

- acesso ao DOM;
- acesso a cookies;
- tokens OAuth;
- APIs Google;
- filesystem real do dispositivo;
- sockets ou APIs de rede;
- comandos do sistema operativo.

O filesystem virtual da 1.0 é read-only e contém apenas ficheiros de dados do projeto.

## Controlo de recursos

Existem limites para:

- tempo de compilação;
- tempo de execução;
- output acumulado;
- tamanho de ficheiros;
- tamanho do projeto;
- número de ficheiros;
- número/tamanho de argumentos.

O Worker pode ser terminado para interromper execução excessiva ou ciclos infinitos.

## Cadeia de fornecimento

A toolchain está fixada em:

`@yowasp/clang@21.1.4-3`

A aplicação não utiliza uma versão flutuante e não faz upgrades automáticos.

GitHub Actions usadas no CI são fixadas por SHA.

## Diagnósticos do compilador

Clang pode produzir diagnósticos internamente, mas a interface do aluno não os recebe. O contrato público de falha permanece genérico.

## Dados sensíveis

Não colocar palavras-passe, tokens, chaves API ou outros segredos dentro dos projetos C/C++.

## Vulnerabilidades

Se for encontrada uma vulnerabilidade de segurança, não incluir segredos nem dados de alunos num issue público. O problema deve ser comunicado ao proprietário do repositório por um canal privado disponível.
