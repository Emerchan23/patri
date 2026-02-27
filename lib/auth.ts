// Auth types and role-based access control

export type UserRole = "administrador" | "gestor" | "assistente"

export interface User {
  id: string
  nome: string
  email: string
  senha: string // In production, this would be hashed
  cargo: string
  role: UserRole
  ativo: boolean
  acessoApp?: boolean
  avatar: string // initials
  // Assistente is linked to a specific unit
  unidade?: {
    secretaria: string
    departamento: string
  }
  // Gestor can manage multiple secretarias
  secretariasGerenciadas?: string[]
  criadoEm: string
  ultimoAcesso?: string
}

// Role labels and descriptions
export const roleLabels: Record<UserRole, string> = {
  administrador: "Administrador",
  gestor: "Gestor de Patrimonio",
  assistente: "Assistente de Unidade",
}

export const roleDescriptions: Record<UserRole, string> = {
  administrador:
    "Acesso total ao sistema. Gerencia usuarios, configuracoes e tem controle completo sobre todos os modulos.",
  gestor:
    "Responsavel por verificar bens sem patrimonio definitivo, gerar numeros de patrimonio e enviar etiquetas para as unidades.",
  assistente:
    "Vinculado a uma unidade. Responsavel por colar etiquetas, alimentar o sistema e cuidar do patrimonio da sua unidade.",
}

// Role colors for badges
export const roleColors: Record<UserRole, string> = {
  administrador: "bg-destructive text-destructive-foreground",
  gestor: "bg-primary text-primary-foreground",
  assistente: "bg-accent text-accent-foreground",
}

// Permissions matrix
export interface Permissions {
  verDashboardGeral: boolean
  verDashboardUnidade: boolean
  cadastrarBem: boolean
  editarBem: boolean
  baixarBem: boolean
  atribuirPatrimonioDefinitivo: boolean
  verTodosBens: boolean
  verBensUnidade: boolean
  registrarMovimentacao: boolean
  aprovarMovimentacao: boolean
  gerenciarVeiculos: boolean
  verVeiculos: boolean
  usarScanner: boolean
  gerenciarUsuarios: boolean
  verRelatorios: boolean
  verPendenciasPatrimonio: boolean
  gerarEtiquetas: boolean
  gerenciarEmprestimos: boolean
  gerenciarCadastrosAuxiliares: boolean
  excluirBem: boolean
  gerenciarAlienacoes: boolean
}

export const rolePermissions: Record<UserRole, Permissions> = {
  administrador: {
    verDashboardGeral: true,
    verDashboardUnidade: true,
    cadastrarBem: true,
    editarBem: true,
    baixarBem: true,
    atribuirPatrimonioDefinitivo: true,
    verTodosBens: true,
    verBensUnidade: true,
    registrarMovimentacao: true,
    aprovarMovimentacao: true,
    gerenciarVeiculos: true,
    verVeiculos: true,
    usarScanner: true,
    gerenciarUsuarios: true,
    verRelatorios: true,
    verPendenciasPatrimonio: true,
    gerarEtiquetas: true,
    gerenciarEmprestimos: true,
    gerenciarCadastrosAuxiliares: true,
    excluirBem: true,
    gerenciarAlienacoes: true,
  },
  gestor: {
    verDashboardGeral: true,
    verDashboardUnidade: true,
    cadastrarBem: true,
    editarBem: true,
    baixarBem: false,
    atribuirPatrimonioDefinitivo: true,
    verTodosBens: true,
    verBensUnidade: true,
    registrarMovimentacao: true,
    aprovarMovimentacao: true,
    gerenciarVeiculos: true,
    verVeiculos: true,
    usarScanner: true,
    gerenciarUsuarios: false,
    verRelatorios: true,
    verPendenciasPatrimonio: true,
    gerarEtiquetas: true,
    gerenciarEmprestimos: true,
    gerenciarCadastrosAuxiliares: true,
    excluirBem: true,
    gerenciarAlienacoes: true,
  },
  assistente: {
    verDashboardGeral: false,
    verDashboardUnidade: true,
    cadastrarBem: true,
    editarBem: false,
    baixarBem: false,
    atribuirPatrimonioDefinitivo: false,
    verTodosBens: false,
    verBensUnidade: true,
    registrarMovimentacao: false,
    aprovarMovimentacao: false,
    gerenciarVeiculos: false,
    verVeiculos: true,
    usarScanner: true,
    gerenciarUsuarios: false,
    verRelatorios: false,
    verPendenciasPatrimonio: false,
    gerarEtiquetas: false,
    gerenciarEmprestimos: false,
    gerenciarCadastrosAuxiliares: false,
    excluirBem: false,
    gerenciarAlienacoes: false,
  },
}

// Mock users
export const mockUsers: User[] = [
  {
    id: "u1",
    nome: "Roberto Gomes",
    email: "admin@prefeitura.gov.br",
    senha: "admin123",
    cargo: "Diretor de TI",
    role: "administrador",
    ativo: true,
    acessoApp: true,
    avatar: "RG",
    criadoEm: "2023-01-15",
    ultimoAcesso: "2025-02-10",
  },
  {
    id: "u2",
    nome: "Claudia Ferreira",
    email: "gestor@prefeitura.gov.br",
    senha: "gestor123",
    cargo: "Chefe do Patrimonio",
    role: "gestor",
    ativo: true,
    avatar: "CF",
    secretariasGerenciadas: [
      "Secretaria de Administracao",
      "Secretaria de Educacao",
      "Secretaria de Saude",
      "Secretaria de Obras",
      "Secretaria de Financas",
    ],
    criadoEm: "2023-03-20",
    ultimoAcesso: "2025-02-09",
  },
  {
    id: "u3",
    nome: "Maria Silva",
    email: "maria@prefeitura.gov.br",
    senha: "maria123",
    cargo: "Coordenadora de RH",
    role: "assistente",
    ativo: true,
    avatar: "MS",
    unidade: {
      secretaria: "Secretaria de Administracao",
      departamento: "Recursos Humanos",
    },
    criadoEm: "2023-06-10",
    ultimoAcesso: "2025-02-08",
  },
  {
    id: "u4",
    nome: "Joao Santos",
    email: "joao@prefeitura.gov.br",
    senha: "joao123",
    cargo: "Coordenador Pedagogico",
    role: "assistente",
    ativo: true,
    avatar: "JS",
    unidade: {
      secretaria: "Secretaria de Educacao",
      departamento: "Coordenacao Pedagogica",
    },
    criadoEm: "2023-08-05",
    ultimoAcesso: "2025-02-07",
  },
  {
    id: "u5",
    nome: "Carlos Souza",
    email: "carlos@prefeitura.gov.br",
    senha: "carlos123",
    cargo: "Gerente de Unidade",
    role: "assistente",
    ativo: true,
    avatar: "CS",
    unidade: {
      secretaria: "Secretaria de Saude",
      departamento: "Atencao Basica",
    },
    criadoEm: "2024-01-12",
    ultimoAcesso: "2025-02-06",
  },
  {
    id: "u6",
    nome: "Ana Oliveira",
    email: "ana@prefeitura.gov.br",
    senha: "ana123",
    cargo: "Contadora Chefe",
    role: "assistente",
    ativo: false,
    avatar: "AO",
    unidade: {
      secretaria: "Secretaria de Financas",
      departamento: "Contabilidade",
    },
    criadoEm: "2024-03-22",
    ultimoAcesso: "2025-01-15",
  },
]

export function getPermissions(role: UserRole): Permissions {
  return rolePermissions[role]
}

export function hasPermission(role: UserRole, permission: keyof Permissions): boolean {
  return rolePermissions[role][permission]
}
