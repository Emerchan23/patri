export interface LocationParts {
  secretaria?: string | null
  departamento?: string | null
  sala?: string | null
}

export interface LocationQueryExecutor {
  execute: (sql: string, params?: unknown[]) => Promise<[unknown, unknown]>
}

function normalizeLocationName(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ")
}

export function sameLocationName(first: string | null | undefined, second: string | null | undefined) {
  return normalizeLocationName(first) === normalizeLocationName(second)
}

export function sameLocation(first: LocationParts, second: LocationParts) {
  return (
    sameLocationName(first.secretaria, second.secretaria) &&
    sameLocationName(first.departamento, second.departamento) &&
    sameLocationName(first.sala, second.sala)
  )
}

export async function findCanonicalLocation(
  executor: LocationQueryExecutor,
  requested: LocationParts,
): Promise<LocationParts | null> {
  const [result] = await executor.execute(
    `SELECT sec.nome AS secretaria, d.nome AS departamento, s.nome AS sala
       FROM salas s
       JOIN departamentos d ON d.id = s.departamento_id
       JOIN secretarias sec ON sec.id = d.secretaria_id
      WHERE sec.nome = ? AND d.nome = ? AND s.nome = ?
      FOR UPDATE`,
    [requested.secretaria, requested.departamento, requested.sala],
  )
  if (!Array.isArray(result) || result.length !== 1) return null

  const row = result[0] as LocationParts
  if (
    typeof row.secretaria !== "string" ||
    typeof row.departamento !== "string" ||
    typeof row.sala !== "string"
  ) return null

  return {
    secretaria: row.secretaria,
    departamento: row.departamento,
    sala: row.sala,
  }
}
