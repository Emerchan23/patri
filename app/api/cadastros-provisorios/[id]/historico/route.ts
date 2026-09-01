import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { ensureCadastrosProvisoriosSchema } from "@/lib/cadastros-provisorios-schema"
import { getCadastroById, listHistoricoCadastro, serializeHistorico, userCanAccessCadastro } from "@/lib/cadastros-provisorios"

export const GET = withAuth(async (_request, { user, params }) => {
  await ensureCadastrosProvisoriosSchema()
  const id = Number(params?.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Cadastro inválido." }, { status: 400 })
  }

  const cadastro = await getCadastroById(id)
  if (!cadastro) {
    return NextResponse.json({ error: "Cadastro provisório não encontrado." }, { status: 404 })
  }

  if (!userCanAccessCadastro(user, cadastro)) {
    return NextResponse.json({ error: "Sem permissão para acessar este histórico." }, { status: 403 })
  }

  const historico = await listHistoricoCadastro(id)
  return NextResponse.json({ data: historico.map(serializeHistorico) })
})
