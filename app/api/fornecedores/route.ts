import { NextResponse } from "next/server"
import { query, execute, queryOne } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

const normalizeDocument = (value: unknown) => String(value || "").replace(/\D/g, "")

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

async function ensureColumnsExist() {
  const addColumn = async (table: string, column: string, type: string) => {
    try {
      await execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      console.log(`Column ${column} added to ${table}`);
    } catch (e: any) {
      // Ignore if exists
    }
  };

  await addColumn('fornecedores', 'razao_social', 'VARCHAR(255) DEFAULT NULL');
  await addColumn('fornecedores', 'estado', 'VARCHAR(2) DEFAULT NULL');
  await addColumn('fornecedores', 'cidade', 'VARCHAR(100) DEFAULT NULL');
  await addColumn('fornecedores', 'nome_fantasia', 'VARCHAR(255) DEFAULT NULL');
  await addColumn('fornecedores', 'telefone', 'VARCHAR(50) DEFAULT NULL');
  await addColumn('fornecedores', 'endereco', 'TEXT DEFAULT NULL');
}

export const POST = withAuth(async (request, { user }) => {
  const body = await request.json()
  const documentoInformado = body.cnpj || body.cpf || body.documento
  const normalizedDocument = normalizeDocument(documentoInformado)
  
  if (!body.nome || !normalizedDocument) {
    return NextResponse.json({ error: "Nome e documento do fornecedor são obrigatórios" }, { status: 400 })
  }

  try {
    const existing = await queryOne<{
      id: number
      nome: string
      nome_fantasia?: string | null
      razao_social?: string | null
      cnpj?: string | null
    }>(
      "SELECT id, nome, nome_fantasia, razao_social, cnpj FROM fornecedores WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', '') = ?",
      [normalizedDocument]
    )
    
    if (existing) {
      return NextResponse.json(
        {
          error: "Fornecedor com este documento já cadastrado.",
          existingSupplier: {
            id: String(existing.id),
            nome: existing.nome_fantasia || existing.nome || existing.razao_social || body.nome,
            documento: existing.cnpj || documentoInformado,
          },
        },
        { status: 409 }
      )
    }

    const insertQuery = "INSERT INTO fornecedores (nome, cnpj, razao_social, estado, cidade, nome_fantasia, telefone, endereco) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    const values = [
      body.nome, 
      documentoInformado, 
      body.razao_social || null, 
      body.estado || null, 
      body.cidade || null, 
      body.nome_fantasia || body.nome, 
      body.telefone || null,
      body.endereco || null
    ];

    const result = await execute(insertQuery, values)

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

    return NextResponse.json(
      {
        id: result.insertId,
        nome: body.nome_fantasia || body.nome,
        documento: documentoInformado,
      },
      { status: 201 }
    )
  } catch (error: any) {
    // If column missing, try to fix and retry once
    if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.log("Detectado erro de coluna ausente, tentando corrigir schema...");
        await ensureColumnsExist();
        try {
            const insertQuery = "INSERT INTO fornecedores (nome, cnpj, razao_social, estado, cidade, nome_fantasia, telefone, endereco) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
            const values = [
              body.nome, 
              documentoInformado, 
              body.razao_social || null, 
              body.estado || null, 
              body.cidade || null, 
              body.nome_fantasia || body.nome, 
              body.telefone || null,
              body.endereco || null
            ];
            const resultRetry = await execute(insertQuery, values);
            return NextResponse.json(
              {
                id: resultRetry.insertId,
                nome: body.nome_fantasia || body.nome,
                documento: documentoInformado,
              },
              { status: 201 }
            );
        } catch (retryError: any) {
            console.error("Erro ao criar fornecedor após retry:", retryError);
            return NextResponse.json({ error: "Erro ao criar fornecedor: " + retryError.message }, { status: 500 });
        }
    }

    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: "Fornecedor com este documento já cadastrado." }, { status: 409 })
    }
    console.error("Erro ao criar fornecedor:", error)
    return NextResponse.json({ error: "Erro ao criar fornecedor." }, { status: 500 })
  }
})
