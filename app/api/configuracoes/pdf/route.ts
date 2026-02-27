import { NextResponse } from "next/server"
import { queryOne, execute, query } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

// GET /api/configuracoes/pdf
export const GET = withAuth(async () => {
  const row = await queryOne<Record<string, unknown>>("SELECT * FROM pdf_settings LIMIT 1")
  if (!row) {
    return NextResponse.json({
      nomeOrgao: "Prefeitura Municipal de Exemplo",
      subtitulo: "Secretaria de Administracao - Departamento de Patrimonio",
      endereco: "Rua Principal, 100 - Centro - CEP 12345-678",
      telefone: "(11) 3456-7890",
      email: "patrimonio@prefeitura.gov.br",
      site: "www.prefeitura.gov.br",
      cnpj: "12.345.678/0001-90",
      logoUrl: null,
      rodape: "Documento gerado pelo SisPatrimonio",
      mostrarLogo: true,
      mostrarDataHora: true,
      mostrarNumeroPagina: true,
      mostrarAssinatura: true,
      assinaturaTexto: "Responsavel pelo Patrimonio",
      assinaturaCargo: "Chefe do Departamento de Patrimonio",
    })
  }

  return NextResponse.json({
    nomeOrgao: row.nome_orgao,
    subtitulo: row.subtitulo,
    endereco: row.endereco,
    telefone: row.telefone,
    email: row.email,
    site: row.site,
    cnpj: row.cnpj,
    logoUrl: row.logo_url || null,
    rodape: row.rodape,
    mostrarLogo: Boolean(row.mostrar_logo),
    mostrarDataHora: Boolean(row.mostrar_data_hora),
    mostrarNumeroPagina: Boolean(row.mostrar_numero_pagina),
    mostrarAssinatura: Boolean(row.mostrar_assinatura),
    assinaturaTexto: row.assinatura_texto,
    assinaturaCargo: row.assinatura_cargo,
  })
})

// PUT /api/configuracoes/pdf
export const PUT = withAuth(async (request, { user }) => {
  const body = await request.json()

  const existing = await query<Record<string, unknown>>("SELECT * FROM pdf_settings LIMIT 1")

  if (existing.length > 0) {
    await execute(
      `UPDATE pdf_settings SET nome_orgao=?, subtitulo=?, endereco=?, telefone=?, email=?, site=?, cnpj=?,
       logo_url=?, rodape=?, mostrar_logo=?, mostrar_data_hora=?, mostrar_numero_pagina=?,
       mostrar_assinatura=?, assinatura_texto=?, assinatura_cargo=? WHERE id=?`,
      [
        body.nomeOrgao, body.subtitulo, body.endereco, body.telefone, body.email, body.site, body.cnpj,
        body.logoUrl || null, body.rodape, body.mostrarLogo ? 1 : 0, body.mostrarDataHora ? 1 : 0,
        body.mostrarNumeroPagina ? 1 : 0, body.mostrarAssinatura ? 1 : 0,
        body.assinaturaTexto, body.assinaturaCargo,
        existing[0].id,
      ]
    )
  } else {
    await execute(
      `INSERT INTO pdf_settings (nome_orgao, subtitulo, endereco, telefone, email, site, cnpj,
       logo_url, rodape, mostrar_logo, mostrar_data_hora, mostrar_numero_pagina,
       mostrar_assinatura, assinatura_texto, assinatura_cargo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.nomeOrgao, body.subtitulo, body.endereco, body.telefone, body.email, body.site, body.cnpj,
        body.logoUrl || null, body.rodape, body.mostrarLogo ? 1 : 0, body.mostrarDataHora ? 1 : 0,
        body.mostrarNumeroPagina ? 1 : 0, body.mostrarAssinatura ? 1 : 0,
        body.assinaturaTexto, body.assinaturaCargo,
      ]
    )
  }

  await registrarLog({
    acao: "edicao",
    descricao: "Configuracoes de PDF atualizadas",
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "configuracao",
    entidadeId: "pdf",
    entidadeDescricao: "Configuracoes de Relatorios PDF",
    dadosAnteriores: existing.length > 0 ? existing[0] : undefined,
    dadosNovos: body
  })

  return NextResponse.json({ success: true })
})
