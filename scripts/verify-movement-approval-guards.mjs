import assert from "node:assert/strict"
import fs from "node:fs"

const source = fs.readFileSync("app/api/solicitacoes-movimentacao/[id]/route.ts", "utf8")
const inTransaction = source.slice(source.indexOf("const outcome = await withTransaction"))
const destinationCheck = inTransaction.indexOf("approvalDestination = await findCanonicalLocation(connection")
const missingDestinationGuard = inTransaction.indexOf("if (!approvalDestination)")
const itemLock = inTransaction.indexOf("SELECT * FROM solicitacoes_movimentacao_itens")
const assetLock = inTransaction.indexOf("SELECT id, descricao, patrimonio, localizacao_secretaria")
const movementWrite = inTransaction.indexOf("registrarMovimentacaoInterna(connection")
const requestStatusWrite = inTransaction.indexOf("SET status = 'aprovada'")

assert.ok(destinationCheck >= 0, "approval must resolve and lock the destination hierarchy")
assert.ok(missingDestinationGuard > destinationCheck, "missing/ambiguous destination must stop approval")
assert.ok(itemLock > missingDestinationGuard, "destination validation must precede item locking and writes")
assert.ok(assetLock > itemLock, "all requested items must be locked before applying the batch")
assert.ok(movementWrite > assetLock, "movement writes must follow destination and asset validation")
assert.ok(requestStatusWrite > movementWrite, "request status must update only after every movement write")
assert.match(inTransaction, /para:\s*approvalDestination/)

console.log("Movement approval guard verification passed: destination/items checked before atomic writes and status update.")
