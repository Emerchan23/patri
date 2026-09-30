import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
globalThis.AsyncLocalStorage = require('node:async_hooks').AsyncLocalStorage;

const ts = require('typescript');
const { NextRequest } = require('next/server');
const {
  getRewrittenUrl,
  isRewrite,
  unstable_doesMiddlewareMatch,
} = require('next/experimental/testing/server');

const sourcePath = fileURLToPath(new URL('../proxy.ts', import.meta.url));
const source = readFileSync(sourcePath, 'utf8');
const compiled = ts.transpile(source, {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
});
const proxyModule = { exports: {} };
new Function('require', 'module', 'exports', compiled)(
  require,
  proxyModule,
  proxyModule.exports,
);

const { config, proxy } = proxyModule.exports;
const origin = 'https://sispat.example';

assert.equal(
  unstable_doesMiddlewareMatch({
    config,
    url: `${origin}/backup/auto-backup-test.sql`,
  }),
  true,
);
assert.equal(
  unstable_doesMiddlewareMatch({
    config,
    url: `${origin}/backup`,
  }),
  true,
);
assert.equal(
  unstable_doesMiddlewareMatch({
    config,
    url: `${origin}/uploads/foto.png`,
  }),
  false,
);

for (const [path, expected] of [
  ['/backup/auto-backup-test.sql', '/api/secure-backup/auto-backup-test.sql'],
  ['/backup', '/api/secure-backup'],
]) {
  const response = proxy(new NextRequest(`${origin}${path}`));
  assert.equal(isRewrite(response), true, `${path} deve ser reescrito`);
  assert.equal(getRewrittenUrl(response), `${origin}${expected}`);
}

console.log(
  'Backup proxy verification passed: /backup e /backup/* são reescritos para a rota protegida; /uploads permanece fora do matcher.',
);
