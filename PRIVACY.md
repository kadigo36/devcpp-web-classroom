# Privacidade — Dev-C++ Web Classroom 1.0

## Dados do aluno

O código, projetos, ficheiros de dados, stdin, argumentos e backups são guardados localmente no navegador através de IndexedDB/armazenamento web.

A aplicação não possui backend próprio para receber ou compilar código.

## Telemetria

A 1.0 não implementa telemetria própria de:

- código-fonte;
- projetos;
- resultados de execução;
- erros de compilação;
- nomes de ficheiros;
- diagnóstico do browser.

O diagnóstico de compatibilidade é calculado localmente.

## Serviços externos

A aplicação é servida pelo Vercel.

A toolchain YoWASP pode ser obtida através do jsDelivr na primeira preparação/carregamento. Como em qualquer pedido web, estes fornecedores podem receber metadados normais de rede, de acordo com as respetivas políticas.

## Offline

Depois da preparação, alguns recursos podem permanecer em Cache Storage. A retenção depende das políticas do browser.

## Google Drive

Google Drive não está integrado na release 1.0. Nenhum token Google é pedido ou armazenado por esta versão.

Uma futura sincronização manual deverá usar OAuth explícito e o menor scope possível.
