import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const sourcePath = fileURLToPath(new URL('../lib/system-settings.ts', import.meta.url));
const source = readFileSync(sourcePath, 'utf8');
const compiled = ts.transpile(source, {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
});

let tableExists = false;
let columns = [];
let storedRow = null;
const statements = [];
const fakeDb = {
  async query(sql) {
    statements.push(sql);
    if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) {
      return columns.map((COLUMN_NAME) => ({ COLUMN_NAME }));
    }
    return [];
  },
  async queryOne(sql) {
    statements.push(sql);
    if (sql.includes('INFORMATION_SCHEMA.TABLES')) {
      return tableExists ? { tableName: 'system_settings' } : null;
    }
    if (sql.includes('SELECT * FROM system_settings')) return storedRow;
    return null;
  },
};

const moduleObject = { exports: {} };
const localRequire = (specifier) =>
  specifier === './db' ? fakeDb : require(specifier);
new Function('require', 'module', 'exports', compiled)(
  localRequire,
  moduleObject,
  moduleObject.exports,
);

const settingsModule = moduleObject.exports;
const defaults = await settingsModule.getSystemSettings();
assert.equal(defaults.themeColor, 'blue');
assert.equal(defaults.sessionDaysMobile, 30);
assert.equal(statements.some((sql) => /\b(CREATE|ALTER|INSERT|UPDATE|DELETE)\b/i.test(sql)), false);

tableExists = true;
storedRow = {
  theme_color: 'green',
  sidebar_color: 'navy',
  link_extensao_xml: 'https://example.test/xml',
  session_days_web: 5,
  session_days_mobile: 45,
};
const savedSettings = await settingsModule.getSystemSettings();
assert.equal(savedSettings.themeColor, 'green');
assert.equal(savedSettings.sessionDaysMobile, 45);
assert.equal(savedSettings.linkPortalSefaz, 'https://www.fsist.com.br/');

columns = [
  'id',
  'theme_color',
  'sidebar_color',
  'link_extensao_xml',
  'link_portal_sefaz',
  'session_days_web',
  'session_days_mobile',
];
assert.equal(await settingsModule.hasSystemSettingsSchema(), true);
columns = columns.filter((column) => column !== 'link_portal_sefaz');
assert.equal(await settingsModule.hasSystemSettingsSchema(), false);
assert.equal(statements.some((sql) => /\b(CREATE|ALTER|INSERT|UPDATE|DELETE)\b/i.test(sql)), false);

console.log(
  'System settings verification passed: reads return defaults or stored values without DDL/DML; incomplete schemas are detected.',
);
