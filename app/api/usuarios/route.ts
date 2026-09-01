import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { withRole } from "@/lib/api-auth"
import { hashPassword } from "@/lib/auth-utils"
import { registrarLog } from "@/lib/audit"
import { criarNotificacao } from "@/lib/notifications"
import { ensureUserScopeSchema } from "@/lib/user-scope-schema"

// GET /api/usuarios
export const GET = withRole(["administrador"], async () => {
  await ensureUserScopeSchema()
  const rows = await query<Record<string, unknown>>(
    "SELECT id, nome, email, cargo, role, ativo, avatar, unidade_secretaria, unidade_departamento, criado_em, ultimo_acesso, acesso_app, pode_cadastrar_bem, pode_cadastro_provisorio_unidade FROM usuarios ORDER BY criado_em DESC"
  )

  const users = []
  for (const row of rows) {
    let secretariasGerenciadas: string[] | undefined
    let departamentosAssistente: string[] | undefined
    if (row.role === "gestor") {
      const secs = await query<{ secretaria: string }>(
        "SELECT secretaria FROM secretarias_gerenciadas WHERE usuario_id = ?",
        [row.id]
      )
      secretariasGerenciadas = secs.map((s) => s.secretaria)
    } else if (row.role === "assistente") {
      const deps = await query<{ departamento: string }>(
        "SELECT departamento FROM departamentos_assistente WHERE usuario_id = ? AND secretaria = ? ORDER BY departamento",
        [row.id, row.unidade_secretaria]
      )
      departamentosAssistente = deps.map((d) => d.departamento)
    }

    users.push({
      id: String(row.id),
      nome: row.nome,
      email: row.email,
      senha: "", // never return password
      cargo: row.cargo,
      role: row.role,
      ativo: Boolean(row.ativo),
      acessoApp: Boolean(row.acesso_app),
      podeCadastrarBem: row.pode_cadastrar_bem === null || row.pode_cadastrar_bem === undefined ? null : Boolean(row.pode_cadastrar_bem),
      podeCadastroProvisorioUnidade:
        row.pode_cadastro_provisorio_unidade === null || row.pode_cadastro_provisorio_unidade === undefined
          ? null
          : Boolean(row.pode_cadastro_provisorio_unidade),
      avatar: row.avatar,
      unidade: row.unidade_secretaria ? {
        secretaria: row.unidade_secretaria,
        departamento: row.unidade_departamento,
        departamentos: departamentosAssistente?.length ? departamentosAssistente : row.unidade_departamento ? [row.unidade_departamento as string] : [],
      } : undefined,
      secretariasGerenciadas,
      departamentosAssistente,
      criadoEm: row.criado_em,
      ultimoAcesso: row.ultimo_acesso,
    })
  }

  return NextResponse.json(users)
})

// POST /api/usuarios
export const POST = withRole(["administrador"], async (request, { user }) => {
  await ensureUserScopeSchema()
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

  const senhaHash = await hashPassword(body.senha || "senha123")
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
  const avatar = body.nome
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const result = await execute(
    `INSERT INTO usuarios (nome, email, senha_hash, cargo, role, ativo, acesso_app, pode_cadastrar_bem, pode_cadastro_provisorio_unidade, avatar, unidade_secretaria, unidade_departamento)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
    [
      body.nome, body.email, senhaHash, body.cargo, body.role, body.acessoApp ? 1 : 0, podeCadastrarBem, podeCadastroProvisorioUnidade, avatar,
      unidadeSecretaria, unidadeDepartamento,
    ]
  )

  // If gestor, save managed secretarias
  if (body.role === "gestor" && body.secretariasGerenciadas?.length) {
    for (const sec of body.secretariasGerenciadas) {
      await execute("INSERT INTO secretarias_gerenciadas (usuario_id, secretaria) VALUES (?, ?)", [result.insertId, sec])
    }
  }

  if (body.role === "assistente" && unidadeSecretaria && departamentosAssistente.length > 0) {
    for (const dep of departamentosAssistente) {
      await execute(
        "INSERT INTO departamentos_assistente (usuario_id, secretaria, departamento) VALUES (?, ?, ?)",
        [result.insertId, unidadeSecretaria, dep]
      )
    }
  }

  await registrarLog({
    acao: "usuario_criado",
    descricao: `Novo usuario criado: ${body.nome}`,
    detalhes: `Perfil: ${body.role} - ${body.cargo}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "usuario",
    entidadeId: String(result.insertId),
    entidadeDescricao: body.nome,
    dadosNovos: { role: body.role, email: body.email },
  })

  await criarNotificacao({
    roleDestino: "administrador",
    titulo: "Novo usuario cadastrado",
    mensagem: `${body.nome} foi cadastrado como ${body.role}.`,
    tipo: "info",
    link: "admin-usuarios",
  })

  return NextResponse.json({ id: result.insertId }, { status: 201 })
})
