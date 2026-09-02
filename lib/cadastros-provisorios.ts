import type mysql from "mysql2/promise"
import { execute, query, queryOne } from "./db"
import { getEtiquetaSequenceInfo } from "./etiquetas-sequence"
import type { ScopedDbUser } from "./auth-utils"
import { ensureCadastrosProvisoriosSchema } from "./cadastros-provisorios-schema"
import { buildSmartSearch } from "./smart-search"

export type CadastroProvisorioStatus =
  | "rascunho"
  | "enviado_pela_unidade"
  | "em_ajuste_almoxarifado"
  | "em_analise_patrimonio"
  | "devolvido_para_ajuste"
  | "rejeitado"
  | "definitivado"

export interface CadastroProvisorioRecord {
  id: number
  codigo: string | null
  status: CadastroProvisorioStatus
  solicitante_usuario_id: number
  solicitante_nome: string
  origem_secretaria: string
  origem_departamento: string
  origem_sala: string
  descricao: string
  categoria_slug: string
  grupo: string | null
  marca: string | null
  modelo: string | null
  fornecedor: string | null
  numero_serie: string | null
  quantidade: number
  valor: number | null
  estado_conservacao: string
  responsavel_nome: string | null
  responsavel_cargo: string | null
  observacoes: string | null
  imagem: string | null
  nota_fiscal_url: string | null
  emenda_parlamentar: string | null
  tipo_entrada: string
  ajustado_por_usuario_id: number | null
  ajustado_por_nome: string | null
  ajustado_em: string | null
  encaminhado_patrimonio_em: string | null
  aprovado_por_usuario_id: number | null
  aprovado_por_nome: string | null
  aprovado_em: string | null
  rejeitado_por_usuario_id: number | null
  rejeitado_por_nome: string | null
  rejeitado_em: string | null
  motivo_rejeicao: string | null
  devolvido_por_usuario_id: number | null
  devolvido_por_nome: string | null
  devolvido_em: string | null
  motivo_devolucao: string | null
  bem_definitivo_id: number | null
  criado_em: string
  atualizado_em: string
}

interface CadastroHistoricoRecord {
  id: number
  cadastro_provisorio_id: number
  acao: string
  status_anterior: string | null
  status_novo: string | null
  usuario_id: number
  usuario_nome: string
  usuario_role: string
  observacao: string | null
  dados_anteriores: string | null
  dados_novos: string | null
  criado_em: string
}

function normalizeString(value: unknown) {
  const normalized = String(value ?? "").trim()
  return normalized.length > 0 ? normalized : null
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

export function userCanAccessCadastro(user: ScopedDbUser, cadastro: Pick<CadastroProvisorioRecord, "solicitante_usuario_id" | "origem_secretaria" | "origem_departamento">) {
  if (user.role === "administrador") return true
  if (user.role === "gestor") {
    if (!user.secretariasGerenciadas || user.secretariasGerenciadas.length === 0) return true
    return user.secretariasGerenciadas.includes(cadastro.origem_secretaria)
  }

  if (user.role === "assistente") {
    if (Number(cadastro.solicitante_usuario_id) !== Number(user.id)) return false
    if (user.unidade_secretaria !== cadastro.origem_secretaria) return false
    const allowedDepartments =
      user.departamentosAssistente?.length
        ? user.departamentosAssistente
        : user.unidade_departamento
          ? [user.unidade_departamento]
          : []
    return allowedDepartments.length === 0 || allowedDepartments.includes(cadastro.origem_departamento)
  }

  return false
}

export function assistantCanEditCadastro(status: CadastroProvisorioStatus) {
  return status === "rascunho" || status === "devolvido_para_ajuste" || status === "enviado_pela_unidade"
}

export function managerCanEditCadastro(status: CadastroProvisorioStatus) {
  return status !== "rejeitado" && status !== "definitivado"
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function serializeCadastro(row: CadastroProvisorioRecord) {
  return {
    id: String(row.id),
    codigo: row.codigo,
    status: row.status,
    solicitante: {
      id: String(row.solicitante_usuario_id),
      nome: row.solicitante_nome,
    },
    localizacao: {
      secretaria: row.origem_secretaria,
      departamento: row.origem_departamento,
      sala: row.origem_sala,
    },
    descricao: row.descricao,
    categoria: row.categoria_slug,
    grupo: row.grupo || "",
    marca: row.marca || "",
    modelo: row.modelo || "",
    fornecedor: row.fornecedor || "",
    numeroSerie: row.numero_serie || "",
    quantidade: Number(row.quantidade || 1),
    valor: row.valor === null ? null : Number(row.valor),
    estadoConservacao: row.estado_conservacao,
    responsavel: {
      nome: row.responsavel_nome || "",
      cargo: row.responsavel_cargo || "",
    },
    observacoes: row.observacoes || "",
    imagem: row.imagem || null,
    notaFiscal: row.nota_fiscal_url || null,
    emendaParlamentar: row.emenda_parlamentar || "",
    tipoEntrada: row.tipo_entrada,
    fluxo: {
      ajustadoPor: row.ajustado_por_nome || null,
      ajustadoEm: row.ajustado_em,
      encaminhadoPatrimonioEm: row.encaminhado_patrimonio_em,
      aprovadoPor: row.aprovado_por_nome || null,
      aprovadoEm: row.aprovado_em,
      rejeitadoPor: row.rejeitado_por_nome || null,
      rejeitadoEm: row.rejeitado_em,
      motivoRejeicao: row.motivo_rejeicao || "",
      devolvidoPor: row.devolvido_por_nome || null,
      devolvidoEm: row.devolvido_em,
      motivoDevolucao: row.motivo_devolucao || "",
      bemDefinitivoId: row.bem_definitivo_id ? String(row.bem_definitivo_id) : null,
    },
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  }
}

export function serializeHistorico(row: CadastroHistoricoRecord) {
  return {
    id: String(row.id),
    acao: row.acao,
    statusAnterior: row.status_anterior,
    statusNovo: row.status_novo,
    usuario: {
      id: String(row.usuario_id),
      nome: row.usuario_nome,
      role: row.usuario_role,
    },
    observacao: row.observacao || "",
    dadosAnteriores: parseJson<Record<string, unknown>>(row.dados_anteriores),
    dadosNovos: parseJson<Record<string, unknown>>(row.dados_novos),
    criadoEm: row.criado_em,
  }
}

export async function getCadastroById(id: number) {
  await ensureCadastrosProvisoriosSchema()
  return queryOne<CadastroProvisorioRecord>(
    `SELECT *
       FROM cadastros_provisorios_unidade
      WHERE id = ?`,
    [id]
  )
}

export async function listHistoricoCadastro(id: number) {
  await ensureCadastrosProvisoriosSchema()
  return query<CadastroHistoricoRecord>(
    `SELECT *
       FROM cadastros_provisorios_historico
      WHERE cadastro_provisorio_id = ?
      ORDER BY criado_em DESC, id DESC`,
    [id]
  )
}

export async function listCadastrosProvisorios(user: ScopedDbUser, filters?: Record<string, string>) {
  await ensureCadastrosProvisoriosSchema()

  const whereClauses: string[] = []
  const params: unknown[] = []

  if (filters?.status && filters.status !== "todos") {
    whereClauses.push("status = ?")
    params.push(filters.status)
  }

  if (filters?.secretaria && filters.secretaria !== "todas") {
    whereClauses.push("origem_secretaria = ?")
    params.push(filters.secretaria)
  }

  if (filters?.departamento && filters.departamento !== "todos") {
    whereClauses.push("origem_departamento = ?")
    params.push(filters.departamento)
  }

  if (filters?.sala && filters.sala !== "todas") {
    whereClauses.push("origem_sala = ?")
    params.push(filters.sala)
  }

  if (filters?.search) {
    const smart = buildSmartSearch(["codigo", "descricao", "numero_serie", "solicitante_nome", "origem_secretaria", "origem_departamento", "origem_sala"], filters.search)
    whereClauses.push(smart.clause)
    params.push(...smart.params)
  }

  if (user.role === "gestor" && user.secretariasGerenciadas?.length) {
    whereClauses.push(`origem_secretaria IN (${user.secretariasGerenciadas.map(() => "?").join(",")})`)
    params.push(...user.secretariasGerenciadas)
  }

  if (user.role === "assistente") {
    whereClauses.push("solicitante_usuario_id = ?")
    params.push(Number(user.id))
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""
  return query<CadastroProvisorioRecord>(
    `SELECT *
       FROM cadastros_provisorios_unidade
       ${whereSql}
      ORDER BY atualizado_em DESC, id DESC`,
    params
  )
}

export async function inserirHistoricoCadastro(
  cadastroId: number,
  payload: {
    acao: string
    statusAnterior?: string | null
    statusNovo?: string | null
    usuarioId: number
    usuarioNome: string
    usuarioRole: string
    observacao?: string | null
    dadosAnteriores?: Record<string, unknown> | null
    dadosNovos?: Record<string, unknown> | null
  },
  connection?: mysql.PoolConnection
) {
  const executor = connection ?? { execute }
  const sql = `INSERT INTO cadastros_provisorios_historico
      (cadastro_provisorio_id, acao, status_anterior, status_novo, usuario_id, usuario_nome, usuario_role, observacao, dados_anteriores, dados_novos)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  const params = [
    cadastroId,
    payload.acao,
    payload.statusAnterior || null,
    payload.statusNovo || null,
    payload.usuarioId,
    payload.usuarioNome,
    payload.usuarioRole,
    payload.observacao || null,
    payload.dadosAnteriores ? JSON.stringify(payload.dadosAnteriores) : null,
    payload.dadosNovos ? JSON.stringify(payload.dadosNovos) : null,
  ]

  if ("execute" in executor && typeof executor.execute === "function") {
    await executor.execute(sql, params)
  }
}

export async function gerarCodigoCadastroProvisorio(id: number) {
  const year = new Date().getFullYear()
  return `CPU-${year}-${String(id).padStart(5, "0")}`
}

export async function criarBemDefinitivadoAPartirDoCadastro(
  cadastro: CadastroProvisorioRecord,
  connection: mysql.PoolConnection
) {
  const year = new Date().getFullYear().toString()
  let primeiroBemId: number | null = null

  for (let index = 0; index < Math.max(1, Number(cadastro.quantidade || 1)); index++) {
    const sequence = await getEtiquetaSequenceInfo(year, connection)
    const patrimonioProvisorio = sequence.formatted

    const [result] = await connection.execute<mysql.ResultSetHeader>(
      `INSERT INTO bens (patrimonio, patrimonio_provisorio, patrimonio_tipo, descricao, categoria_slug, grupo,
        localizacao_secretaria, localizacao_departamento, localizacao_sala, responsavel_nome, responsavel_cargo,
        data_aquisicao, valor, status, marca, modelo, numero_serie, estado_conservacao, observacoes, imagem,
        placa, ano, km_atual, tempo_garantia, fornecedor, nota_fiscal_url, emenda_parlamentar, tipo_entrada, etiqueta_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patrimonioProvisorio,
        patrimonioProvisorio,
        "provisorio",
        cadastro.descricao,
        cadastro.categoria_slug,
        cadastro.grupo || "Geral",
        cadastro.origem_secretaria,
        cadastro.origem_departamento,
        cadastro.origem_sala,
        cadastro.responsavel_nome || cadastro.solicitante_nome,
        cadastro.responsavel_cargo || null,
        cadastro.valor,
        "ativo",
        cadastro.marca,
        cadastro.modelo,
        cadastro.numero_serie,
        cadastro.estado_conservacao || "novo",
        cadastro.observacoes,
        cadastro.imagem,
        null,
        null,
        null,
        null,
        cadastro.fornecedor,
        cadastro.nota_fiscal_url,
        cadastro.emenda_parlamentar,
        cadastro.tipo_entrada || "compra",
        null,
      ]
    )

    if (!primeiroBemId) {
      primeiroBemId = Number(result.insertId)
    }
  }

  return primeiroBemId
}

export function extractCadastroPayload(body: Record<string, unknown>) {
  return {
    descricao: normalizeString(body.descricao),
    categoria: normalizeString(body.categoria),
    grupo: normalizeString(body.grupo),
    marca: normalizeString(body.marca),
    modelo: normalizeString(body.modelo),
    fornecedor: normalizeString(body.fornecedor),
    numeroSerie: normalizeString(body.numeroSerie),
    quantidade: Math.max(1, Number(body.quantidade || 1)),
    valor: body.valor === null || body.valor === undefined || body.valor === "" ? null : Number(body.valor),
    estadoConservacao: normalizeString(body.estadoConservacao) || "novo",
    secretaria: normalizeString(body.secretaria),
    departamento: normalizeString(body.departamento),
    sala: normalizeString(body.sala),
    responsavelNome: normalizeString(body.responsavelNome),
    responsavelCargo: normalizeString(body.responsavelCargo),
    observacoes: normalizeString(body.observacoes),
    emendaParlamentar: normalizeString(body.emendaParlamentar),
    tipoEntrada: normalizeString(body.tipoEntrada) || "compra",
    imagem: normalizeString(body.imagem),
    notaFiscal: normalizeString(body.notaFiscal),
  }
}
