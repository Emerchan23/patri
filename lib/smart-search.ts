export function normalizeSmartSearch(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}

function normalizedColumn(column: string) {
  return `UPPER(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${column}, ''), '-', ''), ' ', ''), '.', ''), '/', ''))`
}

export function buildSmartSearch(columns: string[], value: string) {
  const raw = String(value || "").trim()
  const normalized = normalizeSmartSearch(raw)
  if (!raw) return { clause: "1=1", params: [] as string[] }

  const clauses: string[] = []
  const params: string[] = []
  for (const column of columns) {
    clauses.push(`${column} LIKE ?`)
    params.push(`%${raw}%`)
    if (normalized && normalized.toLowerCase() !== raw.toLowerCase()) {
      clauses.push(`${normalizedColumn(column)} LIKE ?`)
      params.push(`%${normalized}%`)
    }
  }
  return { clause: `(${clauses.join(" OR ")})`, params }
}
