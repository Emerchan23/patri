import { NextResponse } from "next/server"
import { queryOne, execute } from "@/lib/db"
import { withRole } from "@/lib/api-auth"
import { hashPassword } from "@/lib/auth-utils"
import { registrarLog } from "@/lib/audit"
import { ensureUserScopeSchema } from "@/lib/user-scope-schema"

// PUT /api/usuarios/[id] - Update user
export const PUT = withRole(["administrador"], async (request, { user, params }) => {
  await ensureUserScopeSchema()
  const id = params?.id
  const body = await request.json()
  const unidadeSecretaria = body.unidade?.secretaria || body.secretaria || null
  const departamentosAssistente = Array.from(
    new Set(
      ((body.unidade?.departamentos as string[] | undefined) || body.departamentosAssistente || [])
        .filter(Boolean)
        .map((dep: string) => dep.trim())
    )
  )
  const unidadeDepartamento =
    body.unidade?.departamento ||
    body.departamento ||
    departamentosAssistente[0] ||
    null
  const podeCadastrarBem = body.role === "assistente"
    ? (body.podeCadastrarBem === undefined || body.podeCadastrarBem === null ? null : (body.podeCadastrarBem ? 1 : 0))
    : null
  const podeCadastroProvisorioUnidade = body.role === "assistente"
    ? (
        body.podeCadastroProvisorioUnidade === undefined || body.podeCadastroProvisorioUnidade === null
          ? null
          : (body.podeCadastroProvisorioUnidade ? 1 : 0)
      )
    : null

  const existing = await queryOne<Record<string, unknown>>("SELECT * FROM usuarios WHERE id = ?", [id])
  if (!existing) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 })
  }

  let updateSql = "UPDATE usuarios SET nome=?, email=?, cargo=?, role=?, unidade_secretaria=?, unidade_departamento=?, acesso_app=?, pode_cadastrar_bem=?, pode_cadastro_provisorio_unidade=?"
  const updateParams: unknown[] = [
    body.nome, body.email, body.cargo, body.role,
    unidadeSecretaria, unidadeDepartamento,
    body.acessoApp ? 1 : 0,
    podeCadastrarBem,
    podeCadastroProvisorioUnidade,
  ]

  // Only update password if provided
  if (body.senha) {
    const senhaHash = await hashPassword(body.senha)
    updateSql += ", senha_hash=?"
    updateParams.push(senhaHash)
  }

  // Update avatar
  const avatar = body.nome
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
  updateSql += ", avatar=?"
  updateParams.push(avatar)

  updateSql += " WHERE id=?"
  updateParams.push(id)

  await execute(updateSql, updateParams)

  // Update secretarias gerenciadas
  if (body.role === "gestor") {
    await execute("DELETE FROM secretarias_gerenciadas WHERE usuario_id = ?", [id])
    if (body.secretariasGerenciadas?.length) {
      for (const sec of body.secretariasGerenciadas) {
        await execute("INSERT INTO secretarias_gerenciadas (usuario_id, secretaria) VALUES (?, ?)", [id, sec])
      }
    }
  } else {
    await execute("DELETE FROM secretarias_gerenciadas WHERE usuario_id = ?", [id])
  }

  await execute("DELETE FROM departamentos_assistente WHERE usuario_id = ?", [id])
  if (body.role === "assistente" && unidadeSecretaria && departamentosAssistente.length > 0) {
    for (const dep of departamentosAssistente) {
      await execute(
        "INSERT INTO departamentos_assistente (usuario_id, secretaria, departamento) VALUES (?, ?, ?)",
        [id, unidadeSecretaria, dep]
      )
    }
  }

  await registrarLog({
    acao: "usuario_editado",
    descricao: `Usuario editado: ${body.nome}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "usuario",
    entidadeId: String(id),
    entidadeDescricao: body.nome,
  })

  return NextResponse.json({ success: true })
})

// DELETE /api/usuarios/[id] - Delete user
export const DELETE = withRole(["administrador"], async (request, { user, params }) => {
  await ensureUserScopeSchema()
  const id = params?.id

  const existing = await queryOne<Record<string, unknown>>("SELECT * FROM usuarios WHERE id = ?", [id])
  if (!existing) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 })
  }

  // Delete related records first (if any foreign keys exist without cascade)
  // For safety, delete from secretarias_gerenciadas first
  await execute("DELETE FROM secretarias_gerenciadas WHERE usuario_id = ?", [id])
  await execute("DELETE FROM departamentos_assistente WHERE usuario_id = ?", [id])
  
  // Delete the user
  await execute("DELETE FROM usuarios WHERE id = ?", [id])

  await registrarLog({
    acao: "usuario_removido",
    descricao: `Usuario removido: ${existing.nome}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "usuario",
    entidadeId: String(id),
    entidadeDescricao: existing.nome as string,
    dadosAnteriores: existing,
  })

  return NextResponse.json({ success: true })
})

// PATCH /api/usuarios/[id] - Toggle active
export const PATCH = withRole(["administrador"], async (request, { user, params }) => {
  const id = params?.id
  const body = await request.json()

  const existing = await queryOne<Record<string, unknown>>("SELECT * FROM usuarios WHERE id = ?", [id])
  if (!existing) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 })
  }

  if (body.ativo !== undefined) {
    await execute("UPDATE usuarios SET ativo = ? WHERE id = ?", [body.ativo ? 1 : 0, id])

    await registrarLog({
      acao: body.ativo ? "usuario_editado" : "usuario_desativado",
      descricao: `Usuario ${body.ativo ? "ativado" : "desativado"}: ${existing.nome}`,
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: "usuario",
      entidadeId: String(id),
      entidadeDescricao: existing.nome as string,
      dadosAnteriores: { ativo: Boolean(existing.ativo) },
      dadosNovos: { ativo: body.ativo },
    })
  }

  return NextResponse.json({ success: true })
})
