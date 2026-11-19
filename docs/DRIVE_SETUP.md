# Configurar Google Drive — Dev-C++ Web Classroom 1.1

## 1. Google Cloud

Criar ou escolher um projeto Google Cloud dedicado ao Dev-C++ Web Classroom e ativar a Google Drive API.

## 2. OAuth consent

Configurar o ecrã de consentimento OAuth. Durante testes, adicionar explicitamente as contas Google que vão usar o IDE como test users.

O único scope necessário é `https://www.googleapis.com/auth/drive.file`.

Não adicionar `drive` nem `drive.readonly`.

## 3. OAuth Client

Criar um OAuth 2.0 Client ID do tipo **Web application**.

Authorized JavaScript origins:

- `https://devcpp-web-classroom.vercel.app`
- `http://localhost:4173`

A integração usa o token model do Google Identity Services numa página dedicada. Não é necessário guardar Client Secret no frontend.

## 4. Vercel

Criar a variável `GOOGLE_OAUTH_CLIENT_ID` com o valor do Client ID terminado em `.apps.googleusercontent.com`.

Aplicar a Production e Preview e fazer novo deployment.

## 5. Teste

1. Abrir o IDE.
2. Confirmar que `scanf` interativo continua funcional.
3. Carregar **Ligar Drive**.
4. Na página OAuth, carregar **Continuar com Google**.
5. Autorizar `drive.file`.
6. Voltar ao IDE.
7. Carregar **Guardar projeto no Drive**.
8. Confirmar a pasta `Dev-C++ Web Classroom` no Drive.
9. Alterar o projeto e sincronizar novamente.
10. Abrir o projeto através de **Abrir do Drive**.
11. Confirmar que um conflito remoto não é sobrescrito silenciosamente.

## Segurança

O token é temporário e fica apenas em `sessionStorage`. O Worker C/C++ não recebe acesso ao token nem à Drive API.
