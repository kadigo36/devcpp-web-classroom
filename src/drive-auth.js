import { DRIVE_SCOPE, consumeDriveReturnPath, getDriveOAuthConfig } from './drive.mjs';

const status = document.getElementById('status');
const button = document.getElementById('authorizeDrive');
const cancel = document.getElementById('cancelDrive');

function waitForGoogleIdentity(timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (globalThis.google?.accounts?.oauth2?.initTokenClient) {
        resolve(globalThis.google.accounts.oauth2);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('Google Identity Services não carregou.'));
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  });
}

const returnTo = sessionStorage.getItem('devcpp:drive:return') || '/';

cancel.onclick = () => {
  const target = consumeDriveReturnPath();
  location.replace(target);
};

try {
  const [{ clientId }, oauth2] = await Promise.all([
    getDriveOAuthConfig(),
    waitForGoogleIdentity(),
  ]);

  if (!clientId) {
    status.textContent = 'O Google Drive ainda não está configurado neste deployment.';
    button.disabled = true;
  } else {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      include_granted_scopes: true,
      callback: response => {
        if (response?.error || !response?.access_token) {
          status.textContent = 'A autorização do Google Drive não foi concluída.';
          button.disabled = false;
          return;
        }

        const expiresIn = Number(response.expires_in) || 3600;
        sessionStorage.setItem('devcpp:drive:token', JSON.stringify({
          accessToken: response.access_token,
          expiresAt: Date.now() + expiresIn * 1000,
          scope: response.scope || DRIVE_SCOPE,
        }));

        status.textContent = 'Drive ligado. A voltar ao IDE…';
        location.replace(consumeDriveReturnPath());
      },
      error_callback: () => {
        status.textContent = 'A janela de autorização foi fechada ou bloqueada.';
        button.disabled = false;
      },
    });

    button.disabled = false;
    button.onclick = () => {
      button.disabled = true;
      status.textContent = 'A abrir autorização Google…';
      client.requestAccessToken({ prompt: 'select_account' });
    };
  }
} catch {
  status.textContent = 'Não foi possível iniciar a autorização do Google Drive.';
  button.disabled = true;
}
