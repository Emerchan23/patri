import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

export const GET = withAuth(async () => {
  const rows = await query("SELECT * FROM fornecedores ORDER BY nome")
  const data = (rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    nome: row.nome,
    cnpj: row.cnpj,
    nome_fantasia: row.nome_fantasia,
    razao_social: row.razao_social,
    estado: row.estado,
    cidade: row.cidade,
    telefone: row.telefone,
    endereco: row.endereco,
  }))
  return NextResponse.json(data)
})

export const POST = withAuth(async (request, { user }) => {
  const body = await request.json()
  
  if (!body.nome || !body.cnpj) {
    return NextResponse.json({ error: "Nome e CNPJ são obrigatórios" }, { status: 400 })
  }

  try {
    const result = await execute(
      "INSERT INTO fornecedores (nome, cnpj, razao_social, estado, cidade, nome_fantasia, telefone, endereco) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        body.nome, 
        body.cnpj, 
        body.razao_social || null, 
        body.estado || null, 
        body.cidade || null, 
        body.nome_fantasia || body.nome, // Use nome as default for nome_fantasia if missing
        body.telefone || null,
        body.endereco || null
      ]
    )

    await registrarLog({
      acao: "cadastro",
      descricao: `Fornecedor criado: ${body.nome}`,
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: "fornecedor",
      entidadeId: String(result.insertId),
      entidadeDescricao: body.nome
    })

    return NextResponse.json({ id: result.insertId }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: "Fornecedor com este CNPJ já cadastrado." }, { status: 409 })
    }
    console.error("Erro ao criar fornecedor:", error)
    return NextResponse.json({ error: "Erro ao criar fornecedor." }, { status: 500 })
  }
})
