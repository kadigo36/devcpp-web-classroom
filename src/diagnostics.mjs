export function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) return 'desconhecido';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = value;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export async function diagnoseEnvironment(scope = globalThis) {
  const nav = scope.navigator;
  const checks = [
    { id: 'wasm', label: 'WebAssembly', required: true, ok: typeof scope.WebAssembly === 'object' },
    { id: 'worker', label: 'Web Worker', required: true, ok: typeof scope.Worker === 'function' },
    { id: 'indexeddb', label: 'IndexedDB', required: true, ok: typeof scope.indexedDB === 'object' },
    { id: 'serviceworker', label: 'Service Worker', required: false, ok: !!nav?.serviceWorker },
    { id: 'cache', label: 'Cache Storage', required: false, ok: typeof scope.caches === 'object' },
    { id: 'crypto', label: 'Web Crypto', required: false, ok: !!scope.crypto?.getRandomValues },
    { id: 'secure', label: 'Contexto seguro (HTTPS)', required: false, ok: scope.isSecureContext === true },
  ];

  let persisted = null;
  let storage = null;

  try {
    if (nav?.storage?.persisted) persisted = await nav.storage.persisted();
  } catch {}

  try {
    if (nav?.storage?.estimate) storage = await nav.storage.estimate();
  } catch {}

  const requiredOk = checks.filter(check => check.required).every(check => check.ok);
  const optionalMissing = checks.filter(check => !check.required && !check.ok).map(check => check.label);

  return {
    requiredOk,
    checks,
    optionalMissing,
    persisted,
    storage: storage ? {
      usage: Number(storage.usage) || 0,
      quota: Number(storage.quota) || 0,
    } : null,
    online: nav?.onLine !== false,
  };
}

export function formatDiagnostics(report) {
  const lines = [];
  lines.push(report.requiredOk ? 'Ambiente compatível com o núcleo do IDE.' : 'Ambiente incompatível com requisitos essenciais.');
  lines.push('');

  for (const check of report.checks) {
    const type = check.required ? 'essencial' : 'opcional';
    lines.push(`${check.ok ? 'OK' : 'FALTA'} · ${check.label} (${type})`);
  }

  lines.push('');
  lines.push(`Rede: ${report.online ? 'online' : 'offline'}`);

  if (report.storage) {
    lines.push(`Armazenamento utilizado: ${formatBytes(report.storage.usage)} / ${formatBytes(report.storage.quota)}`);
  }

  if (report.persisted === true) lines.push('Persistência: armazenamento persistente concedido.');
  else if (report.persisted === false) lines.push('Persistência: não garantida pelo browser.');
  else lines.push('Persistência: não foi possível determinar.');

  if (report.optionalMissing.length) {
    lines.push('');
    lines.push('Funcionalidades degradadas: ' + report.optionalMissing.join(', ') + '.');
  }

  return lines.join('\n');
}
