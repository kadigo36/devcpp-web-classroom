# Privacidade — Dev-C++ Web Classroom 1.1

## Dados locais

Código, projetos, ficheiros de dados, stdin, argumentos e backups são guardados localmente no navegador através de IndexedDB/armazenamento web.

A aplicação não possui backend próprio para receber ou compilar código.

## Google Drive opcional

Na v1.1 o utilizador pode ligar explicitamente uma conta Google para sincronizar projetos.

A aplicação pede apenas o scope `https://www.googleapis.com/auth/drive.file`.

O token de acesso:

- é obtido através do Google Identity Services;
- fica apenas em `sessionStorage`;
- expira automaticamente;
- não é gravado no projeto;
- não é enviado ao Worker C/C++;
- não é enviado para um backend próprio.

Os projetos sincronizados são enviados diretamente do navegador para a Google Drive API.

## Endpoint de configuração

`/api/drive-config` devolve apenas o OAuth Client ID público configurado no Vercel. Não recebe código-fonte nem tokens.

## Telemetria

A aplicação não implementa telemetria própria de código-fonte, projetos, resultados de execução ou erros de compilação.

## Serviços externos

A aplicação pode contactar Vercel, jsDelivr, Google Identity Services e Google Drive API.

## Offline

A compilação pode continuar offline depois da preparação quando os recursos necessários permanecem em cache. A sincronização Google Drive requer Internet.
