# Dev-C++ Web Classroom — v0.4

IDE escolar de C/C++ executado no navegador, sem backend de compilação e sem assistência automática ao aluno.

## Estado da v0.4

- C17 e C++20 através de YoWASP Clang/LLD WebAssembly.
- Projetos multi-ficheiro: `.c`, `.cc`, `.cpp`, `.cxx`, `.h`, `.hpp`.
- Compilação e execução dentro de Web Workers.
- Diagnósticos do compilador não são enviados para a interface.
- Persistência automática em IndexedDB.
- Backups locais (snapshots) com retenção das 8 versões mais recentes.
- Backup automático antes de operações destrutivas importantes.
- Exportação/importação do projeto completo em `.devcpp.json`.
- Exportação/importação de ficheiros individuais.
- Limites de tamanho por ficheiro, projeto, número de ficheiros e output do programa.
- Service Worker + Web App Manifest para cache da aplicação.
- Indicador de estado online/offline.
- CI no GitHub e preview Vercel antes de promoção para produção.

## Contrato pedagógico

A interface não fornece:

- autocomplete;
- autocorreção;
- sugestões;
- lint;
- indicação da linha do erro;
- texto dos diagnósticos de Clang;
- IA.

Em caso de erro de compilação, o aluno vê apenas:

`Compilação falhou.`

## Limites de segurança da v0.4

- Máximo de 50 ficheiros por projeto.
- Máximo de 500 kB por ficheiro.
- Máximo aproximado de 2 MB por projeto.
- Máximo de 1 MB de output capturado por execução.
- Timeout de compilação e de execução.
- Programa executado num Worker separado, que pode ser terminado.

Quando o output excede o limite, o programa continua a receber sucesso nas escritas, mas a interface deixa de acumular conteúdo e apresenta um aviso de truncagem.

## Persistência e recuperação

O projeto atual é guardado em IndexedDB. A aplicação mantém snapshots locais para recuperação rápida.

Operações como criar um projeto novo, eliminar um ficheiro, importar um projeto ou restaurar um backup criam primeiro uma cópia de recuperação quando possível.

Os backups locais pertencem ao navegador/perfil atual. Para transporte entre dispositivos deve usar-se **Exportar projeto**, que gera um ficheiro `.devcpp.json`.

## Execução local e offline

O código do aluno é compilado e executado no navegador.

A aplicação (HTML/CSS/JS) pode ser colocada em cache pelo Service Worker. Contudo, a toolchain YoWASP ainda é descarregada da CDN na primeira utilização. Por isso, **v0.4 não promete compilação offline total num dispositivo que nunca tenha carregado a toolchain**.

A toolchain está fixada em:

`@yowasp/clang@21.1.4-3`

Não existem atualizações automáticas do compilador.

## Desenvolvimento

```bash
npm run dev
npm test
```

Requer Node.js 20 ou superior.

## Limitações conhecidas

- `stdin` é fornecido antes da execução; ainda não existe terminal interativo bloqueante.
- O host WASI é intencionalmente mínimo.
- `fopen()` e filesystem POSIX ainda não estão disponíveis ao programa.
- A sincronização manual com Google Drive continua planeada.
- A primeira carga do compilador pode ser lenta em redes/equipamentos modestos.
