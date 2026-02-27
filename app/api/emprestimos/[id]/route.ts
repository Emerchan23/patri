
import { NextResponse } from "next/server"
import { queryOne } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"

export const GET = withAuth(async (request, { params }) => {
  const id = params?.id
  
  const loan = await queryOne<Record<string, unknown>>("SELECT * FROM emprestimos WHERE id = ?", [id])
  
  if (!loan) {
    return NextResponse.json({ error: "Emprestimo nao encontrado" }, { status: 404 })
  }
  
  return NextResponse.json(dbRowToLoan(loan))
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
