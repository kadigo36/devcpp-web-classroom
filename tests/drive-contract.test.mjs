import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('Drive usa apenas scope drive.file', async () => {
  const drive = await read('src/drive.mjs');
  assert.match(drive, /auth\/drive\.file/);
  assert.doesNotMatch(drive, /auth\/drive(?:\.readonly|\.metadata|')/);
});

test('tokens Drive ficam fora do projeto e do Worker', async () => {
  const [drive, core, worker] = await Promise.all([
    read('src/drive.mjs'),
    read('src/core.mjs'),
    read('src/compiler-worker.mjs'),
  ]);
  assert.match(drive, /sessionStorage/);
  assert.match(drive, /Authorization/);
  assert.doesNotMatch(core, /accessToken|Bearer /);
  assert.doesNotMatch(worker, /Google Drive|accessToken|Bearer |googleapis/);
});

test('OAuth bridge usa perfil COOP compatível com popup sem alterar IDE principal', async () => {
  const [vercel, authHtml] = await Promise.all([
    read('vercel.json'),
    read('drive-auth.html'),
  ]);
  assert.match(vercel, /same-origin-allow-popups/);
  assert.match(vercel, /require-corp/);
  assert.match(vercel, /unsafe-none/);
  assert.match(authHtml, /accounts\.google\.com\/gsi\/client/);
  assert.match(authHtml, /drive\.file/);
});

test('config OAuth vem de variável Vercel e não de segredo no frontend', async () => {
  const [api, auth] = await Promise.all([
    read('api/drive-config.js'),
    read('src/drive-auth.js'),
  ]);
  assert.match(api, /GOOGLE_OAUTH_CLIENT_ID/);
  assert.match(api, /no-store/);
  assert.match(auth, /getDriveOAuthConfig/);
  assert.doesNotMatch(auth, /client_secret|GOOGLE_OAUTH_CLIENT_SECRET/);
});

test('sincronização Drive tem conflito explícito e appProperties privadas', async () => {
  const [drive, main] = await Promise.all([
    read('src/drive.mjs'),
    read('src/main.js'),
  ]);
  assert.match(drive, /DriveConflictError/);
  assert.match(drive, /appProperties/);
  assert.match(drive, /modifiedTime/);
  assert.match(main, /substituir explicitamente/);
  assert.match(main, /force: true/);
});

test('service worker não cacheia OAuth nem config dinâmica', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /drive-auth\.html/);
  assert.match(sw, /startsWith\('\/api\/'\)/);
  assert.match(sw, /fetch\(event\.request\)/);
});
