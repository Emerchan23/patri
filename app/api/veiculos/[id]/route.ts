import { NextResponse } from "next/server"
import { execute, queryOne } from "@/lib/db"
import { withPermission } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import { assertAssetAccess } from "@/lib/asset-scope"

export const PUT = withPermission("gerenciarVeiculos", async (req, { user, params }) => {
  const id = params?.id
  if (!id) return NextResponse.json({ error: "Veiculo invalido" }, { status: 400 })

  let body: Record<string, any>
  try {
    body = await req.json() as Record<string, any>
  } catch {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 })
  }

  const {
    placa,
    modelo,
    ano,
    kmAtual,
    status,
    observacoes,
    patrimonio,
    patrimonioTipo,
    descricao,
    marca,
    valor,
    imagem,
  } = body

  const existing = await queryOne<Record<string, any>>(
    "SELECT * FROM bens WHERE id = ? AND categoria_slug LIKE 'veicul%'",
    [id],
  )
  if (!existing) {
    return NextResponse.json({ error: "Veiculo nao encontrado" }, { status: 404 })
  }
  try {
    await assertAssetAccess(user, id)
  } catch {
    return NextResponse.json({ error: "Sem permissao para acessar este veiculo" }, { status: 403 })
  }

  await execute(
    `UPDATE bens SET placa=?, modelo=?, ano=?, km_atual=?, status=?, observacoes=?, patrimonio=?, patrimonio_tipo=?, descricao=?, marca=?, valor=?, imagem=? WHERE id=? AND categoria_slug LIKE 'veicul%'`,
    [
      placa !== undefined ? placa : existing.placa,
      modelo !== undefined ? modelo : existing.modelo,
      ano !== undefined ? ano : existing.ano,
      kmAtual !== undefined ? kmAtual : existing.km_atual,
      status !== undefined ? status : existing.status,
      observacoes !== undefined ? observacoes : existing.observacoes,
      patrimonio !== undefined ? patrimonio : existing.patrimonio,
      patrimonioTipo !== undefined ? patrimonioTipo : existing.patrimonio_tipo,
      descricao !== undefined ? descricao : existing.descricao,
      marca !== undefined ? marca : existing.marca,
      valor !== undefined ? valor : existing.valor,
      imagem !== undefined ? imagem : existing.imagem,
      id,
    ],
  )

  await registrarLog({
    acao: "edicao",
    descricao: `Veiculo editado: ${modelo || existing.modelo}`,
    detalhes: `Placa: ${placa || existing.placa}, Ano: ${ano || existing.ano}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "veiculo",
    entidadeId: String(id),
    entidadeDescricao: modelo || existing.modelo,
    dadosAnteriores: {
      placa: existing.placa,
      modelo: existing.modelo,
      ano: existing.ano,
      kmAtual: existing.km_atual,
      status: existing.status,
      observacoes: existing.observacoes,
    },
    dadosNovos: { placa, modelo, ano, kmAtual, status, observacoes },
  })

  const updated = await queryOne("SELECT * FROM bens WHERE id = ?", [id])
  return NextResponse.json(updated)
})

export const DELETE = withPermission("excluirBem", async (req, { user, params }) => {
  const id = params?.id
  if (!id) return NextResponse.json({ error: "Veiculo invalido" }, { status: 400 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const motivo = body.motivo
  if (typeof motivo !== "string" || !motivo.trim()) {
    return NextResponse.json({ error: "Motivo da exclusão é obrigatório" }, { status: 400 })
  }
  if (motivo.length > 1000) {
    return NextResponse.json({ error: "Motivo da exclusão muito longo" }, { status: 400 })
  }

  const veiculo = await queryOne<Record<string, any>>(
    "SELECT * FROM bens WHERE id = ? AND categoria_slug LIKE 'veicul%'",
    [id],
  )
  if (!veiculo) {
    return NextResponse.json({ error: "Veiculo nao encontrado" }, { status: 404 })
  }
  try {
    await assertAssetAccess(user, id)
  } catch {
    return NextResponse.json({ error: "Sem permissao para acessar este veiculo" }, { status: 403 })
  }

  await execute(
    "DELETE FROM bens WHERE id = ? AND categoria_slug LIKE 'veicul%'",
    [id],
  )

  await registrarLog({
    acao: "exclusao",
    descricao: `Veículo excluído: ${veiculo.modelo}`,
    detalhes: motivo.trim(),
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "veiculo",
    entidadeId: String(id),
    entidadeDescricao: veiculo.modelo,
    dadosAnteriores: veiculo,
  })

  return NextResponse.json({ ok: true })
})
