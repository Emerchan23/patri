import assert from "node:assert/strict"
import fs from "node:fs"

const source = fs.readFileSync("app/api/solicitacoes-movimentacao/route.ts", "utf8")
const postHandler = source.slice(source.indexOf("export const POST = withAuth"))
const transaction = postHandler.slice(postHandler.indexOf("const result = await withTransaction"))
const destinationCheck = transaction.indexOf("findCanonicalLocation(connection")
const missingDestinationGuard = transaction.indexOf("if (!destination)")
const assetLock = transaction.indexOf("SELECT id, patrimonio, descricao, localizacao_secretaria")
const sameDestinationGuard = transaction.indexOf("sameLocation(")
const requestInsert = transaction.indexOf("INSERT INTO solicitacoes_movimentacao")
const itemInsert = transaction.indexOf("INSERT INTO solicitacoes_movimentacao_itens")

assert.ok(destinationCheck >= 0, "request creation must resolve and lock the destination hierarchy")
assert.ok(missingDestinationGuard > destinationCheck, "missing/ambiguous destination must stop request creation")
assert.ok(assetLock > missingDestinationGuard, "destination validation must happen before locking assets")
assert.ok(sameDestinationGuard > assetLock && sameDestinationGuard < requestInsert, "items already at destination must be rejected before request insertion")
assert.ok(requestInsert > assetLock, "request row must be inserted only after destination and asset validation")
assert.ok(itemInsert > requestInsert, "request items must be inserted after the request row in the same transaction")
assert.match(transaction, /destination\.secretaria,[\s\S]*?destination\.departamento,[\s\S]*?destination\.sala/)

console.log("Movement request guard verification passed: canonical destination and batch checks precede transactional inserts.")
