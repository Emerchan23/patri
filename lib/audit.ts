import { execute } from "./db"

interface AuditLogParams {
  acao: string
  descricao: string
  detalhes?: string
  usuarioId: number
  usuarioNome: string
  usuarioRole: string
  entidadeTipo?: string
  entidadeId?: string
  entidadeDescricao?: string
  ip?: string
  dadosAnteriores?: Record<string, unknown>
  dadosNovos?: Record<string, unknown>
}

export async function registrarLog(params: AuditLogParams) {
  try {
    await execute(
      `INSERT INTO audit_logs (acao, descricao, detalhes, usuario_id, usuario_nome, usuario_role, entidade_tipo, entidade_id, entidade_descricao, ip, dados_anteriores, dados_novos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.acao,
        params.descricao,
        params.detalhes || null,
        params.usuarioId,
        params.usuarioNome,
        params.usuarioRole,
        params.entidadeTipo || null,
        params.entidadeId || null,
        params.entidadeDescricao || null,
        params.ip || null,
        params.dadosAnteriores ? JSON.stringify(params.dadosAnteriores) : null,
        params.dadosNovos ? JSON.stringify(params.dadosNovos) : null,
      ]
    )
  } catch (error) {
    console.error("Erro ao registrar log de auditoria:", error)
  }
}

export async function logAudit(
  usuarioId: number,
  usuarioNome: string,
  acao: string,
  detalhes?: string
) {
  return registrarLog({
    usuarioId,
    usuarioNome,
    usuarioRole: "sistema", // Default role since it's not passed
    acao: acao.toUpperCase().replace(/\s+/g, "_"),
    descricao: acao,
    detalhes,
  })
}
