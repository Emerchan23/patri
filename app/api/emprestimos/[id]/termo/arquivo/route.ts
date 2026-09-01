import { NextResponse } from "next/server"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import crypto from "crypto"
import { queryOne, execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { getTransferScopeClause } from "@/lib/asset-scope"
import { ensureTermosResponsabilidadeSchema } from "@/lib/termos-responsabilidade-schema"
import { registrarLog } from "@/lib/audit"

export const POST = withAuth(async (request, { user, params }) => {
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
  if (!loan) return NextResponse.json({ error: "Emprestimo nao encontrado" }, { status: 404 })

  const form = await request.formData()
  const file = form.get("arquivo")
  if (!(file instanceof File) || file.type !== "application/pdf") {
    return NextResponse.json({ error: "Envie um arquivo PDF assinado." }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "O PDF deve ter no maximo 10 MB." }, { status: 413 })
  }

  const folder = path.join(process.cwd(), "public", "uploads", "termos")
  await mkdir(folder, { recursive: true })
  const filename = `${crypto.randomUUID()}.pdf`
  await writeFile(path.join(folder, filename), Buffer.from(await file.arrayBuffer()))
  const publicPath = `/api/emprestimos/${id}/termo/arquivo`
  const storedPath = `/uploads/termos/${filename}`

  await execute(
    `INSERT INTO termos_responsabilidade
       (emprestimo_id, bem_id, patrimonio, responsavel_nome, responsavel_cargo, status, assinado_em, assinado_por_usuario_id, arquivo_assinado)
     VALUES (?, ?, ?, ?, ?, 'assinado', NOW(), ?, ?)
     ON DUPLICATE KEY UPDATE status='assinado', assinado_em=NOW(), assinado_por_usuario_id=VALUES(assinado_por_usuario_id), arquivo_assinado=VALUES(arquivo_assinado)`,
    [id, loan.bem_id || null, loan.patrimonio, loan.responsavel_recebimento, null, user.id, storedPath]
  )

  await registrarLog({
    acao: "edicao",
    descricao: `Termo de responsabilidade assinado anexado: ${loan.patrimonio}`,
    detalhes: `Emprestimo #${id}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "emprestimo",
    entidadeId: String(id),
    entidadeDescricao: loan.bem_descricao as string,
  })

  return NextResponse.json({ success: true, arquivoAssinado: publicPath, assinadoEm: new Date().toISOString() })
})

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
  if (!loan) return NextResponse.json({ error: "Emprestimo nao encontrado" }, { status: 404 })

  const term = await queryOne<{ arquivo_assinado?: string | null }>(
    "SELECT arquivo_assinado FROM termos_responsabilidade WHERE emprestimo_id = ? AND status = 'assinado'",
    [id]
  )
  if (!term?.arquivo_assinado) return NextResponse.json({ error: "Termo assinado nao encontrado" }, { status: 404 })

  const filename = path.basename(term.arquivo_assinado)
  if (!filename.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Arquivo de termo invalido" }, { status: 400 })
  }

  try {
    const filePath = path.join(process.cwd(), "public", "uploads", "termos", filename)
    const file = await readFile(filePath)
    return new NextResponse(file, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="termo-${String(loan.patrimonio || id).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch {
    return NextResponse.json({ error: "Arquivo do termo nao esta disponivel no armazenamento" }, { status: 404 })
  }
})
