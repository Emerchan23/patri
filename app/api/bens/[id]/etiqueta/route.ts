import { NextRequest, NextResponse } from "next/server"
import { queryOne, execute } from "@/lib/db"
import { verifyAuth } from "@/lib/api-auth"
import { assertAssetAccess } from "@/lib/asset-scope"
import { registrarLog } from "@/lib/audit"
import { criarNotificacao } from "@/lib/notifications"
import { ensureAssetLabelWorkflowSchema } from "@/lib/asset-label-workflow-schema"

type LabelWorkflowAction = "marcar_enviada" | "confirmar_colada" | "reabrir_pendente"

function isManagerRole(role?: string) {
  return role === "administrador" || role === "gestor"
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureAssetLabelWorkflowSchema()

  const user = await verifyAuth(request)
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 })
  }

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const action = body?.action as LabelWorkflowAction | undefined

  if (!id || !action) {
    return NextResponse.json({ error: "Acao de etiqueta nao informada." }, { status: 400 })
  }

  const existing = await queryOne<Record<string, unknown>>("SELECT * FROM bens WHERE id = ?", [id])
  if (!existing) {
    return NextResponse.json({ error: "Bem nao encontrado" }, { status: 404 })
  }

  try {
    await assertAssetAccess(user, id)
  } catch {
    return NextResponse.json({ error: "Sem permissao para acessar este bem" }, { status: 403 })
  }

  const currentStatus = String(existing.etiqueta_status || "").trim() || null

  if (action === "marcar_enviada") {
    if (!isManagerRole(user.role)) {
      return NextResponse.json({ error: "Sem permissao para marcar etiqueta como enviada." }, { status: 403 })
    }

    await execute(
      `UPDATE bens
          SET etiqueta_status = 'enviada',
              etiqueta_enviada_em = NOW(),
              etiqueta_enviada_por = ?,
              etiqueta_colada_em = NULL,
              etiqueta_colada_por = NULL
        WHERE id = ?`,
      [user.nome, id]
    )

    await registrarLog({
      acao: "etiqueta_enviada",
      descricao: `Etiqueta marcada como enviada: ${existing.descricao}`,
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: "bem",
      entidadeId: String(id),
      entidadeDescricao: String(existing.descricao || ""),
      dadosAnteriores: { etiquetaStatus: currentStatus },
      dadosNovos: { etiquetaStatus: "enviada" },
    })

    await criarNotificacao({
      roleDestino: "assistente",
      titulo: "Etiqueta disponivel para colagem",
      mensagem: `${existing.descricao} esta com etiqueta pronta para ser colada pela unidade.`,
      tipo: "info",
      link: "dashboard",
    })

    return NextResponse.json({ success: true, etiquetaStatus: "enviada" })
  }

  if (action === "confirmar_colada") {
    if (user.role !== "assistente") {
      return NextResponse.json({ error: "Somente assistente pode confirmar colagem." }, { status: 403 })
    }

    if (currentStatus !== "enviada") {
      return NextResponse.json({ error: "A etiqueta ainda nao foi marcada como enviada para colagem." }, { status: 409 })
    }

    await execute(
      `UPDATE bens
          SET etiqueta_status = 'colada',
              etiqueta_colada_em = NOW(),
              etiqueta_colada_por = ?
        WHERE id = ?`,
      [user.nome, id]
    )

    await registrarLog({
      acao: "etiqueta_colada",
      descricao: `Colagem de etiqueta confirmada: ${existing.descricao}`,
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: "bem",
      entidadeId: String(id),
      entidadeDescricao: String(existing.descricao || ""),
      dadosAnteriores: { etiquetaStatus: currentStatus },
      dadosNovos: { etiquetaStatus: "colada" },
    })

    await criarNotificacao({
      roleDestino: "gestor",
      titulo: "Colagem de etiqueta confirmada",
      mensagem: `${existing.descricao} teve a colagem da etiqueta confirmada por ${user.nome}.`,
      tipo: "success",
      link: "pendencias",
    })

    return NextResponse.json({ success: true, etiquetaStatus: "colada" })
  }

  if (action === "reabrir_pendente") {
    if (!isManagerRole(user.role)) {
      return NextResponse.json({ error: "Sem permissao para reabrir a pendencia da etiqueta." }, { status: 403 })
    }

    await execute(
      `UPDATE bens
          SET etiqueta_status = NULL,
              etiqueta_enviada_em = NULL,
              etiqueta_enviada_por = NULL,
              etiqueta_colada_em = NULL,
              etiqueta_colada_por = NULL
        WHERE id = ?`,
      [id]
    )

    await registrarLog({
      acao: "etiqueta_reaberta",
      descricao: `Pendencia de etiqueta reaberta: ${existing.descricao}`,
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: "bem",
      entidadeId: String(id),
      entidadeDescricao: String(existing.descricao || ""),
      dadosAnteriores: { etiquetaStatus: currentStatus },
      dadosNovos: { etiquetaStatus: null },
    })

    return NextResponse.json({ success: true, etiquetaStatus: null })
  }

  return NextResponse.json({ error: "Acao de etiqueta invalida." }, { status: 400 })
}
