import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { withRole } from "@/lib/api-auth"
import { hashPassword } from "@/lib/auth-utils"
import { registrarLog } from "@/lib/audit"
import { criarNotificacao } from "@/lib/notifications"

// GET /api/usuarios
export const GET = withRole(["administrador"], async () => {
  const rows = await query<Record<string, unknown>>(
    "SELECT id, nome, email, cargo, role, ativo, avatar, unidade_secretaria, unidade_departamento, criado_em, ultimo_acesso, acesso_app FROM usuarios ORDER BY criado_em DESC"
  )

  const users = []
  for (const row of rows) {
    let secretariasGerenciadas: string[] | undefined
    if (row.role === "gestor") {
      const secs = await query<{ secretaria: string }>(
        "SELECT secretaria FROM secretarias_gerenciadas WHERE usuario_id = ?",
        [row.id]
      )
      secretariasGerenciadas = secs.map((s) => s.secretaria)
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
      avatar: row.avatar,
      unidade: row.unidade_secretaria ? { secretaria: row.unidade_secretaria, departamento: row.unidade_departamento } : undefined,
      secretariasGerenciadas,
      criadoEm: row.criado_em,
      ultimoAcesso: row.ultimo_acesso,
    })
  }

  return NextResponse.json(users)
})

// POST /api/usuarios
export const POST = withRole(["administrador"], async (request, { user }) => {
  const body = await request.json()

  const senhaHash = await hashPassword(body.senha || "senha123")
  const avatar = body.nome
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const result = await execute(
    `INSERT INTO usuarios (nome, email, senha_hash, cargo, role, ativo, acesso_app, avatar, unidade_secretaria, unidade_departamento)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    [
      body.nome, body.email, senhaHash, body.cargo, body.role, body.acessoApp ? 1 : 0, avatar,
      body.unidade?.secretaria || null, body.unidade?.departamento || null,
    ]
  )

  // If gestor, save managed secretarias
  if (body.role === "gestor" && body.secretariasGerenciadas?.length) {
    for (const sec of body.secretariasGerenciadas) {
      await execute("INSERT INTO secretarias_gerenciadas (usuario_id, secretaria) VALUES (?, ?)", [result.insertId, sec])
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
