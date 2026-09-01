import { queryOne } from "./db"
import type { ScopedDbUser } from "./auth-utils"

export type ScopedUser = ScopedDbUser

interface AssetScopeColumns {
  secretariaColumn?: string
  departamentoColumn?: string
}

interface TransferScopeColumns {
  fromSecretariaColumn: string
  fromDepartamentoColumn?: string
  toSecretariaColumn: string
  toDepartamentoColumn?: string
}

const DEFAULT_ASSET_COLUMNS: Required<AssetScopeColumns> = {
  secretariaColumn: "localizacao_secretaria",
  departamentoColumn: "localizacao_departamento",
}

function normalizeManagedSecretarias(user: ScopedUser) {
  return (user.secretariasGerenciadas || []).filter(Boolean)
}

function normalizeAssistantDepartments(user: ScopedUser) {
  const departments = (user.departamentosAssistente || []).filter(Boolean)
  if (departments.length > 0) return departments
  return user.unidade_departamento ? [user.unidade_departamento] : []
}

export function isLocationInScope(
  user: ScopedUser,
  location?: { secretaria?: string | null; departamento?: string | null } | null
) {
  if (user.role === "administrador") return true

  const secretaria = location?.secretaria || null
  const departamento = location?.departamento || null

  if (user.role === "gestor") {
    return !!secretaria && normalizeManagedSecretarias(user).includes(secretaria)
  }

  if (user.role === "assistente") {
    const allowedDepartments = normalizeAssistantDepartments(user)
    return (
      !!secretaria &&
      !!departamento &&
      secretaria === user.unidade_secretaria &&
      allowedDepartments.includes(departamento)
    )
  }

  return false
}

export function getAssetScopeClause(user: ScopedUser, columns?: AssetScopeColumns) {
  const scopedColumns = { ...DEFAULT_ASSET_COLUMNS, ...columns }

  if (user.role === "administrador") {
    return { clause: "", params: [] as unknown[] }
  }

  if (user.role === "gestor") {
    const managed = normalizeManagedSecretarias(user)
    if (managed.length === 0) {
      return { clause: "1=0", params: [] as unknown[] }
    }

    const placeholders = managed.map(() => "?").join(", ")
    return {
      clause: `${scopedColumns.secretariaColumn} IN (${placeholders})`,
      params: managed,
    }
  }

  if (!user.unidade_secretaria) {
    return { clause: "1=0", params: [] as unknown[] }
  }

  const departments = normalizeAssistantDepartments(user)
  if (departments.length === 0) {
    return { clause: "1=0", params: [] as unknown[] }
  }

  if (departments.length === 1) {
    return {
      clause: `${scopedColumns.secretariaColumn} = ? AND ${scopedColumns.departamentoColumn} = ?`,
      params: [user.unidade_secretaria, departments[0]],
    }
  }

  return {
    clause: `${scopedColumns.secretariaColumn} = ? AND ${scopedColumns.departamentoColumn} IN (${departments.map(() => "?").join(", ")})`,
    params: [user.unidade_secretaria, ...departments],
  }
}

export function getTransferScopeClause(user: ScopedUser, columns: TransferScopeColumns) {
  if (user.role === "administrador") {
    return { clause: "", params: [] as unknown[] }
  }

  if (user.role === "gestor") {
    const managed = normalizeManagedSecretarias(user)
    if (managed.length === 0) {
      return { clause: "1=0", params: [] as unknown[] }
    }

    const placeholders = managed.map(() => "?").join(", ")
    return {
      clause: `(${columns.fromSecretariaColumn} IN (${placeholders}) OR ${columns.toSecretariaColumn} IN (${placeholders}))`,
      params: [...managed, ...managed],
    }
  }

  if (!user.unidade_secretaria) {
    return { clause: "1=0", params: [] as unknown[] }
  }

  const departments = normalizeAssistantDepartments(user)
  if (departments.length === 0) {
    return { clause: "1=0", params: [] as unknown[] }
  }

  const fromDepartmentColumn = columns.fromDepartamentoColumn || DEFAULT_ASSET_COLUMNS.departamentoColumn
  const toDepartmentColumn = columns.toDepartamentoColumn || DEFAULT_ASSET_COLUMNS.departamentoColumn
  const placeholders = departments.map(() => "?").join(", ")
  const fromClause = `${columns.fromSecretariaColumn} = ? AND ${fromDepartmentColumn} IN (${placeholders})`
  const toClause = `${columns.toSecretariaColumn} = ? AND ${toDepartmentColumn} IN (${placeholders})`

  return {
    clause: `((${fromClause}) OR (${toClause}))`,
    params: [
      user.unidade_secretaria,
      ...departments,
      user.unidade_secretaria,
      ...departments,
    ],
  }
}

export function appendScopeClause(
  whereClause: string,
  params: unknown[],
  scope: { clause: string; params: unknown[] }
) {
  if (!scope.clause) return { whereClause, params }

  return {
    whereClause: `${whereClause} AND (${scope.clause})`,
    params: [...params, ...scope.params],
  }
}

export async function canAccessAssetById(user: ScopedUser, assetId: string | number) {
  const scope = getAssetScopeClause(user)
  const sql = scope.clause
    ? `SELECT id FROM bens WHERE id = ? AND (${scope.clause})`
    : "SELECT id FROM bens WHERE id = ?"
  const row = await queryOne<{ id: number }>(sql, [assetId, ...scope.params])
  return !!row
}

export async function assertAssetAccess(user: ScopedUser, assetId: string | number) {
  const allowed = await canAccessAssetById(user, assetId)
  if (!allowed) {
    throw new Error("FORBIDDEN_ASSET_SCOPE")
  }
}

export async function canAccessSecretariaId(user: ScopedUser, secretariaId: string | number) {
  const row = await queryOne<{ nome: string }>("SELECT nome FROM secretarias WHERE id = ?", [secretariaId])
  if (!row) return false
  if (user.role === "administrador") return true
  if (user.role === "gestor") {
    return normalizeManagedSecretarias(user).includes(row.nome)
  }
  return row.nome === user.unidade_secretaria
}

export async function canAccessDepartamentoId(user: ScopedUser, departamentoId: string | number) {
  const row = await queryOne<{ secretaria_nome: string; departamento_nome: string }>(
    `SELECT s.nome as secretaria_nome, d.nome as departamento_nome
     FROM departamentos d
     JOIN secretarias s ON s.id = d.secretaria_id
     WHERE d.id = ?`,
    [departamentoId]
  )
  if (!row) return false
  return isLocationInScope(user, {
    secretaria: row.secretaria_nome,
    departamento: row.departamento_nome,
  })
}

export async function canAccessSalaId(user: ScopedUser, salaId: string | number) {
  const row = await queryOne<{ secretaria_nome: string; departamento_nome: string }>(
    `SELECT sec.nome as secretaria_nome, d.nome as departamento_nome
     FROM salas s
     JOIN departamentos d ON d.id = s.departamento_id
     JOIN secretarias sec ON sec.id = d.secretaria_id
     WHERE s.id = ?`,
    [salaId]
  )
  if (!row) return false
  return isLocationInScope(user, {
    secretaria: row.secretaria_nome,
    departamento: row.departamento_nome,
  })
}
