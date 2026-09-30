import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
globalThis.AsyncLocalStorage = require('node:async_hooks').AsyncLocalStorage;
const ts = require('typescript');
const { NextResponse } = require('next/server');

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'sispat-backup-route-'));
const backupDir = path.join(tempRoot, 'public', 'backup');
const filename = 'auto-backup-codex-test.sql';
const contents = Buffer.from('synthetic backup data;');
let rolesPassedToRoute;

try {
  await mkdir(backupDir, { recursive: true });
  await writeFile(path.join(backupDir, filename), contents);

  const sourcePath = fileURLToPath(
    new URL('../app/api/secure-backup/[name]/route.ts', import.meta.url),
  );
  const compiled = ts.transpile(await readFile(sourcePath, 'utf8'), {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  });
  const routeModule = { exports: {} };
  const fakeAuth = {
    withRole(roles, handler) {
      rolesPassedToRoute = roles;
      return async (request, context) => {
        if (!roles.includes(context?.user?.role)) {
          return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
        }
        return handler(request, context);
      };
    },
  };
  const localRequire = (specifier) =>
    specifier === '@/lib/api-auth' ? fakeAuth : require(specifier);
  const originalCwd = process.cwd;
  process.cwd = () => tempRoot;
  try {
    new Function('require', 'module', 'exports', compiled)(
      localRequire,
      routeModule,
      routeModule.exports,
    );
  } finally {
    process.cwd = originalCwd;
  }

  const get = routeModule.exports.GET;
  assert.deepEqual(rolesPassedToRoute, ['administrador']);

  const forbidden = await get(new Request('https://sispat.example/backup/x'), {
    params: { name: filename },
    user: { role: 'gestor' },
  });
  assert.equal(forbidden.status, 403);

  const traversal = await get(new Request('https://sispat.example/backup/x'), {
    params: { name: '../auto-backup-codex-test.sql' },
    user: { role: 'administrador' },
  });
  assert.equal(traversal.status, 404);

  const response = await get(new Request(`https://sispat.example/backup/${filename}`), {
    params: { name: filename },
    user: { role: 'administrador' },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('content-disposition'), `attachment; filename="${filename}"`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), contents);

  console.log(
    'Secure backup route verification passed: admin-only, traversal rejected, content streamed with no-store.',
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
