export interface LocationParts {
  secretaria?: string | null
  departamento?: string | null
  sala?: string | null
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
