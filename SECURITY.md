# Segurança — Dev-C++ Web Classroom 1.1

## Modelo de ameaça

O projeto assume código C/C++ não confiável escrito por alunos. A execução ocorre num Web Worker e o programa compilado recebe apenas o subconjunto WASI implementado pela aplicação.

## Isolamento do programa

O programa do aluno não recebe acesso ao DOM, cookies, tokens OAuth, Google Drive API, filesystem real, sockets, rede ou comandos do sistema operativo.

O token Google existe apenas na thread principal da aplicação e em `sessionStorage`.

## Google Drive

A integração usa o scope mínimo `drive.file`. Não são pedidos `drive`, `drive.readonly` nem outros scopes de acesso global.

O OAuth Client ID é público e vem da variável Vercel `GOOGLE_OAUTH_CLIENT_ID`. Não existe Client Secret no frontend.

A página `/drive-auth.html` usa um perfil COOP separado para o popup OAuth. O IDE principal mantém `COOP: same-origin` + `COEP: require-corp` para suportar `SharedArrayBuffer` no stdin interativo.

## Conflitos

Antes de atualizar um projeto já ligado ao Drive, a aplicação compara o `modifiedTime` remoto com o último valor sincronizado. Se o remoto tiver mudado, a aplicação não o sobrescreve sem confirmação explícita.

## Controlo de recursos

Existem limites de compilação, execução, output, tamanho de ficheiros, tamanho de projeto, número de ficheiros e argumentos.

## Toolchain

A toolchain permanece fixa em `@yowasp/clang@21.1.4-3`.

## Dados sensíveis

Não colocar passwords, tokens, chaves API ou outros segredos nos projetos C/C++.
