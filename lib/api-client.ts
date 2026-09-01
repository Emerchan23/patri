// Centralized API client - all frontend components use this instead of localStorage/mock data

import type { User } from "./auth"

const BASE = "/api"

export class ApiError extends Error {
  status: number
  body?: any

  constructor(message: string, status: number, body?: any) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (isApiError(error)) return error.message || fallback
  if (error instanceof Error) return error.message || fallback
  return fallback
}

// Simple event system for auth expiration
type AuthExpiredCallback = () => void
const authExpiredListeners: AuthExpiredCallback[] = []

export const onAuthExpired = (callback: AuthExpiredCallback) => {
  authExpiredListeners.push(callback)
  return () => {
    const index = authExpiredListeners.indexOf(callback)
    if (index > -1) authExpiredListeners.splice(index, 1)
  }
}

async function request<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = endpoint.startsWith(BASE) ? endpoint : `${BASE}${endpoint}`
  const isMultipart = typeof FormData !== "undefined" && options?.body instanceof FormData
  const res = await fetch(url, {
    headers: isMultipart ? options?.headers : { "Content-Type": "application/json", ...options?.headers },
    credentials: "include",
    ...options,
  })
  if (res.status === 401) {
    // Notify listeners (AuthProvider)
    authExpiredListeners.forEach(cb => cb())
    
    // Session expired - throw error to let components handle redirection if needed
    // DO NOT force reload here, as it causes infinite loops if a component fetches data on mount
    throw new ApiError("Sessao expirada", 401)
  }
  if (!res.ok) {
    const errText = await res.text()
    let errObj
    try {
        errObj = JSON.parse(errText)
    } catch {
        errObj = { error: errText || `Erro ${res.status}` }
    }
    console.error("API Error:", errObj)
    throw new ApiError(errObj.error || `Erro ${res.status}`, res.status, errObj)
  }
  return res.json()
}

export const fetcher = (url: string) => request(url)

export const api = {
  // Auth
  login: (email: string, senha: string) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, senha }) }),
  logout: () =>
    request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),

  // Dashboard
  dashboardStats: (params?: string) => request(`/dashboard/stats${params ? `?${params}` : ""}`),

  // Bens
  getBens: (params?: string) => request(`/bens${params ? `?${params}` : ""}`),
  getBem: (id: number | string) => request(`/bens/${id}`),
  createBem: (data: any) =>
    request("/bens", { method: "POST", body: JSON.stringify(data) }),
  validateBemCodes: (codes: Array<{ code: string; field?: "patrimonio" | "patrimonioProvisorio"; itemIndex?: number }>) =>
    request("/bens/disponibilidade", { method: "POST", body: JSON.stringify({ codes }) }),
  updateBem: (id: number | string, data: any) =>
    request(`/bens/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateBemEtiquetaFluxo: (id: number | string, action: "marcar_enviada" | "confirmar_colada" | "reabrir_pendente") =>
    request(`/bens/${id}/etiqueta`, { method: "PATCH", body: JSON.stringify({ action }) }),
  deleteBem: (id: number | string, motivo?: string) =>
    request(`/bens/${id}`, { method: "DELETE", body: JSON.stringify({ motivo }) }),

  // Veiculos
  getVeiculos: () => request("/veiculos"),
  createVeiculo: (data: any) =>
    request("/veiculos", { method: "POST", body: JSON.stringify(data) }),
  updateVeiculo: (id: number | string, data: any) =>
    request(`/veiculos/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteVeiculo: (id: number | string, motivo?: string) =>
    request(`/veiculos/${id}`, { method: "DELETE", body: JSON.stringify({ motivo }) }),

  // Movimentacoes
  getMovimentacoes: (params?: string) => request(`/movimentacoes${params ? `?${params}` : ""}`),
  createMovimentacao: (data: any) =>
    request("/movimentacoes", { method: "POST", body: JSON.stringify(data) }),
  getSolicitacoesMovimentacao: (params?: string) => request(`/solicitacoes-movimentacao${params ? `?${params}` : ""}`),
  createSolicitacaoMovimentacao: (data: any) =>
    request("/solicitacoes-movimentacao", { method: "POST", body: JSON.stringify(data) }),
  updateSolicitacaoMovimentacao: (id: number | string, data: any) =>
    request(`/solicitacoes-movimentacao/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Emprestimos
  getEmprestimos: (params?: string) => request(`/emprestimos${params ? `?${params}` : ""}`),
  getEmprestimo: (id: number | string) => request(`/emprestimos/${id}`),
  getTermoEmprestimo: (id: number | string) => request(`/emprestimos/${id}/termo`),
  uploadTermoEmprestimo: (id: number | string, file: File) => {
    const form = new FormData()
    form.append("arquivo", file)
    return request(`/emprestimos/${id}/termo/arquivo`, { method: "POST", body: form })
  },
  createEmprestimo: (data: any) =>
    request("/emprestimos", { method: "POST", body: JSON.stringify(data) }),
  devolverEmprestimo: (id: number | string, data?: any) =>
    request(`/emprestimos/${id}/devolver`, { method: "PATCH", body: JSON.stringify(data) }),

  // Usuarios
  getUsuarios: () => request("/usuarios"),
  createUsuario: (data: any) =>
    request("/usuarios", { method: "POST", body: JSON.stringify(data) }),
  updateUsuario: (id: string, data: Partial<User>) => request(`/usuarios/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUsuario: (id: string) => request(`/usuarios/${id}`, { method: "DELETE" }),
  patchUsuario: (id: string, data: Partial<User>) => request(`/usuarios/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Logs
  getLogs: (params?: string) => request(`/logs${params ? `?${params}` : ""}`),
  createLog: (data: { acao: string, descricao: string, detalhes?: string, entidade?: any }) =>
    request("/logs", { method: "POST", body: JSON.stringify(data) }),

  // Cadastros Auxiliares
  getCategorias: (params?: string) => request(`/categorias${params ? `?${params}` : ""}`),
  createCategoria: (data: any) =>
    request("/categorias", { method: "POST", body: JSON.stringify(data) }),
  updateCategoria: (id: number | string, data: any) =>
    request(`/categorias/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCategoria: (id: number | string) =>
    request(`/categorias/${id}`, { method: "DELETE" }),

  getMarcas: (params?: string) => request(`/marcas${params ? `?${params}` : ""}`),
  createMarca: (data: any) =>
    request("/marcas", { method: "POST", body: JSON.stringify(data) }),
  updateMarca: (id: number | string, data: any) =>
    request(`/marcas/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteMarca: (id: number | string) =>
    request(`/marcas/${id}`, { method: "DELETE" }),

  getFornecedores: (params?: string) => request(`/fornecedores${params ? `?${params}` : ""}`),
  createFornecedor: (data: any) =>
    request("/fornecedores", { method: "POST", body: JSON.stringify(data) }),
  deleteFornecedor: (id: number | string) =>
    request(`/fornecedores/${id}`, { method: "DELETE" }),

  getSecretarias: (params?: string) => request(`/secretarias${params ? `?${params}` : ""}`),
  createSecretaria: (data: any) =>
    request("/secretarias", { method: "POST", body: JSON.stringify(data) }),
  updateSecretaria: (id: number | string, data: any) =>
    request(`/secretarias/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSecretaria: (id: number | string) =>
    request(`/secretarias/${id}`, { method: "DELETE" }),

  getDepartamentos: (secretariaId: number | string) =>
    request(`/secretarias/${secretariaId}/departamentos`),
  createDepartamento: (secretariaId: number | string, data: any) =>
    request(`/secretarias/${secretariaId}/departamentos`, { method: "POST", body: JSON.stringify(data) }),
  updateDepartamento: (id: number | string, data: any) =>
    request(`/departamentos/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteDepartamento: (id: number | string) =>
    request(`/departamentos/${id}`, { method: "DELETE" }),

  getSalas: (departamentoId: number | string) =>
    request(`/departamentos/${departamentoId}/salas`),
  createSala: (departamentoId: number | string, data: any) =>
    request(`/departamentos/${departamentoId}/salas`, { method: "POST", body: JSON.stringify(data) }),
  updateSala: (id: number | string, data: any) =>
    request(`/salas/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSala: (id: number | string) =>
    request(`/salas/${id}`, { method: "DELETE" }),

  // Etiquetas Provisorias
  getEtiquetas: () => request("/etiquetas"),
  createEtiqueta: (data: any) =>
    request("/etiquetas", { method: "POST", body: JSON.stringify(data) }),
  updateEtiqueta: (id: number | string, data: any) =>
    request(`/etiquetas/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteEtiqueta: (id: number | string) =>
    request(`/etiquetas/${id}`, { method: "DELETE" }),

  // Servidores (Responsaveis)
  getServidores: () => request("/servidores"),
  createServidor: (data: any) =>
    request("/servidores", { method: "POST", body: JSON.stringify(data) }),
  deleteServidor: (id: number | string) => request(`/servidores/${id}`, { method: "DELETE" }),

  // Notas Fiscais
  getNotasFiscais: () => request("/notas-fiscais"),
  getNotaFiscal: (id: number | string) => request(`/notas-fiscais/${id}`),
  createNotaFiscal: (data: any) =>
    request("/notas-fiscais", { method: "POST", body: JSON.stringify(data) }),

  // PDF Settings
  getPdfSettings: () => request("/configuracoes/pdf"),
  updatePdfSettings: (data: any) =>
    request("/configuracoes/pdf", { method: "PUT", body: JSON.stringify(data) }),

  // Notificacoes
  getNotificacoes: () => request("/notificacoes"),
  marcarNotificacaoLida: (id: number | string) =>
    request(`/notificacoes/${id}/ler`, { method: "PATCH" }),
  marcarTodasLidas: () =>
    request("/notificacoes", { method: "PATCH" }),

  // Pendencias
  getPendencias: (params?: string) => request(`/pendencias${params ? `?${params}` : ""}`),

  // Cadastros provisórios da unidade
  getCadastrosProvisorios: (params?: string) => request(`/cadastros-provisorios${params ? `?${params}` : ""}`),
  getCadastroProvisorio: (id: number | string) => request(`/cadastros-provisorios/${id}`),
  createCadastroProvisorio: (data: any) =>
    request("/cadastros-provisorios", { method: "POST", body: JSON.stringify(data) }),
  updateCadastroProvisorio: (id: number | string, data: any) =>
    request(`/cadastros-provisorios/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  getHistoricoCadastroProvisorio: (id: number | string) =>
    request(`/cadastros-provisorios/${id}/historico`),
  encaminharCadastroProvisorio: (id: number | string, observacao?: string) =>
    request(`/cadastros-provisorios/${id}/encaminhar`, { method: "POST", body: JSON.stringify({ observacao }) }),
  devolverCadastroProvisorio: (id: number | string, motivo: string) =>
    request(`/cadastros-provisorios/${id}/devolver`, { method: "POST", body: JSON.stringify({ motivo }) }),
  rejeitarCadastroProvisorio: (id: number | string, motivo: string) =>
    request(`/cadastros-provisorios/${id}/rejeitar`, { method: "POST", body: JSON.stringify({ motivo }) }),
  aprovarCadastroProvisorio: (id: number | string) =>
    request(`/cadastros-provisorios/${id}/aprovar`, { method: "POST" }),

  // Relatorios
  getRelatorio: (tipo: string) => request(`/relatorios?tipo=${tipo}`),

  // Alienacoes
  getAlienacoes: () => request("/alienacoes"),
  getAlienacao: (id: number | string) => request(`/alienacoes/${id}`),
  createAlienacao: (data: any) =>
    request("/alienacoes", { method: "POST", body: JSON.stringify(data) }),
  updateAlienacao: (id: number | string, data: any) =>
    request(`/alienacoes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAlienacao: (id: number | string) =>
    request(`/alienacoes/${id}`, { method: "DELETE" }),
  addAlienacaoItem: (id: number | string, bemId: number | string) =>
    request(`/alienacoes/${id}/itens`, { method: "POST", body: JSON.stringify({ bem_id: bemId }) }),
  removeAlienacaoItem: (id: number | string, bemId: number | string) =>
    request(`/alienacoes/${id}/itens?bemId=${bemId}`, { method: "DELETE" }),

  // Grupos
  getGrupos: () => request("/grupos"),
  createGrupo: (data: any) =>
    request("/grupos", { method: "POST", body: JSON.stringify(data) }),
  deleteGrupo: (id: number | string) =>
    request(`/grupos/${id}`, { method: "DELETE" }),

  // Generic methods
  post: (url: string, data: any) => request(url, { method: "POST", body: JSON.stringify(data) }),
  put: (url: string, data: any) => request(url, { method: "PUT", body: JSON.stringify(data) }),
  get: (url: string) => request(url),
  delete: (url: string) => request(url, { method: "DELETE" }),
}
