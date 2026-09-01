import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { withPermission } from "@/lib/api-auth"

type ValidationRequestItem = {
  code: string
  field?: "patrimonio" | "patrimonioProvisorio"
  itemIndex?: number
}

export const POST = withPermission("cadastrarBem", async (request) => {
  const body = await request.json().catch(() => null)
  const rawItems = Array.isArray(body?.codes) ? body.codes : []

  const requestedItems = rawItems
    .map((item: string | ValidationRequestItem, index: number) => {
      if (typeof item === "string") {
        return { code: item, itemIndex: index }
      }

      return {
        code: String(item?.code || ""),
        field: item?.field === "patrimonioProvisorio" ? "patrimonioProvisorio" : "patrimonio",
        itemIndex: typeof item?.itemIndex === "number" ? item.itemIndex : index,
      }
    })
    .map((item: ValidationRequestItem & { itemIndex?: number }) => ({
      ...item,
      normalizedCode: item.code.trim().toUpperCase(),
    }))
    .filter((item: ValidationRequestItem & { normalizedCode: string }) => item.normalizedCode)

  if (requestedItems.length === 0) {
    return NextResponse.json({ conflicts: [], available: true })
  }

  const duplicateInRequest = new Map<string, ValidationRequestItem & { normalizedCode: string }>()
  const requestConflicts: Array<Record<string, unknown>> = []

  for (const item of requestedItems as Array<ValidationRequestItem & { normalizedCode: string }>) {
    const previous = duplicateInRequest.get(item.normalizedCode)
    if (previous) {
      requestConflicts.push({
        code: item.code,
        conflictingCode: item.code,
        field: item.field || "patrimonio",
        itemIndex: item.itemIndex ?? null,
        duplicateWithinRequest: true,
        message: `O patrimonio ${item.code} foi informado mais de uma vez nesta mesma operacao.`,
      })
      continue
    }
    duplicateInRequest.set(item.normalizedCode, item)
  }

  const placeholders = requestedItems.map(() => "?").join(", ")
  const params = requestedItems.flatMap((item: ValidationRequestItem & { normalizedCode: string }) => [item.normalizedCode, item.normalizedCode])
  const rows = await query<{
    id: number
    patrimonio: string | null
    patrimonio_provisorio: string | null
  }>(
    `SELECT id, patrimonio, patrimonio_provisorio
       FROM bens
      WHERE UPPER(COALESCE(patrimonio, '')) IN (${placeholders})
         OR UPPER(COALESCE(patrimonio_provisorio, '')) IN (${placeholders})`,
    params
  )

  const dbConflicts = requestedItems.flatMap((item: ValidationRequestItem & { normalizedCode: string }) => {
    const conflictRow = rows.find((row) => {
      const patrimonio = String(row.patrimonio || "").trim().toUpperCase()
      const patrimonioProvisorio = String(row.patrimonio_provisorio || "").trim().toUpperCase()
      return patrimonio === item.normalizedCode || patrimonioProvisorio === item.normalizedCode
    })

    if (!conflictRow) return []

    const conflictingField =
      String(conflictRow.patrimonio || "").trim().toUpperCase() === item.normalizedCode
        ? "patrimonio"
        : "patrimonioProvisorio"

    return [{
      code: item.code,
      conflictingCode: item.code,
      field: conflictingField,
      itemIndex: item.itemIndex ?? null,
      conflictingAssetId: conflictRow.id,
      duplicateWithinRequest: false,
      message: `O patrimonio ${item.code} ja esta em uso por outro bem.`,
    }]
  })

  const conflicts = [...requestConflicts, ...dbConflicts]
  return NextResponse.json({
    available: conflicts.length === 0,
    conflicts,
  })
})
