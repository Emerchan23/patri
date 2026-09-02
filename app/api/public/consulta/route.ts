import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import crypto from "crypto"
import { cacheGetJson, cacheSetJson, checkRateLimit } from "@/lib/redis-tools"
import { normalizeSmartSearch } from "@/lib/smart-search"

function getClientIp(request: Request) {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  const xri = request.headers.get("x-real-ip")
  if (xri) return xri.trim()
  return "unknown"
}

function cacheKeyForBusca(busca: string) {
  const normalized = busca.trim().toLowerCase()
  const hash = crypto.createHash("sha256").update(normalized).digest("hex")
  return `cache:public:consulta:v1:${hash}`
}

// Public API for Viewer App (No Auth)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const busca = searchParams.get("busca")

  if (!busca) {
    return NextResponse.json({ error: "Parâmetro de busca obrigatório" }, { status: 400 })
  }

  try {
    const ip = getClientIp(request)
    const limit = await checkRateLimit({
      key: `rl:public:consulta:ip:${ip}`,
      limit: 120,
      windowSeconds: 60,
    })
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Muitas consultas. Aguarde um pouco e tente novamente." },
        { status: 429 }
      )
    }

    const key = cacheKeyForBusca(busca)
    const cached = await cacheGetJson<{ status: number; body: any }>(key)
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.status })
    }

    // 1. Check if it's a Room (Sala) - Handle "SALA:ID" format from QR Code
    let salaId = busca;
    let isSalaCode = false;

    if (busca.startsWith("SALA:")) {
      salaId = busca.split(":")[1];
      isSalaCode = true;
    }

    let sala = null;
    
    // If explicitly a room code or if we want to try finding a room
    if (isSalaCode) {
       // Search by ID
       const salaRes = await query("SELECT * FROM salas WHERE id = ?", [salaId]) as any[];
       if (salaRes.length > 0) sala = salaRes[0];
    } else {
       // Try to find sala by Name (legacy/fallback)
       const salaRes = await query("SELECT * FROM salas WHERE nome = ?", [busca]) as any[];
       if (salaRes.length > 0) sala = salaRes[0];
    }

    if (sala) {
      // It's a room. Fetch assets in this room.
      const deptRes = await query("SELECT * FROM departamentos WHERE id = ?", [sala.departamento_id]) as any[]
      const departamento = deptRes.length > 0 ? deptRes[0] : null
      
      let secretaria = null
      if (departamento) {
          const secRes = await query("SELECT * FROM secretarias WHERE id = ?", [departamento.secretaria_id]) as any[]
          secretaria = secRes.length > 0 ? secRes[0] : null
      }

      // Fetch assets in this room
      // Fix: Filter by sala name in JSON or just by location logic if normalized
      // Using 'localizacao->>"$.sala"' is MySQL specific for JSON
      const bensRows = await query(
        `SELECT * FROM bens WHERE localizacao_sala = ? AND status != 'baixado' ORDER BY descricao`,
        [sala.nome]
      ) as any[]

      // Transform rows to match frontend expectations
      const bens = bensRows.map(dbRowToAsset);

      const body = {
        type: 'sala',
        data: {
          sala: sala ? { id: sala.id, nome: sala.nome } : null,
          departamento: departamento ? { id: departamento.id, nome: departamento.nome } : null,
          secretaria: secretaria ? { id: secretaria.id, nome: secretaria.nome } : null,
          bens: bens
        }
      }

      await cacheSetJson(key, { status: 200, body }, 60)
      return NextResponse.json(body)
    }

    // 2. Check if it's an Asset (Bem)
    // Prioritize searching by Patrimonio Code (Definitive or Provisional)
    
    let bem = null
    
    // Clean input for numeric checks
    const buscaTrim = busca.trim();
    const buscaSemZeros = buscaTrim.replace(/^0+/, '');
    
    // Strategy 1: Exact match on Patrimonio or Provisorio (String)
    let bemRes = await query(
        "SELECT * FROM bens WHERE patrimonio = ? OR patrimonio_provisorio = ?", 
        [buscaTrim, buscaTrim]
    ) as any[]
    
    if (bemRes.length > 0) bem = bemRes[0]

    // Accept codes typed without punctuation or case differences.
    if (!bem) {
      const normalized = normalizeSmartSearch(buscaTrim)
      if (normalized) {
        bemRes = await query(
          `SELECT * FROM bens WHERE
           UPPER(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(patrimonio, ''), '-', ''), ' ', ''), '.', ''), '/', '')) = ?
           OR UPPER(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(patrimonio_provisorio, ''), '-', ''), ' ', ''), '.', ''), '/', '')) = ?`,
          [normalized, normalized]
        ) as any[]
        if (bemRes.length === 1) bem = bemRes[0]
      }
    }

    // Short numeric searches are direct only when they identify one asset.
    if (!bem && /^\d+$/.test(buscaTrim)) {
      const digits = buscaTrim.replace(/^0+/, "") || "0"
      bemRes = await query(
        `SELECT * FROM bens WHERE
         UPPER(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(patrimonio, ''), '-', ''), ' ', ''), '.', ''), '/', '')) LIKE ?
         OR UPPER(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(patrimonio_provisorio, ''), '-', ''), ' ', ''), '.', ''), '/', '')) LIKE ?
         LIMIT 20`,
        [`%${digits}`, `%${digits}`]
      ) as any[]
      if (bemRes.length === 1) bem = bemRes[0]
    }

    // Strategy 2: If numeric, try matching without leading zeros (e.g. scanner sends 00123, db has 123)
    if (!bem && buscaTrim !== buscaSemZeros) {
         bemRes = await query(
            "SELECT * FROM bens WHERE patrimonio = ? OR patrimonio_provisorio = ?", 
            [buscaSemZeros, buscaSemZeros]
        ) as any[]
        if (bemRes.length > 0) bem = bemRes[0]
    }

    // Strategy 3: Try ID if numeric (last resort)
    if (!bem && !isNaN(Number(buscaSemZeros))) {
        const bemIdRes = await query("SELECT * FROM bens WHERE id = ?", [buscaSemZeros]) as any[]
        if (bemIdRes.length > 0) bem = bemIdRes[0]
    }

    if (bem) {
        const body = {
            type: 'bem',
            data: dbRowToAsset(bem)
        }
        await cacheSetJson(key, { status: 200, body }, 60)
        return NextResponse.json(body)
    }

    const notFoundBody = { error: "Nenhum registro encontrado" }
    await cacheSetJson(key, { status: 404, body: notFoundBody }, 15)
    return NextResponse.json(notFoundBody, { status: 404 })

  } catch (error) {
    console.error("Erro na consulta pública:", error)
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 })
  }
}

// Helper: convert DB row to Asset format (Optimized for Visualizador App)
function dbRowToAsset(row: any) {
  try {
    let dataAquisicao = "";
    if (row.data_aquisicao) {
        try {
            const d = new Date(row.data_aquisicao);
            if (!isNaN(d.getTime())) {
                dataAquisicao = d.toISOString().split("T")[0];
            }
        } catch (e) {
            // ignore
        }
    }

    // Construct localizacao object compatible with frontend
    // The visualizador app expects `localizacao` to be a Map or String.
    // We provide a Map with keys that match what `_parseLocation` might use.
    // It seems to expect `sala` and `departamento` inside the map.
    const localizacao = {
        sala: row.localizacao_sala,
        departamento: row.localizacao_departamento,
        secretaria: row.localizacao_secretaria,
    };

    // Return object mixing snake_case (for legacy app compatibility) and camelCase
    // The app accesses properties like: item['patrimonio_provisorio'], item['estado_conservacao']
    return {
      id: String(row.id),
      descricao: row.descricao,
      patrimonio: row.patrimonio,
      patrimonio_provisorio: row.patrimonio_provisorio,
      patrimonioProvisorio: row.patrimonio_provisorio,
      categoria: row.categoria_slug,
      grupo: row.grupo || "Geral",
      marca: row.marca || null,
      modelo: row.modelo || null,
      numero_serie: row.numero_serie || null,
      numeroSerie: row.numero_serie || null,
      status: row.status,
      imagem: row.imagem || null,
      fornecedor: row.fornecedor || null,
      estado_conservacao: row.estado_conservacao || null,
      localizacao,
      responsavel: {
        nome: row.responsavel_nome || null,
        cargo: row.responsavel_cargo || null,
      },
      data_aquisicao: dataAquisicao,
      valor: Number(row.valor || 0),
    }
  } catch (err) {
    console.error(`Error mapping asset row ${row.id}:`, err);
    return {
      id: String(row.id),
      descricao: row.descricao || "",
      patrimonio: row.patrimonio || null,
      patrimonio_provisorio: row.patrimonio_provisorio || null,
      patrimonioProvisorio: row.patrimonio_provisorio || null,
      categoria: row.categoria_slug || "",
      grupo: row.grupo || "Geral",
      status: row.status || "ativo",
    }
  }
}
