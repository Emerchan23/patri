import { NextResponse } from "next/server"
import { queryOne, execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

// PATCH /api/emprestimos/[id]/devolver
export const PATCH = withAuth(async (request, { user, params }) => {
  const id = params?.id
  const body = await request.json().catch(() => ({}))

  const loan = await queryOne<Record<string, unknown>>("SELECT * FROM emprestimos WHERE id = ?", [id])
  if (!loan) {
    return NextResponse.json({ error: "Emprestimo nao encontrado" }, { status: 404 })
  }

  const today = new Date().toISOString().split("T")[0]
  const dataDevolucao = body.dataDevolucao || today
  
  let observacoes = loan.observacoes as string || ""
  if (body.observacoes) {
    observacoes = observacoes ? `${observacoes}\n[Devolução ${today}]: ${body.observacoes}` : `[Devolução ${today}]: ${body.observacoes}`
  }

  await execute(
    "UPDATE emprestimos SET status = 'devolvido', data_devolucao = ?, observacoes = ? WHERE id = ?",
    [dataDevolucao, observacoes, id]
  )

  // Restore asset status to ativo
  if (loan.bem_id) {
    await execute("UPDATE bens SET status = 'ativo' WHERE id = ?", [loan.bem_id])
  }

  await registrarLog({
    acao: "devolucao",
    descricao: `Devolucao registrada: ${loan.bem_descricao}`,
    detalhes: `Emprestimo #${id} devolvido em ${dataDevolucao}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "emprestimo",
    entidadeId: String(id),
    entidadeDescricao: loan.bem_descricao as string,
    dadosAnteriores: { status: loan.status },
    dadosNovos: { status: "devolvido", dataDevolucao: dataDevolucao },
  })

  return NextResponse.json({ success: true })
})
