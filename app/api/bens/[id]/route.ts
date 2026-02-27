import { NextResponse } from "next/server"
import { queryOne, execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import { criarNotificacao } from "@/lib/notifications"
import { saveImageToDisk } from "@/lib/image-utils"
import fs from "fs"
import path from "path"
import crypto from "crypto"

// Helper to save base64 image to disk
// Removida funcao duplicada, usando lib/image-utils

// GET /api/bens/[id]
export const GET = withAuth(async (_request, { params }) => {
  const id = params?.id
  const row = await queryOne<Record<string, unknown>>("SELECT * FROM bens WHERE id = ?", [id])
  if (!row) {
    return NextResponse.json({ error: "Bem nao encontrado" }, { status: 404 })
  }
  return NextResponse.json(dbRowToAsset(row))
})

// PUT /api/bens/[id] - Update asset
export const PUT = withAuth(async (request, { user, params }) => {
  const id = params?.id
  let body;
  try {
    body = await request.json();
  } catch (error) {
    console.error("Erro ao ler JSON do request (provavelmente body muito grande):", error);
    return NextResponse.json({ error: "Payload invalido ou muito grande" }, { status: 413 });
  }
  
  console.log("Recebendo PUT bem:", { id, bodyPatrimonio: body.patrimonio, bodyTipo: body.patrimonioTipo })

  const existing = await queryOne<Record<string, unknown>>("SELECT * FROM bens WHERE id = ?", [id])
  if (!existing) {
    return NextResponse.json({ error: "Bem nao encontrado" }, { status: 404 })
  }

  // Handle image upload if present (base64 -> file)
  const imagePath = saveImageToDisk(body.imagem) || existing.imagem;

  const result = await execute(
    `UPDATE bens SET descricao=?, categoria_slug=?, grupo=?, localizacao_secretaria=?, localizacao_departamento=?,
     localizacao_sala=?, responsavel_nome=?, responsavel_cargo=?, data_aquisicao=?, valor=?, status=?,
     marca=?, modelo=?, numero_serie=?, estado_conservacao=?, observacoes=?, imagem=?,
     placa=?, ano=?, km_atual=?, patrimonio=?, patrimonio_tipo=?, motivo_baixa=?, tempo_garantia=? WHERE id=?`,
    [
      body.descricao ?? existing.descricao, body.categoria ?? existing.categoria_slug, body.grupo ?? existing.grupo,
      body.localizacao?.secretaria ?? existing.localizacao_secretaria, body.localizacao?.departamento ?? existing.localizacao_departamento, body.localizacao?.sala ?? existing.localizacao_sala,
      body.responsavel?.nome ?? existing.responsavel_nome, body.responsavel?.cargo ?? existing.responsavel_cargo,
      body.dataAquisicao ?? existing.data_aquisicao, body.valor ?? existing.valor, body.status ?? existing.status,
      body.marca ?? existing.marca, body.modelo ?? existing.modelo, body.numeroSerie ?? existing.numero_serie,
      body.estadoConservacao ?? existing.estado_conservacao, body.observacoes ?? existing.observacoes, imagePath,
      body.placa ?? existing.placa, body.ano ?? existing.ano, body.kmAtual ?? existing.km_atual,
      body.patrimonio ?? existing.patrimonio,
      body.patrimonioTipo ?? existing.patrimonio_tipo,
      body.motivo_baixa ?? existing.motivo_baixa,
      body.tempoGarantia ?? existing.tempo_garantia,
      id,
    ]
  )

  // @ts-ignore
  if (result.affectedRows === 0) {
    console.warn("Update bem: Nenhuma linha afetada para id", id)
  } else {
    console.log("Update bem: Sucesso para id", id)
  }

  await registrarLog({
    acao: "edicao",
    descricao: `Bem editado: ${body.descricao}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "bem",
    entidadeId: String(id),
    entidadeDescricao: body.descricao,
  })

  return NextResponse.json({ success: true })
})

// PATCH /api/bens/[id] - Partial update (status, patrimonio definitivo)
export const PATCH = withAuth(async (request, { user, params }) => {
  const id = params?.id
  const body = await request.json()

  const existing = await queryOne<Record<string, unknown>>("SELECT * FROM bens WHERE id = ?", [id])
  if (!existing) {
    return NextResponse.json({ error: "Bem nao encontrado" }, { status: 404 })
  }

  // Change status
  if (body.status) {
    await execute("UPDATE bens SET status = ?, motivo_baixa = ? WHERE id = ?", [
      body.status, 
      body.status === 'baixado' ? (body.motivo || null) : null,
      id
    ])

    const acaoMap: Record<string, string> = {
      baixado: "baixa",
      em_manutencao: "manutencao",
    }

    await registrarLog({
      acao: acaoMap[body.status] || "edicao",
      descricao: `Status alterado para ${body.status}: ${existing.descricao}`,
      detalhes: body.motivo || undefined,
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: "bem",
      entidadeId: String(id),
      entidadeDescricao: existing.descricao as string,
      dadosAnteriores: { status: existing.status },
      dadosNovos: { status: body.status },
    })

    if (body.status === "em_manutencao") {
      await criarNotificacao({
        roleDestino: "gestor",
        titulo: "Bem em manutencao",
        mensagem: `${existing.descricao} foi enviado para manutencao.`,
        tipo: "warning",
        link: "bens",
      })
    }

    return NextResponse.json({ success: true })
  }

  // Assign patrimonio definitivo
  if (body.patrimonioDefinitivo) {
    await execute(
      "UPDATE bens SET patrimonio = ?, patrimonio_tipo = 'definitivo', patrimonio_provisorio = patrimonio WHERE id = ?",
      [body.patrimonioDefinitivo, id]
    )

    await registrarLog({
      acao: "patrimonio_definitivo",
      descricao: `Patrimonio definitivo atribuido: ${existing.descricao}`,
      detalhes: `Provisorio ${existing.patrimonio} convertido para ${body.patrimonioDefinitivo}`,
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: "bem",
      entidadeId: String(id),
      entidadeDescricao: existing.descricao as string,
      dadosAnteriores: { patrimonio: existing.patrimonio, tipo: "provisorio" },
      dadosNovos: { patrimonio: body.patrimonioDefinitivo, tipo: "definitivo" },
    })

    await criarNotificacao({
      roleDestino: "assistente",
      titulo: "Patrimonio definitivo atribuido",
      mensagem: `${existing.descricao} recebeu patrimonio definitivo ${body.patrimonioDefinitivo}.`,
      tipo: "success",
      link: "bens",
    })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Nenhuma acao especificada" }, { status: 400 })
})

// DELETE /api/bens/[id]
export const DELETE = withAuth(async (request, { user, params }) => {
  const id = params?.id
  const body = await request.json().catch(() => ({}))
  const { motivo } = body

  if (!motivo) {
    return NextResponse.json({ error: "Motivo da exclusão é obrigatório" }, { status: 400 })
  }

  const existing = await queryOne<Record<string, unknown>>("SELECT * FROM bens WHERE id = ?", [id])
  if (!existing) {
    return NextResponse.json({ error: "Bem nao encontrado" }, { status: 404 })
  }

  await execute("DELETE FROM bens WHERE id = ?", [id])

  await registrarLog({
    acao: "exclusao",
    descricao: `Bem excluido: ${existing.descricao}`,
    detalhes: motivo,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "bem",
    entidadeId: String(id),
    entidadeDescricao: existing.descricao as string,
    dadosAnteriores: { patrimonio: existing.patrimonio, status: existing.status, valor: existing.valor },
  })

  return NextResponse.json({ success: true })
})

function dbRowToAsset(row: Record<string, unknown>) {
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
    dataAquisicao: row.data_aquisicao ? new Date(row.data_aquisicao as string).toISOString().split("T")[0] : "",
    valor: Number(row.valor),
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
    motivo_baixa: row.motivo_baixa || undefined,
    tempoGarantia: row.tempo_garantia ? Number(row.tempo_garantia) : undefined,
  }
}
