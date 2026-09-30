import { NextResponse } from "next/server"
import { queryOne, withTransaction } from "@/lib/db"
import { withPermission } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import { getAssetScopeClause, getTransferScopeClause } from "@/lib/asset-scope"

// PATCH /api/emprestimos/[id]/devolver
export const PATCH = withPermission("gerenciarEmprestimos", async (request, { user, params }) => {
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
  const today = new Date().toISOString().split("T")[0]
  const dataDevolucao = body.dataDevolucao || today
  const parsedReturnDate = typeof dataDevolucao === "string"
    ? new Date(`${dataDevolucao}T00:00:00.000Z`)
    : null
  if (
    typeof dataDevolucao !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dataDevolucao) ||
    !parsedReturnDate ||
    Number.isNaN(parsedReturnDate.getTime()) ||
    parsedReturnDate.toISOString().slice(0, 10) !== dataDevolucao
  ) {
    return NextResponse.json({ error: "Informe uma data de devolução válida no formato AAAA-MM-DD." }, { status: 400 })
  }

  const outcome = await withTransaction(async (connection) => {
    if (loan.bem_id) {
      const assetScope = getAssetScopeClause(user)
      const [assetRows] = await connection.execute(
        `SELECT id, status FROM bens WHERE id = ?${assetScope.clause ? ` AND (${assetScope.clause})` : ""} FOR UPDATE`,
        [loan.bem_id, ...assetScope.params]
      )
      const asset = (assetRows as Record<string, unknown>[])[0]
      if (!asset) return { error: "Sem permissão para devolver este bem.", status: 403 as const }
      if (String(asset.status || "").toLowerCase() !== "emprestado") {
        return { error: "O status do bem não corresponde a um empréstimo em aberto.", status: 409 as const }
      }
    }

    const [loanRows] = await connection.execute(
      `SELECT * FROM emprestimos WHERE id = ?${scope.clause ? ` AND (${scope.clause})` : ""} FOR UPDATE`,
      [id, ...scope.params]
    )
    const currentLoan = (loanRows as Record<string, unknown>[])[0]
    if (!currentLoan) return { error: "Emprestimo nao encontrado", status: 404 as const }
    if (!["ativo", "atrasado"].includes(String(currentLoan.status))) {
      return { error: "Este empréstimo já foi devolvido.", status: 409 as const }
    }

    let observacoes = String(currentLoan.observacoes || "")
    const returnNote = String(body.observacoes || "").trim()
    if (returnNote) {
      observacoes = observacoes
        ? `${observacoes}\n[Devolução ${today}]: ${returnNote}`
        : `[Devolução ${today}]: ${returnNote}`
    }

    const [loanUpdate] = await connection.execute(
      `UPDATE emprestimos SET status = 'devolvido', data_devolucao = ?, observacoes = ?
        WHERE id = ? AND status IN ('ativo', 'atrasado')`,
      [dataDevolucao, observacoes, id]
    )
    if (Number((loanUpdate as any).affectedRows || 0) !== 1) {
      return { error: "Este empréstimo já foi devolvido.", status: 409 as const }
    }

    if (currentLoan.bem_id) {
      const [assetUpdate] = await connection.execute(
        `UPDATE bens SET status = 'ativo' WHERE id = ? AND status = 'emprestado'`,
        [currentLoan.bem_id]
      )
      if (Number((assetUpdate as any).affectedRows || 0) !== 1) {
        throw new Error("O status do bem mudou durante a devolução.")
      }
    }
    return { loan: currentLoan }
  })

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status })
  }
  const currentLoan = outcome.loan

  await registrarLog({
    acao: "devolucao",
    descricao: `Devolucao registrada: ${currentLoan.bem_descricao}`,
    detalhes: `Emprestimo #${id} devolvido em ${dataDevolucao}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "emprestimo",
    entidadeId: String(id),
    entidadeDescricao: currentLoan.bem_descricao as string,
    dadosAnteriores: { status: currentLoan.status },
    dadosNovos: { status: "devolvido", dataDevolucao: dataDevolucao },
  })

  return NextResponse.json({ success: true })
})
