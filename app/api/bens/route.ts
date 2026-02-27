import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import { criarNotificacao } from "@/lib/notifications"
import { saveImageToDisk } from "@/lib/image-utils"
import fs from "fs"
import path from "path"
import crypto from "crypto"

// Helper to save base64 image to disk
// Removida funcao duplicada, usando lib/image-utils

// GET /api/bens - List assets with filters
export const GET = withAuth(async (request, { user }) => {
  const url = new URL(request.url)
  const secretaria = url.searchParams.get("secretaria")
  const departamento = url.searchParams.get("departamento")
  const sala = url.searchParams.get("sala")
  const categoria = url.searchParams.get("categoria")
  const grupo = url.searchParams.get("grupo")
  const status = url.searchParams.get("status")
  const tipo = url.searchParams.get("tipo")
  const busca = url.searchParams.get("busca")
  const patrimonio = url.searchParams.get("patrimonio")
  const provisorios = url.searchParams.get("provisorios")
  const veiculos = url.searchParams.get("veiculos")
  const emGarantia = url.searchParams.get("em_garantia")
  
  const page = parseInt(url.searchParams.get("page") || "1")
  const limit = parseInt(url.searchParams.get("limit") || "20")
  const offset = (page - 1) * limit

  let whereClause = "WHERE 1=1"
  const params: unknown[] = []

  // If assistente, limit to their unit
  if (user.role === "assistente" && user.unidade_secretaria) {
    whereClause += " AND localizacao_secretaria = ? AND localizacao_departamento = ?"
    params.push(user.unidade_secretaria, user.unidade_departamento)
  }

  if (patrimonio) {
    whereClause += " AND (patrimonio = ? OR patrimonio_provisorio = ?)"
    params.push(patrimonio, patrimonio)
  }

  if (secretaria) {
    whereClause += " AND localizacao_secretaria = ?"
    params.push(secretaria)
  }

  if (departamento) {
    whereClause += " AND localizacao_departamento = ?"
    params.push(departamento)
  }

  if (sala) {
    whereClause += " AND localizacao_sala LIKE ?"
    params.push(`%${sala}%`)
  }

  if (categoria) {
    whereClause += " AND categoria_slug = ?"
    params.push(categoria)
  }

  if (grupo) {
    whereClause += " AND grupo = ?"
    params.push(grupo)
  }

  if (status) {
    whereClause += " AND status = ?"
    params.push(status)
  }

  if (tipo) {
    whereClause += " AND patrimonio_tipo = ?"
    params.push(tipo)
  }

  if (provisorios === "true") {
    whereClause += " AND patrimonio_tipo = 'provisorio'"
  }

  if (veiculos === "true") {
    whereClause += " AND categoria_slug = 'veiculo'"
  } else if (veiculos === "false") {
    whereClause += " AND categoria_slug != 'veiculo'"
  }

  if (emGarantia === "true") {
    whereClause += " AND tempo_garantia > 0 AND DATE_ADD(data_aquisicao, INTERVAL tempo_garantia MONTH) >= CURDATE()"
  } else if (emGarantia === "false") {
    whereClause += " AND (tempo_garantia IS NULL OR tempo_garantia = 0 OR DATE_ADD(data_aquisicao, INTERVAL tempo_garantia MONTH) < CURDATE())"
  }

  if (busca) {
    whereClause += " AND (patrimonio LIKE ? OR descricao LIKE ? OR responsavel_nome LIKE ? OR marca LIKE ? OR modelo LIKE ? OR numero_serie LIKE ? OR localizacao_secretaria LIKE ?)"
    const term = `%${busca}%`
    params.push(term, term, term, term, term, term, term)
  }

  // Count total records
  const countSql = `SELECT COUNT(*) as total FROM bens ${whereClause}`
  const countResult = await query(countSql, params) as any[]
  const total = countResult[0]?.total || 0
  const totalPages = Math.ceil(total / limit)

  // Calculate next provisional sequence (lightweight query)
  // Assumes format PROV-YYYY-XXXXX
  const currentYear = new Date().getFullYear().toString()
  const maxProvResult = await query(
    `SELECT patrimonio_provisorio FROM bens 
     WHERE patrimonio_provisorio LIKE ? 
     ORDER BY LENGTH(patrimonio_provisorio) DESC, patrimonio_provisorio DESC 
     LIMIT 1`,
    [`PROV-${currentYear}-%`]
  ) as { patrimonio_provisorio: string }[]
  
  let nextSeq = 1
  if (maxProvResult.length > 0) {
    const lastProv = maxProvResult[0].patrimonio_provisorio
    // Extract sequence number (last part)
    const parts = lastProv.split("-")
    if (parts.length >= 3) {
      const seq = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(seq)) {
        nextSeq = seq + 1
      }
    }
  }

  // Get paginated data
  let sql = `SELECT * FROM bens ${whereClause} ORDER BY criado_em DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const rows = await query(sql, params)
  // Transform DB rows to frontend Asset format
  const assets = (rows as Record<string, unknown>[])
    .map(dbRowToAsset)
    .filter((asset): asset is NonNullable<ReturnType<typeof dbRowToAsset>> => asset !== null)

  return NextResponse.json({
    data: assets,
    meta: {
      total,
      page,
      limit,
      totalPages,
      nextProvisionalSeq: nextSeq
    }
  })
})

// POST /api/bens - Create asset
export const POST = withAuth(async (request, { user }) => {
  let body;
  try {
    body = await request.json();
  } catch (error) {
    console.error("Erro ao ler JSON do request (provavelmente body muito grande):", error);
    return NextResponse.json({ error: "Payload invalido ou muito grande" }, { status: 413 });
  }

  // Support batch creation
  if (Array.isArray(body)) {
    const ids: number[] = []
    for (const item of body) {
      // Process image if present
      const imagePath = saveImageToDisk(item.imagem);
      
      const patrimonioFinal = item.patrimonio || item.patrimonioProvisorio;
      if (!patrimonioFinal) {
        throw new Error("Patrimonio ou Patrimonio Provisorio obrigatorio");
      }

      const result = await execute(
        `INSERT INTO bens (patrimonio, patrimonio_provisorio, patrimonio_tipo, descricao, categoria_slug, grupo,
         localizacao_secretaria, localizacao_departamento, localizacao_sala, responsavel_nome, responsavel_cargo,
         data_aquisicao, valor, status, marca, modelo, numero_serie, estado_conservacao, observacoes, imagem, placa, ano, km_atual, tempo_garantia, fornecedor)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          patrimonioFinal, item.patrimonioProvisorio || null, item.patrimonioTipo || "provisorio",
          item.descricao, item.categoria, item.grupo || "Geral",
          item.localizacao?.secretaria || "Não Informado", item.localizacao?.departamento || "Não Informado", item.localizacao?.sala || "Não Informado",
          item.responsavel?.nome || "Não Informado", item.responsavel?.cargo || "Não Informado",
          item.dataAquisicao, item.valor || 0, item.status || "ativo",
          item.marca || null, item.modelo || null, item.numeroSerie || null,
          item.estadoConservacao || null, item.observacoes || null, imagePath || null,
          item.placa || null, item.ano || null, item.kmAtual || null, item.tempoGarantia || null,
          item.fornecedor || null,
        ]
      )
      ids.push(result.insertId)
    }

    await registrarLog({
      acao: "entrada_nf",
      descricao: `Entrada em lote: ${body.length} itens cadastrados`,
      detalhes: body.map((b: Record<string, unknown>) => b.descricao).join(", "),
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      dadosNovos: { totalItens: body.length },
    })

    await criarNotificacao({
      roleDestino: "gestor",
      titulo: "Novos bens cadastrados em lote",
      mensagem: `${body.length} bens foram cadastrados por ${user.nome}.`,
      tipo: "info",
      link: "bens",
    })

    return NextResponse.json({ ids, count: ids.length }, { status: 201 })
  }

  // Single creation (supports quantity loop)
  // Process image if present
  const imagePath = saveImageToDisk(body.imagem);

  const quantidade = Math.max(1, parseInt(String(body.quantidade || 1)));
  const ids: number[] = [];

  // Logic to determine initial sequence if AUTO is requested
  let currentSeq = 0;
  let basePatrimonioPattern = "";
  
  const rawPatrimonio = body.patrimonio || body.patrimonioProvisorio || "";
  if (rawPatrimonio.includes("AUTO")) {
    // Extract prefix, e.g., "PROV-2026-" from "PROV-2026-AUTO"
    basePatrimonioPattern = rawPatrimonio.split("AUTO")[0]; 
    
    // Fetch all existing provisional codes for this year/prefix
    const rows = await query(
        `SELECT patrimonio_provisorio FROM bens WHERE patrimonio_provisorio LIKE ?`, 
        [`${basePatrimonioPattern}%`]
    ) as { patrimonio_provisorio: string }[];

    // Also check etiquetas_provisorias to avoid collision with printed but unused tags
    const tagRows = await query(
        `SELECT codigo FROM etiquetas_provisorias WHERE codigo LIKE ?`,
        [`${basePatrimonioPattern}%`]
    ) as { codigo: string }[];

    // Create a Set of all used sequence numbers
    const usedSequences = new Set<number>();

    // Helper to extract sequence number
    const extractSeq = (code: string) => {
        if (!code) return;
        const suffix = code.replace(basePatrimonioPattern, "");
        if (/^\d+$/.test(suffix)) {
            const val = parseInt(suffix, 10);
            if (val > 0 && val < 1000000) { // Safety limit 1M
                usedSequences.add(val);
            }
        }
    };

    // Check bens
    for (const row of rows) {
        extractSeq(row.patrimonio_provisorio);
    }

    // Check tags
    for (const row of tagRows) {
        extractSeq(row.codigo);
    }
    
    // Find the first available sequence starting from 1
    let nextSeq = 1;
    while (usedSequences.has(nextSeq)) {
        nextSeq++;
    }
    
    // We use nextSeq - 1 because later we do currentSeq++
    currentSeq = nextSeq - 1;
  }

  for (let i = 0; i < quantidade; i++) {
    let patrimonioFinal = body.patrimonio || body.patrimonioProvisorio;

    if (!patrimonioFinal) {
      return NextResponse.json({ error: "Patrimonio ou Patrimonio Provisorio obrigatorio" }, { status: 400 });
    }

    // Handle AUTO generation
    if (patrimonioFinal.includes("AUTO")) {
      currentSeq++;
      // Format with leading zeros, e.g. 00001
      const seqStr = currentSeq.toString().padStart(5, '0');
      patrimonioFinal = patrimonioFinal.replace("AUTO", seqStr);
    } else if (quantidade > 1 && i > 0) {
      // If not AUTO but quantity > 1, append index to avoid duplicate key
      // This fallback logic remains for definitive IDs if user manually types one and asks for qty > 1
      patrimonioFinal = `${patrimonioFinal}-${i + 1}`;
    }

    // Determine values for DB columns
    // If provisorio, both columns usually get the same value or provisorio column gets it
    const dbPatrimonio = patrimonioFinal;
    const dbProvisorio = body.patrimonioTipo === "provisorio" ? patrimonioFinal : (body.patrimonioProvisorio || null);

    // If using a provisional code (AUTO or Manual), mark it as used in etiquetas_provisorias
    if (dbProvisorio) {
        // Try to insert (ignore if exists) or update status
        // We use INSERT IGNORE to handle cases where it wasn't pre-generated
        // Then UPDATE to mark as used
        
        // Check if exists first to decide action or just try update
        // Easiest is to try update, if 0 rows affected, insert as used
        const updateResult = await execute(
            `UPDATE etiquetas_provisorias SET status = 'em_uso' WHERE codigo = ?`,
            [dbProvisorio]
        );
        
        if (updateResult.affectedRows === 0) {
             // Tag didn't exist, create it as used
             await execute(
                `INSERT INTO etiquetas_provisorias (codigo, status) VALUES (?, 'em_uso')`,
                [dbProvisorio]
             ).catch(e => console.log("Tag insert ignored/failed (race condition?):", e.message));
        }
    }

    const result = await execute(
      `INSERT INTO bens (patrimonio, patrimonio_provisorio, patrimonio_tipo, descricao, categoria_slug, grupo,
       localizacao_secretaria, localizacao_departamento, localizacao_sala, responsavel_nome, responsavel_cargo,
       data_aquisicao, valor, status, marca, modelo, numero_serie, estado_conservacao, observacoes, imagem, placa, ano, km_atual, tempo_garantia, fornecedor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dbPatrimonio, dbProvisorio, body.patrimonioTipo || "provisorio",
        body.descricao, body.categoria, body.grupo || "Geral",
        body.localizacao?.secretaria || "Não Informado", body.localizacao?.departamento || "Não Informado", body.localizacao?.sala || "Não Informado",
        body.responsavel?.nome || "Não Informado", body.responsavel?.cargo || "Não Informado",
        body.dataAquisicao || new Date().toISOString().split('T')[0], body.valor || 0, body.status || "ativo",
        body.marca || null, body.modelo || null, body.numeroSerie || null,
        body.estadoConservacao || null, body.observacoes || null, imagePath || null,
        body.placa || null, body.ano || null, body.kmAtual || null, body.tempoGarantia || null,
        body.fornecedor || null,
      ]
    )
    ids.push(result.insertId);
  }

  // Log only once for the batch/single operation
  await registrarLog({
    acao: "cadastro",
    descricao: `Novo(s) bem(ns) cadastrado(s): ${body.descricao}`,
    detalhes: `Quantidade: ${quantidade}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "bem",
    entidadeId: String(ids[0]), // Link to first ID
    entidadeDescricao: body.descricao,
    dadosNovos: { quantidade, categoria: body.categoria, valor: body.valor },
  })

  if (body.patrimonioTipo === "provisorio") {
    await criarNotificacao({
      roleDestino: "gestor",
      titulo: "Bem(ns) aguardando patrimonio definitivo",
      mensagem: `${quantidade}x ${body.descricao} foram cadastrados com patrimonio provisorio.`,
      tipo: "warning",
      link: "pendencias",
    })
  }

  return NextResponse.json({ id: ids[0], ids, count: ids.length }, { status: 201 })
})

// Helper: convert DB row to Asset format
function dbRowToAsset(row: Record<string, unknown>) {
  try {
    let dataAquisicao = "";
    if (row.data_aquisicao) {
        try {
            const d = new Date(row.data_aquisicao as string | Date);
            if (!isNaN(d.getTime())) {
                dataAquisicao = d.toISOString().split("T")[0];
            }
        } catch (e) {
            console.error(`Error parsing date for asset ${row.id}:`, e);
        }
    }

    return {
      id: String(row.id),
      patrimonio: row.patrimonio,
      patrimonioProvisorio: row.patrimonio_provisorio || undefined,
      patrimonioTipo: row.patrimonio_tipo,
      descricao: row.descricao,
      categoria: row.categoria_slug,
      grupo: row.grupo || "Geral",
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
      tempoGarantia: row.tempo_garantia ? Number(row.tempo_garantia) : undefined,
      fornecedor: row.fornecedor || undefined,
    }
  } catch (err) {
    console.error(`Error mapping asset row ${row.id}:`, err);
    return null;
  }
}
