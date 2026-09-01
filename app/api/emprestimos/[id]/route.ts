
import { NextResponse } from "next/server"
import { queryOne } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { getTransferScopeClause } from "@/lib/asset-scope"
import { ensureTermosResponsabilidadeSchema } from "@/lib/termos-responsabilidade-schema"

export const GET = withAuth(async (request, { user, params }) => {
  await ensureTermosResponsabilidadeSchema()
  const id = params?.id
  const scope = getTransferScopeClause(user, {
    fromSecretariaColumn: "origem_secretaria",
    fromDepartamentoColumn: "origem_departamento",
    toSecretariaColumn: "destino_secretaria",
    toDepartamentoColumn: "destino_departamento",
  })
  const loan = await queryOne<Record<string, unknown>>(
    `SELECT * FROM emprestimos WHERE id = ?${scope.clause ? ` AND (${scope.clause})` : ""}`,
    [id, ...scope.params]
  )
  
  if (!loan) {
    return NextResponse.json({ error: "Emprestimo nao encontrado" }, { status: 404 })
  }
  
  const term = await queryOne<Record<string, unknown>>(
    "SELECT * FROM termos_responsabilidade WHERE emprestimo_id = ?",
    [id]
  )
  return NextResponse.json({ ...dbRowToLoan(loan), termo: term ? {
    id: String(term.id),
    status: term.status,
    geradoEm: term.gerado_em,
    assinadoEm: term.assinado_em,
    arquivoAssinado: term.arquivo_assinado ? `/api/emprestimos/${id}/termo/arquivo` : null,
  } : null })
})

function dbRowToLoan(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    assetId: String(row.bem_id),
    assetDescricao: row.bem_descricao,
    patrimonio: row.patrimonio,
    origem: { secretaria: row.origem_secretaria, departamento: row.origem_departamento, sala: row.origem_sala },
    destino: { secretaria: row.destino_secretaria, departamento: row.destino_departamento, sala: row.destino_sala },
    responsavelEmprestimo: row.responsavel_emprestimo,
    responsavelRecebimento: row.responsavel_recebimento,
    solicitante: row.solicitante,
    dataEmprestimo: row.data_emprestimo ? new Date(row.data_emprestimo as string).toISOString().split("T")[0] : "",
    dataPrevistaDevolucao: row.data_prevista_devolucao ? new Date(row.data_prevista_devolucao as string).toISOString().split("T")[0] : "",
    dataDevolucao: row.data_devolucao ? new Date(row.data_devolucao as string).toISOString().split("T")[0] : undefined,
    motivo: row.motivo,
    observacoes: row.observacoes || undefined,
    status: row.status,
  }
}
