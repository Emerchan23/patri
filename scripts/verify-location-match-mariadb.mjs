import assert from "node:assert/strict"
import fs from "node:fs"
import ts from "typescript"
import mysql from "mysql2/promise"

const port = Number(process.argv[2])
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("Informe a porta local do MariaDB descartável.")
}

const source = fs.readFileSync("lib/location-match.ts", "utf8")
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const helperModule = { exports: {} }
new Function("module", "exports", compiled)(helperModule, helperModule.exports)

const connection = await mysql.createConnection({
  host: "127.0.0.1",
  port,
  user: "root",
  database: "location_test",
})

try {
  await connection.execute("CREATE TABLE secretarias (id INT PRIMARY KEY, nome VARCHAR(200) NOT NULL UNIQUE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci")
  await connection.execute("CREATE TABLE departamentos (id INT PRIMARY KEY, secretaria_id INT NOT NULL, nome VARCHAR(200) NOT NULL, FOREIGN KEY (secretaria_id) REFERENCES secretarias(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci")
  await connection.execute("CREATE TABLE salas (id INT PRIMARY KEY, departamento_id INT NOT NULL, nome VARCHAR(200) NOT NULL, FOREIGN KEY (departamento_id) REFERENCES departamentos(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci")
  await connection.execute("INSERT INTO secretarias VALUES (1, 'Fundo Municipal de Saúde')")
  await connection.execute("INSERT INTO departamentos VALUES (1, 1, 'Centro - Especialidade')")
  await connection.execute("INSERT INTO salas VALUES (1, 1, 'Sala 01'), (2, 1, 'Ambígua'), (3, 1, 'Ambígua')")

  await connection.beginTransaction()
  const canonical = await helperModule.exports.findCanonicalLocation(connection, {
    secretaria: "fundo municipal de saúde",
    departamento: "centro - especialidade",
    sala: "sala 01",
  })
  assert.deepEqual(canonical, {
    secretaria: "Fundo Municipal de Saúde",
    departamento: "Centro - Especialidade",
    sala: "Sala 01",
  })
  assert.equal(
    await helperModule.exports.findCanonicalLocation(connection, {
      secretaria: "Fundo Municipal de Saúde",
      departamento: "Centro - Especialidade",
      sala: "Sala que não existe",
    }),
    null,
  )
  assert.equal(
    await helperModule.exports.findCanonicalLocation(connection, {
      secretaria: "Fundo Municipal de Saúde",
      departamento: "Centro - Especialidade",
      sala: "Ambígua",
    }),
    null,
  )
  await connection.rollback()
  console.log("MariaDB location verification passed: canonical names returned; missing/ambiguous destinations rejected.")
} finally {
  await connection.end()
}
