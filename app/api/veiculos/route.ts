import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { verifyAuth } from "@/lib/api-auth"

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  console.log("API /api/veiculos chamada")
  const user = await verifyAuth(req)
  if (!user) {
    console.log("Usuario nao autenticado na rota de veiculos")
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
  }
  console.log("Usuario autenticado:", user.nome)

  try {
    const rows = await query("SELECT * FROM bens WHERE categoria_slug LIKE 'veicul%' ORDER BY modelo ASC")
    console.log(`Encontrados ${Array.isArray(rows) ? rows.length : 0} veiculos`)
    
    // Convert DB rows to Asset format expected by frontend
    const assets = (rows as any[]).map(row => {
      try {
        let dataAquisicao = "";
        if (row.data_aquisicao) {
            try {
                const d = new Date(row.data_aquisicao);
                if (!isNaN(d.getTime())) {
                    dataAquisicao = d.toISOString().split("T")[0];
                }
            } catch (e) {
                console.error(`Error parsing date for vehicle ${row.id}:`, e);
            }
        }

        return {
          id: String(row.id),
          patrimonio: row.patrimonio,
          patrimonioProvisorio: row.patrimonio_provisorio || undefined,
          patrimonioTipo: row.patrimonio_tipo,
          descricao: row.descricao,
          categoria: row.categoria_slug,
          localizacao: {
            secretaria: row.localizacao_secretaria,
            departamento: row.localizacao_departamento,
            sala: row.localizacao_sala,
          },
          responsavel: {
            nome: row.responsavel_nome,
            cargo: row.responsavel_cargo,
          },
          dataAquisicao,
          valor: Number(row.valor || 0),
          status: row.status,
          marca: row.marca || undefined,
          modelo: row.modelo || undefined,
          numeroSerie: row.numero_serie || undefined,
          estadoConservacao: row.estado_conservacao || undefined,
          observacoes: row.observacoes || undefined,
          imagem: row.imagem || undefined,
          placa: row.placa || undefined,
          ano: row.ano ? Number(row.ano) : undefined,
          kmAtual: row.km_atual ? Number(row.km_atual) : undefined,
        }
      } catch (err) {
        console.error(`Error mapping vehicle row ${row.id}:`, err);
        return null;
      }
    }).filter(item => item !== null);

    return NextResponse.json(assets)
  } catch (error) {
    console.error("Erro ao buscar veiculos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// POST endpoint removed as vehicle registration should be done via /api/bens (Cadastrar Bem)
// to ensure consistency with the main assets table.

