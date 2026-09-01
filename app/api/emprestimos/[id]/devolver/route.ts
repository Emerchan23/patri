import { NextResponse } from "next/server"
import { queryOne, execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import { assertAssetAccess, getTransferScopeClause } from "@/lib/asset-scope"

// PATCH /api/emprestimos/[id]/devolver
export const PATCH = withAuth(async (request, { user, params }) => {
  const id = params?.id
  const body = await request.json().catch(() => ({}))

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
  if (loan.bem_id) {
    try {
      await assertAssetAccess(user, String(loan.bem_id))
    } catch {
      return NextResponse.json({ error: "Sem permissao para devolver este bem" }, { status: 403 })
    }
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
