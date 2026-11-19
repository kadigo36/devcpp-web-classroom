import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('v1.0.2 mantém versão consistente nos artefactos principais', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const core = await readFile(new URL('../src/core.mjs', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.equal(pkg.version, '1.0.2');
  assert.match(core, /APP_VERSION = '1\.0\.2'/);
  assert.match(html, /v1\.0\.2/);
  assert.match(sw, /devcpp-web-classroom-v1\.0\.2/);
});
