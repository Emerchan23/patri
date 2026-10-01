import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = readFileSync("app/api/veiculos/[id]/route.ts", "utf8")
const put = source.split("export const PUT =")[1]?.split("export const DELETE =")[0] ?? ""
const deletion = source.split("export const DELETE =")[1] ?? ""

assert.match(put, /withPermission\("gerenciarVeiculos"/)
assert.match(put, /assertAssetAccess\(user, id\)/)
assert.match(put, /WHERE id = \? AND categoria_slug LIKE 'veicul%'/)
assert.ok(
  put.indexOf("assertAssetAccess(user, id)") < put.indexOf("UPDATE bens SET"),
  "vehicle scope check must happen before the update",
)

assert.match(deletion, /withPermission\("excluirBem"/)
assert.match(deletion, /typeof motivo !== "string" \|\| !motivo\.trim\(\)/)
assert.match(deletion, /motivo\.length > 1000/)
assert.match(deletion, /assertAssetAccess\(user, id\)/)
assert.match(deletion, /DELETE FROM bens WHERE id = \? AND categoria_slug LIKE 'veicul%'/)
assert.ok(
  deletion.indexOf("Motivo da exclusão é obrigatório") < deletion.indexOf("DELETE FROM bens"),
  "deletion reason must be validated before removing the vehicle",
)
assert.ok(
  deletion.indexOf("assertAssetAccess(user, id)") < deletion.indexOf("DELETE FROM bens"),
  "vehicle scope check must happen before deletion",
)

console.log("Vehicle route authorization, scope, vehicle type, and deletion reason guards passed.")
