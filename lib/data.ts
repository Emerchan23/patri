export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  try {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  } catch {
    return dateStr
  }
}

// ==========================================
// TYPES (kept for backward compatibility)
// ==========================================
export type AssetStatus = "ativo" | "em_manutencao" | "baixado" | "transferido" | "emprestado"
export type PatrimonyType = "definitivo" | "provisorio"
export type AssetCategory = string

export interface Category {
  id: string | number
  nome: string
  slug: string
  descricao?: string
}

export interface Marca {
  id: string | number
  nome: string
}

export type LoanStatus = "ativo" | "devolvido" | "atrasado"

export interface Loan {
  id: string | number
  assetId?: string
  bem_descricao?: string
  assetDescricao?: string
  assetImagem?: string
  patrimonio?: string
  numero_patrimonio?: string
  origem?: { secretaria: string; departamento: string; sala: string }
  destino?: { secretaria: string; departamento: string; sala: string }
  origem_secretaria?: string
  origem_departamento?: string
  origem_sala?: string
  destino_secretaria?: string
  destino_departamento?: string
  destino_sala?: string
  responsavelEmprestimo?: string
  responsavelRecebimento?: string
  solicitante?: string
  responsavel?: string
  responsavel_recebimento?: string
  dataEmprestimo?: string
  data_emprestimo?: string
  dataPrevistaDevolucao?: string
  data_devolucao_prevista?: string
  dataDevolucao?: string
  data_devolucao?: string
  motivo?: string
  observacoes?: string
  status: LoanStatus
}

export interface Asset {
  id: string | number
  patrimonio?: string
  numero_patrimonio?: string
  patrimonioProvisorio?: string
  numero_provisorio?: string
  patrimonioTipo?: PatrimonyType
  tipo_patrimonio?: PatrimonyType
  descricao: string
  categoria: AssetCategory
  grupo?: string
  localizacao: {
    secretaria: string
    departamento: string
    sala: string
  }
  secretaria?: string
  departamento?: string
  sala?: string
  responsavel?: {
    nome: string
    cargo: string
  } | string
  responsavel_nome?: string
  responsavel_cargo?: string
  dataAquisicao?: string
  data_aquisicao?: string
  valor?: number
  valor_aquisicao?: number
  status: AssetStatus
  marca?: string
  modelo?: string
  fornecedor?: string
  numeroSerie?: string
  numero_serie?: string
  estadoConservacao?: string
  estado?: string
  observacoes?: string
  imagem?: string
  placa?: string
  ano?: number
  kmAtual?: number
  km_atual?: number
}

export interface Movement {
  id: string | number
  assetId?: string
  bem_id?: number
  assetDescricao?: string
  bem_descricao?: string
  patrimonio?: string
  numero_patrimonio?: string
  de?: { secretaria: string; departamento: string; sala: string }
  para?: { secretaria: string; departamento: string; sala: string }
  de_secretaria?: string
  de_departamento?: string
  de_sala?: string
  para_secretaria?: string
  para_departamento?: string
  para_sala?: string
  responsavel?: string
  data?: string
  data_movimentacao?: string
  motivo?: string
}

export interface MaintenanceRecord {
  id: string
  assetId: string
  tipo: string
  descricao: string
  tecnico: string
  data: string
  custo: number
  status: "pendente" | "em_andamento" | "concluida"
}

// ==========================================
// AUDIT LOG TYPES
// ==========================================
export type LogAction =
  | "cadastro"
  | "edicao"
  | "exclusao"
  | "transferencia"
  | "baixa"
  | "manutencao"
  | "patrimonio_definitivo"
  | "entrada_nf"
  | "emprestimo"
  | "devolucao"
  | "login"
  | "logout"
  | "usuario_criado"
  | "usuario_editado"
  | "usuario_desativado"
  | "etiqueta_gerada"
  | "relatorio_gerado"

export interface AuditLog {
  id: string | number
  acao: LogAction
  descricao: string
  detalhes?: string
  usuario?: {
    id: string
    nome: string
    role: string
  }
  usuario_id?: number
  usuario_nome?: string
  entidade?: {
    tipo: "bem" | "veiculo" | "usuario" | "movimentacao" | "emprestimo" | "relatorio"
    id: string
    descricao: string
  }
  ip?: string
  dataHora?: string
  created_at?: string
  dadosAnteriores?: Record<string, unknown>
  dadosNovos?: Record<string, unknown>
}

export function getLogActionLabel(action: LogAction | string): string {
  const labels: Record<string, string> = {
    cadastro: "Cadastro",
    edicao: "Edicao",
    exclusao: "Exclusao",
    transferencia: "Transferencia",
    baixa: "Baixa",
    manutencao: "Manutencao",
    patrimonio_definitivo: "Patrimonio Definitivo",
    entrada_nf: "Entrada por NF",
    emprestimo: "Emprestimo",
    devolucao: "Devolucao",
    login: "Login",
    logout: "Logout",
    usuario_criado: "Usuario Criado",
    usuario_editado: "Usuario Editado",
    usuario_desativado: "Usuario Desativado",
    etiqueta_gerada: "Etiqueta Gerada",
    relatorio_gerado: "Relatorio Gerado",
  }
  return labels[action] || action
}

export function getLogActionColor(action: LogAction | string): string {
  const colors: Record<string, string> = {
    cadastro: "bg-success text-success-foreground",
    edicao: "bg-info text-info-foreground",
    exclusao: "bg-destructive text-destructive-foreground",
    transferencia: "bg-primary text-primary-foreground",
    baixa: "bg-destructive text-destructive-foreground",
    manutencao: "bg-warning text-warning-foreground",
    patrimonio_definitivo: "bg-accent text-accent-foreground",
    entrada_nf: "bg-success text-success-foreground",
    emprestimo: "bg-primary text-primary-foreground",
    devolucao: "bg-success text-success-foreground",
    login: "bg-muted text-muted-foreground",
    logout: "bg-muted text-muted-foreground",
    usuario_criado: "bg-info text-info-foreground",
    usuario_editado: "bg-info text-info-foreground",
    usuario_desativado: "bg-warning text-warning-foreground",
    etiqueta_gerada: "bg-accent text-accent-foreground",
    relatorio_gerado: "bg-primary text-primary-foreground",
  }
  return colors[action] || "bg-muted text-muted-foreground"
}

// ==========================================
// PDF SETTINGS
// ==========================================
export interface PdfSettings {
  nomeOrgao: string
  subtitulo: string
  endereco: string
  telefone: string
  email: string
  site: string
  cnpj: string
  logoUrl: string | null
  rodape: string
  mostrarLogo: boolean
  mostrarDataHora: boolean
  mostrarNumeroPagina: boolean
  mostrarAssinatura: boolean
  assinaturaTexto: string
  assinaturaCargo: string
}

export const defaultPdfSettings: PdfSettings = {
  nomeOrgao: "Prefeitura Municipal de Exemplo",
  subtitulo: "Secretaria de Administracao - Departamento de Patrimonio",
  endereco: "Rua Principal, 100 - Centro - CEP 12345-678",
  telefone: "(11) 3456-7890",
  email: "patrimonio@prefeitura.gov.br",
  site: "www.prefeitura.gov.br",
  cnpj: "12.345.678/0001-90",
  logoUrl: null,
  rodape: "Documento gerado pelo SisPatrimonio - Sistema de Controle Patrimonial Municipal",
  mostrarLogo: true,
  mostrarDataHora: true,
  mostrarNumeroPagina: true,
  mostrarAssinatura: true,
  assinaturaTexto: "Responsavel pelo Patrimonio",
  assinaturaCargo: "Chefe do Departamento de Patrimonio",
}

// ==========================================
// HELPER FUNCTIONS (pure, no mock data)
// ==========================================
export function getStatusLabel(status: AssetStatus | string): string {
  const labels: Record<string, string> = {
    ativo: "Ativo",
    em_manutencao: "Em Manutencao",
    baixado: "Baixado",
    transferido: "Transferido",
    emprestado: "Emprestado",
    disponivel: "Disponivel",
  }
  return labels[status] || status
}

export function getStatusColor(status: AssetStatus | string): string {
  const colors: Record<string, string> = {
    ativo: "bg-success text-success-foreground",
    em_manutencao: "bg-warning text-warning-foreground",
    baixado: "bg-destructive text-destructive-foreground",
    transferido: "bg-info text-info-foreground",
    emprestado: "bg-primary text-primary-foreground",
    disponivel: "bg-success text-success-foreground",
  }
  return colors[status] || "bg-muted text-muted-foreground"
}

export function getCategoryLabel(cat: AssetCategory, categories?: Category[]): string {
  if (categories) {
    const found = categories.find((c) => c.slug === cat || c.nome === cat)
    return found ? found.nome : cat
  }
  // Fallback labels
  const defaults: Record<string, string> = {
    informatica: "Informatica",
    movel: "Movel",
    equipamento: "Equipamento",
    eletronico: "Eletronico",
    veiculo: "Veiculo",
  }
  return defaults[cat] || cat || "Sem categoria"
}

export function getLoanStatusLabel(status: LoanStatus | string): string {
  const labels: Record<string, string> = {
    ativo: "Emprestado",
    devolvido: "Devolvido",
    atrasado: "Atrasado",
  }
  return labels[status] || status
}

export function getLoanStatusColor(status: LoanStatus | string): string {
  const colors: Record<string, string> = {
    ativo: "bg-warning text-warning-foreground",
    devolvido: "bg-success text-success-foreground",
    atrasado: "bg-destructive text-destructive-foreground",
  }
  return colors[status] || "bg-muted text-muted-foreground"
}

export function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0)
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  try {
    // Se for formato YYYY-MM-DD, divide manualmente para evitar timezone issues
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split("-")
      return `${day}/${month}/${year}`
    }
    
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat("pt-BR").format(date)
  } catch {
    return dateStr || "-"
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  try {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date)
  } catch {
    return dateStr
  }
}

// ==========================================
// MOCK DATA (Restored for compatibility)
// ==========================================

export const secretarias = [
  {
    nome: "Secretaria de Administracao",
    departamentos: [
      { nome: "Recursos Humanos", salas: ["Sala 101", "Sala 102"] },
      { nome: "Compras e Licitacoes", salas: ["Sala 201", "Sala 202"] },
      { nome: "Patrimonio", salas: ["Sala 301", "Deposito"] },
    ],
  },
  {
    nome: "Secretaria de Educacao",
    departamentos: [
      { nome: "Coordenacao Pedagogica", salas: ["Sala 101", "Sala 102"] },
      { nome: "Transporte Escolar", salas: ["Garagem", "Sala 201"] },
      { nome: "Merenda Escolar", salas: ["Cozinha", "Almoxarifado"] },
    ],
  },
  {
    nome: "Secretaria de Saude",
    departamentos: [
      { nome: "Atencao Basica", salas: ["Sala 101", "Sala 102", "Sala 103"] },
      { nome: "Vigilancia Sanitaria", salas: ["Sala 201", "Sala 202"] },
      { nome: "Farmacia Municipal", salas: ["Estoque", "Atendimento"] },
    ],
  },
  {
    nome: "Secretaria de Obras",
    departamentos: [
      { nome: "Engenharia", salas: ["Sala 101", "Sala 102"] },
      { nome: "Fiscalizacao", salas: ["Sala 201"] },
      { nome: "Almoxarifado Central", salas: ["Galpao A", "Galpao B"] },
    ],
  },
  {
    nome: "Secretaria de Financas",
    departamentos: [
      { nome: "Contabilidade", salas: ["Sala 101", "Sala 102"] },
      { nome: "Tesouraria", salas: ["Sala 201"] },
      { nome: "Tributacao", salas: ["Sala 301", "Sala 302"] },
    ],
  },
]

export const mockAssets: Asset[] = [
  {
    id: 1,
    patrimonio: "PAT-2024-00142",
    patrimonioTipo: "definitivo",
    descricao: "Computador Dell OptiPlex 7010",
    categoria: "informatica",
    localizacao: {
      secretaria: "Secretaria de Administracao",
      departamento: "Recursos Humanos",
      sala: "Sala 101",
    },
    responsavel: {
      nome: "Maria Silva",
      cargo: "Coordenadora de RH",
    },
    dataAquisicao: "2024-03-15",
    valor: 4500.00,
    status: "ativo",
    marca: "Dell",
    modelo: "OptiPlex 7010",
    estadoConservacao: "Bom",
  },
  {
    id: 2,
    patrimonio: "PROV-2025-00034",
    patrimonioProvisorio: "PROV-2025-00034",
    patrimonioTipo: "provisorio",
    descricao: "Impressora Multifuncional HP LaserJet Pro",
    categoria: "informatica",
    localizacao: {
      secretaria: "Secretaria de Educacao",
      departamento: "Coordenacao Pedagogica",
      sala: "Sala 101",
    },
    responsavel: {
      nome: "Joao Santos",
      cargo: "Coordenador Pedagogico",
    },
    dataAquisicao: "2025-01-20",
    valor: 3200.00,
    status: "ativo",
    marca: "HP",
    modelo: "LaserJet Pro M428fdw",
    estadoConservacao: "Novo",
  },
  {
    id: 3,
    patrimonio: "PAT-2023-00089",
    patrimonioTipo: "definitivo",
    descricao: "Mesa de Escritorio em L",
    categoria: "movel",
    localizacao: {
      secretaria: "Secretaria de Financas",
      departamento: "Contabilidade",
      sala: "Sala 101",
    },
    responsavel: {
      nome: "Ana Oliveira",
      cargo: "Contadora Chefe",
    },
    dataAquisicao: "2023-06-10",
    valor: 1200.00,
    status: "ativo",
    marca: "Planalto",
    modelo: "Executiva Pro",
    estadoConservacao: "Bom",
  },
  {
    id: 4,
    patrimonio: "PAT-2022-00567",
    patrimonioTipo: "definitivo",
    descricao: "Ar Condicionado Split 12.000 BTUs",
    categoria: "equipamento",
    localizacao: {
      secretaria: "Secretaria de Saude",
      departamento: "Atencao Basica",
      sala: "Sala 102",
    },
    responsavel: {
      nome: "Carlos Souza",
      cargo: "Gerente de Unidade",
    },
    dataAquisicao: "2022-11-05",
    valor: 2800.00,
    status: "em_manutencao",
    marca: "Samsung",
    modelo: "Wind-Free 12K",
    estadoConservacao: "Regular",
  },
  {
    id: 5,
    patrimonio: "PROV-2025-00071",
    patrimonioProvisorio: "PROV-2025-00071",
    patrimonioTipo: "provisorio",
    descricao: "Notebook Lenovo ThinkPad",
    categoria: "informatica",
    localizacao: {
      secretaria: "Secretaria de Obras",
      departamento: "Engenharia",
      sala: "Sala 101",
    },
    responsavel: {
      nome: "Pedro Lima",
      cargo: "Engenheiro Civil",
    },
    dataAquisicao: "2025-02-01",
    valor: 6500.00,
    status: "ativo",
    marca: "Lenovo",
    modelo: "ThinkPad T14",
    estadoConservacao: "Novo",
  },
  {
    id: 6,
    patrimonio: "PAT-2021-00234",
    patrimonioTipo: "definitivo",
    descricao: "Cadeira Giratoria Presidente",
    categoria: "movel",
    localizacao: {
      secretaria: "Secretaria de Administracao",
      departamento: "Compras e Licitacoes",
      sala: "Sala 201",
    },
    responsavel: {
      nome: "Lucia Mendes",
      cargo: "Diretora de Compras",
    },
    dataAquisicao: "2021-08-22",
    valor: 950.00,
    status: "ativo",
    marca: "Flexform",
    modelo: "Presidente Plus",
    estadoConservacao: "Regular",
  },
  {
    id: 7,
    patrimonio: "PAT-2024-00321",
    patrimonioTipo: "definitivo",
    descricao: "Projetor Epson PowerLite",
    categoria: "eletronico",
    localizacao: {
      secretaria: "Secretaria de Educacao",
      departamento: "Coordenacao Pedagogica",
      sala: "Sala 102",
    },
    responsavel: {
      nome: "Ricardo Alves",
      cargo: "Tecnico Pedagogico",
    },
    dataAquisicao: "2024-05-12",
    valor: 3800.00,
    status: "baixado",
    marca: "Epson",
    modelo: "PowerLite X49",
    estadoConservacao: "Inoperante",
  },
  {
    id: 8,
    patrimonio: "PROV-2025-00098",
    patrimonioProvisorio: "PROV-2025-00098",
    patrimonioTipo: "provisorio",
    descricao: "Scanner de Documentos Fujitsu",
    categoria: "informatica",
    localizacao: {
      secretaria: "Secretaria de Financas",
      departamento: "Tributacao",
      sala: "Sala 301",
    },
    responsavel: {
      nome: "Fernanda Costa",
      cargo: "Fiscal Tributaria",
    },
    dataAquisicao: "2025-01-28",
    valor: 4100.00,
    status: "ativo",
    marca: "Fujitsu",
    modelo: "ScanSnap iX1600",
    estadoConservacao: "Novo",
  },
]

export const mockVehicles: Asset[] = [
  {
    id: 101,
    patrimonio: "PAT-2023-V001",
    patrimonioTipo: "definitivo",
    descricao: "Fiat Strada Endurance",
    categoria: "veiculo",
    localizacao: {
      secretaria: "Secretaria de Obras",
      departamento: "Fiscalizacao",
      sala: "Garagem",
    },
    responsavel: {
      nome: "Marcos Silva",
      cargo: "Fiscal de Obras",
    },
    dataAquisicao: "2023-04-10",
    valor: 95000.00,
    status: "ativo",
    marca: "Fiat",
    modelo: "Strada Endurance 1.4",
    estadoConservacao: "Bom",
    placa: "ABC-1D23",
    ano: 2023,
    kmAtual: 42500,
  },
  {
    id: 102,
    patrimonio: "PAT-2024-V002",
    patrimonioTipo: "definitivo",
    descricao: "VW Saveiro Robust",
    categoria: "veiculo",
    localizacao: {
      secretaria: "Secretaria de Saude",
      departamento: "Vigilancia Sanitaria",
      sala: "Garagem",
    },
    responsavel: {
      nome: "Sandra Reis",
      cargo: "Agente Sanitario",
    },
    dataAquisicao: "2024-01-15",
    valor: 88000.00,
    status: "ativo",
    marca: "Volkswagen",
    modelo: "Saveiro Robust 1.6",
    estadoConservacao: "Bom",
    placa: "DEF-4G56",
    ano: 2024,
    kmAtual: 18300,
  },
  {
    id: 103,
    patrimonio: "PROV-2025-V003",
    patrimonioProvisorio: "PROV-2025-V003",
    patrimonioTipo: "provisorio",
    descricao: "Renault Duster Zen",
    categoria: "veiculo",
    localizacao: {
      secretaria: "Secretaria de Administracao",
      departamento: "Recursos Humanos",
      sala: "Garagem",
    },
    responsavel: {
      nome: "Felipe Cardoso",
      cargo: "Motorista Oficial",
    },
    dataAquisicao: "2025-01-05",
    valor: 115000.00,
    status: "ativo",
    marca: "Renault",
    modelo: "Duster Zen 1.6",
    estadoConservacao: "Novo",
    placa: "GHI-7J89",
    ano: 2025,
    kmAtual: 3200,
  },
]

// ==========================================
// DEFAULT DATA LISTS
// ==========================================

export const defaultCategories: Category[] = [
  { id: 1, nome: "Informatica", slug: "informatica", descricao: "Computadores, notebooks, perifericos" },
  { id: 2, nome: "Movel", slug: "movel", descricao: "Mesas, cadeiras, armarios" },
  { id: 3, nome: "Equipamento", slug: "equipamento", descricao: "Ar condicionado, ventiladores, maquinas" },
  { id: 4, nome: "Eletronico", slug: "eletronico", descricao: "TVs, projetores, som" },
  { id: 5, nome: "Veiculo", slug: "veiculo", descricao: "Carros, motos, caminhoes" },
]

export const defaultMarcas: Marca[] = [
  { id: 1, nome: "Dell" },
  { id: 2, nome: "HP" },
  { id: 3, nome: "Lenovo" },
  { id: 4, nome: "Samsung" },
  { id: 5, nome: "LG" },
  { id: 6, nome: "Epson" },
  { id: 7, nome: "Brother" },
  { id: 8, nome: "Canon" },
  { id: 9, nome: "Positivo" },
  { id: 10, nome: "Multilaser" },
  { id: 11, nome: "Flexform" },
  { id: 12, nome: "Cavaletti" },
  { id: 13, nome: "Fiat" },
  { id: 14, nome: "Volkswagen" },
  { id: 15, nome: "Chevrolet" },
  { id: 16, nome: "Toyota" },
  { id: 17, nome: "Renault" },
  { id: 18, nome: "Arno" },
  { id: 19, nome: "Mondial" },
  { id: 20, nome: "Outra" },
]

export const mockMovements: Movement[] = [
  {
    id: 1,
    assetId: "1",
    patrimonio: "PAT-2024-00142",
    assetDescricao: "Computador Dell OptiPlex 7010",
    de: {
      secretaria: "Secretaria de Financas",
      departamento: "Tesouraria",
      sala: "Sala 201",
    },
    para: {
      secretaria: "Secretaria de Administracao",
      departamento: "Recursos Humanos",
      sala: "Sala 101",
    },
    responsavel: "Roberto Gomes",
    data: "2025-01-15",
    motivo: "Realocacao por demanda do setor",
  },
  {
    id: 2,
    assetId: "4",
    patrimonio: "PAT-2022-00567",
    assetDescricao: "Ar Condicionado Split 12.000 BTUs",
    de: {
      secretaria: "Secretaria de Saude",
      departamento: "Atencao Basica",
      sala: "Sala 101",
    },
    para: {
      secretaria: "Secretaria de Saude",
      departamento: "Atencao Basica",
      sala: "Sala 102",
    },
    responsavel: "Carlos Souza",
    data: "2025-01-10",
    motivo: "Troca de sala por reforma",
  },
  {
    id: 3,
    assetId: "3",
    patrimonio: "PAT-2023-00089",
    assetDescricao: "Mesa de Escritorio em L",
    de: {
      secretaria: "Secretaria de Administracao",
      departamento: "Compras e Licitacoes",
      sala: "Sala 201",
    },
    para: {
      secretaria: "Secretaria de Financas",
      departamento: "Contabilidade",
      sala: "Sala 101",
    },
    responsavel: "Ana Oliveira",
    data: "2024-12-20",
    motivo: "Transferencia definitiva para setor de contabilidade",
  },
  {
    id: 4,
    assetId: "7",
    patrimonio: "PAT-2024-00321",
    assetDescricao: "Projetor Epson PowerLite",
    de: {
      secretaria: "Secretaria de Administracao",
      departamento: "Patrimonio",
      sala: "Sala 301",
    },
    para: {
      secretaria: "Secretaria de Educacao",
      departamento: "Coordenacao Pedagogica",
      sala: "Sala 102",
    },
    responsavel: "Ricardo Alves",
    data: "2024-11-05",
    motivo: "Emprestimo para evento pedagogico",
  },
]

export const mockAuditLogs: AuditLog[] = [
  {
    id: 1,
    acao: "cadastro",
    descricao: "Novo bem cadastrado: Computador Dell OptiPlex 7010",
    detalhes: "Cadastro individual com patrimonio provisorio PROV-2025-00142",
    usuario: { id: "3", nome: "Maria Silva", role: "assistente" },
    dataHora: "2025-02-10T09:30:00",
    entidade: { tipo: "bem", id: "1", descricao: "Computador Dell OptiPlex 7010" },
    dadosNovos: { patrimonio: "PROV-2025-00142", categoria: "informatica", valor: 4500 },
  },
  {
    id: 2,
    acao: "entrada_nf",
    descricao: "Entrada em lote por Nota Fiscal NF-2025-001234",
    detalhes: "5 itens importados: 3x Ar Condicionado Split, 2x Mesa Escritorio",
    usuario: { id: "2", nome: "Claudia Ferreira", role: "gestor" },
    dataHora: "2025-02-09T14:20:00",
    entidade: { tipo: "bem", id: "nf-batch-001", descricao: "NF-2025-001234" },
    dadosNovos: { totalItens: 5, valorTotal: 18600 },
  },
  {
    id: 3,
    acao: "transferencia",
    descricao: "Transferencia: Computador Dell OptiPlex - Tesouraria para RH",
    detalhes: "Motivo: Realocacao por demanda do setor",
    usuario: { id: "1", nome: "Roberto Gomes", role: "administrador" },
    dataHora: "2025-02-09T11:45:00",
    entidade: { tipo: "movimentacao", id: "1", descricao: "Computador Dell OptiPlex 7010" },
    dadosAnteriores: { departamento: "Tesouraria", sala: "Sala 201" },
    dadosNovos: { departamento: "Recursos Humanos", sala: "Sala 101" },
  },
  {
    id: 4,
    acao: "patrimonio_definitivo",
    descricao: "Patrimonio definitivo atribuido: Impressora HP LaserJet Pro",
    detalhes: "Provisorio PROV-2025-00034 convertido para PAT-2025-00034",
    usuario: { id: "2", nome: "Claudia Ferreira", role: "gestor" },
    dataHora: "2025-02-08T16:10:00",
    entidade: { tipo: "bem", id: "2", descricao: "Impressora HP LaserJet Pro" },
    dadosAnteriores: { patrimonio: "PROV-2025-00034", tipo: "provisorio" },
    dadosNovos: { patrimonio: "PAT-2025-00034", tipo: "definitivo" },
  },
  {
    id: 5,
    acao: "edicao",
    descricao: "Bem editado: Ar Condicionado Split 12.000 BTUs",
    detalhes: "Estado de conservacao alterado de Bom para Regular",
    usuario: { id: "5", nome: "Carlos Souza", role: "assistente" },
    dataHora: "2025-02-08T10:30:00",
    entidade: { tipo: "bem", id: "4", descricao: "Ar Condicionado Split 12.000 BTUs" },
    dadosAnteriores: { estadoConservacao: "Bom" },
    dadosNovos: { estadoConservacao: "Regular" },
  },
  {
    id: 6,
    acao: "manutencao",
    descricao: "Bem enviado para manutencao: Ar Condicionado Split 12.000 BTUs",
    detalhes: "Problema: compressor com defeito. Tecnico: Refrigeracao Central Ltda",
    usuario: { id: "5", nome: "Carlos Souza", role: "assistente" },
    dataHora: "2025-02-07T15:00:00",
    entidade: { tipo: "bem", id: "4", descricao: "Ar Condicionado Split 12.000 BTUs" },
    dadosAnteriores: { status: "ativo" },
    dadosNovos: { status: "em_manutencao" },
  },
  {
    id: 7,
    acao: "exclusao",
    descricao: "Bem excluido: Monitor LG 22 polegadas",
    detalhes: "Motivo: equipamento inoperante sem possibilidade de reparo. Processo de baixa #2025-012",
    usuario: { id: "1", nome: "Roberto Gomes", role: "administrador" },
    dataHora: "2025-02-07T09:20:00",
    entidade: { tipo: "bem", id: "deleted-001", descricao: "Monitor LG 22 polegadas" },
    dadosAnteriores: { patrimonio: "PAT-2023-00112", status: "baixado", valor: 890 },
  },
  {
    id: 8,
    acao: "baixa",
    descricao: "Baixa patrimonial: Projetor Epson PowerLite",
    detalhes: "Motivo: defeito irreparavel. Laudo tecnico anexo ao processo",
    usuario: { id: "1", nome: "Roberto Gomes", role: "administrador" },
    dataHora: "2025-02-06T14:45:00",
    entidade: { tipo: "bem", id: "7", descricao: "Projetor Epson PowerLite" },
    dadosAnteriores: { status: "em_manutencao" },
    dadosNovos: { status: "baixado" },
  },
  {
    id: 9,
    acao: "usuario_criado",
    descricao: "Novo usuario criado: Carlos Souza",
    detalhes: "Perfil: Assistente de Unidade - Sec. Saude / Atencao Basica",
    usuario: { id: "1", nome: "Roberto Gomes", role: "administrador" },
    dataHora: "2025-02-05T08:30:00",
    entidade: { tipo: "usuario", id: "5", descricao: "Carlos Souza" },
    dadosNovos: { role: "assistente", secretaria: "Secretaria de Saude", departamento: "Atencao Basica" },
  },
  {
    id: 10,
    acao: "usuario_desativado",
    descricao: "Usuario desativado: Ana Oliveira",
    detalhes: "Motivo: transferencia para outro orgao",
    usuario: { id: "1", nome: "Roberto Gomes", role: "administrador" },
    dataHora: "2025-02-04T17:00:00",
    entidade: { tipo: "usuario", id: "6", descricao: "Ana Oliveira" },
    dadosAnteriores: { ativo: true },
    dadosNovos: { ativo: false },
  },
  {
    id: 11,
    acao: "etiqueta_gerada",
    descricao: "Etiquetas geradas para 3 bens",
    detalhes: "PAT-2024-00142, PAT-2024-00178, PAT-2024-00321",
    usuario: { id: "2", nome: "Claudia Ferreira", role: "gestor" },
    dataHora: "2025-02-04T11:15:00",
  },
  {
    id: 12,
    acao: "relatorio_gerado",
    descricao: "Relatorio gerado: Inventario Geral por Secretaria",
    detalhes: "Formato PDF - Todas as secretarias - 14 bens incluidos",
    usuario: { id: "2", nome: "Claudia Ferreira", role: "gestor" },
    dataHora: "2025-02-03T16:30:00",
    entidade: { tipo: "relatorio", id: "rel-001", descricao: "Inventario Geral" },
  },
  {
    id: 13,
    acao: "login",
    descricao: "Login realizado no sistema",
    usuario: { id: "2", nome: "Claudia Ferreira", role: "gestor" },
    dataHora: "2025-02-03T08:00:00",
    ip: "192.168.1.105",
  },
  {
    id: 14,
    acao: "cadastro",
    descricao: "Novo bem cadastrado: Scanner de Documentos Fujitsu",
    detalhes: "Cadastro individual com patrimonio provisorio PROV-2025-00098",
    usuario: { id: "3", nome: "Maria Silva", role: "assistente" },
    dataHora: "2025-02-02T10:00:00",
    entidade: { tipo: "bem", id: "8", descricao: "Scanner de Documentos Fujitsu" },
    dadosNovos: { patrimonio: "PROV-2025-00098", categoria: "informatica", valor: 4100 },
  },
  {
    id: 15,
    acao: "transferencia",
    descricao: "Transferencia: Mesa de Escritorio em L - Compras para Contabilidade",
    detalhes: "Transferencia definitiva para setor de contabilidade",
    usuario: { id: "1", nome: "Roberto Gomes", role: "administrador" },
    dataHora: "2025-02-01T13:40:00",
    entidade: { tipo: "movimentacao", id: "3", descricao: "Mesa de Escritorio em L" },
    dadosAnteriores: { secretaria: "Sec. Administracao", departamento: "Compras e Licitacoes" },
    dadosNovos: { secretaria: "Sec. Financas", departamento: "Contabilidade" },
  },
  {
    id: 16,
    acao: "login",
    descricao: "Login realizado no sistema",
    usuario: { id: "4", nome: "Joao Santos", role: "assistente" },
    dataHora: "2025-01-31T07:50:00",
    ip: "192.168.1.115",
  },
  {
    id: 17,
    acao: "edicao",
    descricao: "Veiculo editado: Onibus Escolar Iveco City Class",
    detalhes: "Quilometragem atualizada: 87200 -> 89700 km",
    usuario: { id: "4", nome: "Joao Santos", role: "assistente" },
    dataHora: "2025-01-31T09:15:00",
    entidade: { tipo: "veiculo", id: "14", descricao: "Onibus Escolar Iveco City Class" },
    dadosAnteriores: { kmAtual: 87200 },
    dadosNovos: { kmAtual: 89700 },
  },
]
