import { NextResponse } from "next/server"
import { getAuthUserFromRequest } from "@/lib/auth-utils"

export async function GET(request: Request) {
  try {
    const user = await getAuthUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        id: String(user.id),
        nome: user.nome,
        email: user.email,
        cargo: user.cargo,
        role: user.role,
        ativo: Boolean(user.ativo),
        avatar: user.avatar,
        unidade: user.unidade_secretaria
          ? {
              secretaria: user.unidade_secretaria,
              departamento: user.unidade_departamento,
              departamentos: user.departamentosAssistente,
            }
          : undefined,
        secretariasGerenciadas: user.secretariasGerenciadas,
        departamentosAssistente: user.departamentosAssistente,
        podeCadastrarBem: user.pode_cadastrar_bem ?? null,
        podeCadastroProvisorioUnidade: user.pode_cadastro_provisorio_unidade ?? null,
        permissionOverrides: user.permissionOverrides,
        permissions: user.permissions,
        criadoEm: user.criado_em,
        ultimoAcesso: user.ultimo_acesso,
      },
    })
  } catch (error) {
    console.error("Auth check error:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
