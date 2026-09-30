import assert from "node:assert/strict"
import fs from "node:fs"
import ts from "typescript"

const source = fs.readFileSync("lib/location-match.ts", "utf8")
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const module = { exports: {} }
new Function("module", "exports", compiled)(module, module.exports)

const { sameLocation, findCanonicalLocation } = module.exports
assert.equal(
  sameLocation(
    { secretaria: " Fundo Municipal de Saúde ", departamento: "CENTRO   - Especialidade", sala: "Sala 01" },
    { secretaria: "fundo municipal de saúde", departamento: "Centro - Especialidade", sala: " sala   01 " },
  ),
  true,
)
assert.equal(
  sameLocation(
    { secretaria: "Secretaria A", departamento: "Departamento A", sala: "Sala 01" },
    { secretaria: "Secretaria A", departamento: "Departamento A", sala: "Sala 02" },
  ),
  false,
)
assert.equal(
  sameLocation(
    { secretaria: null, departamento: null, sala: null },
    { secretaria: "Secretaria A", departamento: "Departamento A", sala: "Sala 01" },
  ),
  false,
)
const canonicalRows = [
  { secretaria: "Fundo Municipal de Saúde", departamento: "Centro - Especialidade", sala: "Sala 01" },
]
let querySql = ""
let queryParams = []
const canonical = await findCanonicalLocation(
  {
    execute: async (sql, params) => {
      querySql = sql
      queryParams = params
      return [canonicalRows, []]
    },
  },
  { secretaria: "fundo municipal de saúde", departamento: "Centro - Especialidade", sala: "Sala 01" },
)
assert.deepEqual(canonical, canonicalRows[0])
assert.match(querySql, /JOIN departamentos d ON d\.id = s\.departamento_id/)
assert.match(querySql, /JOIN secretarias sec ON sec\.id = d\.secretaria_id/)
assert.match(querySql, /FOR UPDATE/)
assert.deepEqual(queryParams, ["fundo municipal de saúde", "Centro - Especialidade", "Sala 01"])
assert.equal(
  await findCanonicalLocation(
    { execute: async () => [[...canonicalRows, ...canonicalRows], []] },
    canonicalRows[0],
  ),
  null,
)
console.log("Location match verification passed: case/whitespace variants are treated as the same destination.")
