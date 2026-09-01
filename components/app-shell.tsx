"use client"

import React from "react"
import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { roleLabels, roleColors } from "@/lib/auth"
import { useTheme } from "@/components/theme-provider"
import type { Permissions } from "@/lib/auth"
import {
  LayoutDashboard,
  Package,
  Plus,
  ArrowRightLeft,
  Car,
  ScanBarcode,
  Menu,
  X,
  Building2,
  ChevronDown,
  ChevronRight,
  Search,
  Bell,
  Shield,
  Users,
  LogOut,
  AlertTriangle,
  Tag,
  Activity,
  FileText,
  Settings2,
  Repeat2,
  FolderCog,
  FolderOpen,
  Gavel,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { NotificationsPopover } from "@/components/notifications-popover"
import useSWR from "swr"
import { fetcher } from "@/lib/api-client"

interface Sala {
  id: number
  nome: string
}

interface Departamento {
  id: number
  nome: string
  salas: Sala[]
}

interface Secretaria {
  id: number
  nome: string
  departamentos: Departamento[]
}

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  requiredPermission?: keyof Permissions
}

const allNavigation: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  {
    name: "Pendencias Patrimonio",
    href: "/pendencias",
    icon: AlertTriangle,
    badge: "Novo",
    requiredPermission: "verPendenciasPatrimonio",
  },
  {
    name: "Cadastros Provisorios",
    href: "/cadastros-provisorios",
    icon: FolderOpen,
    badge: "Unidade",
    requiredPermission: "acessarCadastrosProvisorios",
  },
  { name: "Cadastrar Bem", href: "/cadastro", icon: Plus, badge: "NF", requiredPermission: "cadastrarBem" },
  { name: "Bens Patrimoniais", href: "/bens", icon: Package },
  {
    name: "Movimentacoes",
    href: "/movimentacoes",
    icon: ArrowRightLeft,
    requiredPermission: "acessarMovimentacoes",
  },
  {
    name: "Emprestimos",
    href: "/emprestimos",
    icon: Repeat2,
    requiredPermission: "gerenciarEmprestimos",
  },
  { name: "Veiculos", href: "/veiculos", icon: Car, requiredPermission: "verVeiculos" },
  { name: "Alienacoes", href: "/alienacoes", icon: Gavel, requiredPermission: "gerenciarAlienacoes" },
  {
    name: "Etiquetas Provisorias",
    href: "/etiquetas",
    icon: Tag,
    requiredPermission: "gerarEtiquetas",
  },
  { name: "Escanear Patrimonio", href: "/scanner", icon: ScanBarcode, requiredPermission: "usarScanner" },
  {
    name: "Relatorios",
    href: "/relatorios",
    icon: FileText,
    requiredPermission: "verRelatorios",
  },
  {
    name: "Registro de Atividades",
    href: "/logs",
    icon: Activity,
    requiredPermission: "gerenciarUsuarios",
  },
  {
    name: "Gerenciar Usuarios",
    href: "/usuarios",
    icon: Users,
    requiredPermission: "gerenciarUsuarios",
  },
  {
    name: "Cadastros Auxiliares",
    href: "/cadastros-auxiliares",
    icon: FolderCog,
    requiredPermission: "gerenciarCadastrosAuxiliares",
  },
  {
    name: "Configuracoes",
    href: "/configuracoes",
    icon: Settings2,
    requiredPermission: "gerenciarUsuarios",
  },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedSecretaria, setExpandedSecretaria] = useState<string | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const { user, permissions, logout, hasPermission } = useAuth()
  const { sidebarColor } = useTheme()
  const [globalSearch, setGlobalSearch] = useState("")

  // Fetch real secretarias from API
  const { data: secretariasResponse } = useSWR("/secretarias?all=true", fetcher)
  const secretarias = Array.isArray(secretariasResponse) ? secretariasResponse : (secretariasResponse?.data || [])

  // Global search handler
  const handleGlobalSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && globalSearch.trim()) {
      router.push(`/bens?busca=${encodeURIComponent(globalSearch.trim())}`)
      setGlobalSearch("") // Clear search after navigation
    }
  }

  // Filter navigation based on permissions
  const navigation = allNavigation.filter((item) => {
    if (!item.requiredPermission) return true
    return hasPermission(item.requiredPermission)
  })

  const styles = {
    dark: {
      aside: "bg-sidebar text-sidebar-foreground",
      border: "border-sidebar-border",
      logoIconBg: "bg-sidebar-primary",
      logoIconText: "text-sidebar-primary-foreground",
      logoText: "text-sidebar-primary-foreground",
      logoSub: "text-sidebar-foreground/60",
      closeBtn: "text-sidebar-foreground hover:bg-sidebar-accent",
      sectionTitle: "text-sidebar-foreground/40",
      itemActive: "bg-sidebar-primary text-sidebar-primary-foreground",
      itemInactive: "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      mobileBadge: "bg-sidebar-accent text-sidebar-accent-foreground",
      userCard: "bg-sidebar-accent",
      userText: "text-sidebar-accent-foreground",
      userSub: "text-sidebar-foreground/70",
      logoutBtn: "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent",
      divider: "border-sidebar-border"
    },
    light: {
      aside: "bg-white text-slate-900 border-r border-slate-200",
      border: "border-slate-200",
      logoIconBg: "bg-primary",
      logoIconText: "text-primary-foreground",
      logoText: "text-slate-900",
      logoSub: "text-slate-500",
      closeBtn: "text-slate-500 hover:bg-slate-100",
      sectionTitle: "text-slate-400",
      itemActive: "bg-primary text-primary-foreground",
      itemInactive: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      mobileBadge: "bg-slate-100 text-slate-900",
      userCard: "bg-slate-100",
      userText: "text-slate-900",
      userSub: "text-slate-600",
      logoutBtn: "text-slate-400 hover:text-slate-900 hover:bg-slate-100",
      divider: "border-slate-200"
    },
    navy: {
      aside: "bg-[#172554] text-slate-50 border-r border-blue-900",
      border: "border-blue-900",
      logoIconBg: "bg-primary",
      logoIconText: "text-primary-foreground",
      logoText: "text-white",
      logoSub: "text-blue-300",
      closeBtn: "text-blue-300 hover:bg-blue-900",
      sectionTitle: "text-blue-400/60",
      itemActive: "bg-primary text-primary-foreground",
      itemInactive: "text-blue-300 hover:bg-blue-900/50 hover:text-white",
      mobileBadge: "bg-blue-900 text-blue-100",
      userCard: "bg-blue-900/50",
      userText: "text-blue-100",
      userSub: "text-blue-300",
      logoutBtn: "text-blue-400 hover:text-white hover:bg-blue-900",
      divider: "border-blue-900"
    },
    slate: {
      aside: "bg-[#1e293b] text-slate-50 border-r border-slate-700",
      border: "border-slate-700",
      logoIconBg: "bg-primary",
      logoIconText: "text-primary-foreground",
      logoText: "text-white",
      logoSub: "text-slate-400",
      closeBtn: "text-slate-400 hover:bg-slate-700",
      sectionTitle: "text-slate-500",
      itemActive: "bg-primary text-primary-foreground",
      itemInactive: "text-slate-400 hover:bg-slate-700/50 hover:text-white",
      mobileBadge: "bg-slate-800 text-slate-200",
      userCard: "bg-slate-800",
      userText: "text-slate-200",
      userSub: "text-slate-400",
      logoutBtn: "text-slate-500 hover:text-white hover:bg-slate-700",
      divider: "border-slate-700"
    }
  }

  // Prevent body scroll when AppShell is active to avoid white space at the bottom
  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  const currentStyle = styles[sidebarColor as keyof typeof styles] || styles.dark

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-50/50 fixed inset-0">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSidebarOpen(false)
          }}
          role="button"
          tabIndex={0}
          aria-label="Fechar menu"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col transition-transform duration-300 lg:static lg:translate-x-0",
          currentStyle.aside,
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className={cn(
            "flex h-16 items-center gap-3 border-b px-6",
            currentStyle.border
        )}>
          <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              currentStyle.logoIconBg
          )}>
            <Shield className={cn(
                "h-5 w-5",
                currentStyle.logoIconText
            )} />
          </div>
          <div className="flex flex-col">
            <span className={cn(
                "text-sm font-bold tracking-wide",
                currentStyle.logoText
            )}>
              SisPatrimonio
            </span>
            <span className={cn(
                "text-xs",
                currentStyle.logoSub
            )}>Prefeitura Municipal</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
                "ml-auto lg:hidden",
                currentStyle.closeBtn
            )}
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Fechar menu</span>
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-3 px-2">
            <p className={cn(
                "text-xs font-semibold uppercase tracking-wider",
                currentStyle.sectionTitle
            )}>
              Menu Principal
            </p>
          </div>
          <ul className="flex flex-col gap-1">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? currentStyle.itemActive
                        : currentStyle.itemInactive
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {item.name}
                    {item.badge && (
                      <Badge className="ml-auto bg-warning text-warning-foreground text-[10px] px-1.5 py-0">
                        {item.badge}
                      </Badge>
                    )}
                    {item.name === "Escanear Patrimonio" && (
                      <Badge
                        variant="secondary"
                        className={cn(
                            "ml-auto text-[10px] px-1.5 py-0",
                            currentStyle.mobileBadge
                        )}
                      >
                        Mobile
                      </Badge>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Secretarias section - only for admin and gestor */}
          {user && (user.role === "administrador" || user.role === "gestor") && (
            <>
              <div className="mt-6 mb-3 px-2">
                <p className={cn(
                    "text-xs font-semibold uppercase tracking-wider",
                    currentStyle.sectionTitle
                )}>
                  Secretarias
                </p>
              </div>
              <ul className="flex flex-col gap-1">
                {(secretarias as Secretaria[]).map((sec) => {
                  const secKey = sec.nome
                  const isExpanded = expandedSecretaria === secKey
                  return (
                    <li key={secKey}>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSecretaria(isExpanded ? null : secKey)
                        }
                        className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            currentStyle.itemInactive
                        )}
                      >
                        <Building2 className={cn("h-4 w-4 shrink-0 opacity-70")} />
                        <span className="truncate">
                          {sec.nome.replace("Secretaria de ", "Sec. de ")}
                        </span>
                        <ChevronRight
                          className={cn(
                            "ml-auto h-4 w-4 transition-transform duration-200 opacity-60",
                            isExpanded && "rotate-90"
                          )}
                        />
                      </button>
                      {isExpanded && (
                        <ul className={cn(
                            "ml-4 mt-1 flex flex-col gap-0.5 border-l pl-3 pb-1",
                            currentStyle.border
                        )}>
                          {sec.departamentos.map((dep) => (
                            <li key={dep.nome}>
                              <Link
                                href={`/bens?secretaria=${encodeURIComponent(sec.nome)}&departamento=${encodeURIComponent(dep.nome)}`}
                                onClick={() => setSidebarOpen(false)}
                                className={cn(
                                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                                    currentStyle.itemInactive
                                )}
                              >
                                <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{dep.nome}</span>
                                <span className={cn("ml-auto text-[10px] opacity-60")}>
                                  {dep.salas.length}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {/* Assistente: show linked unit */}
          {user && user.role === "assistente" && user.unidade && (
            <>
              <div className="mt-6 mb-3 px-2">
                <p className={cn(
                    "text-xs font-semibold uppercase tracking-wider",
                    currentStyle.sectionTitle
                )}>
                  Minha Unidade
                </p>
              </div>
              <div className={cn(
                  "rounded-lg p-3",
                  currentStyle.userCard
              )}>
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className={cn("h-4 w-4", sidebarColor === 'dark' ? "text-sidebar-primary" : "text-primary")} />
                  <span className={cn(
                      "text-xs font-semibold",
                      currentStyle.userText
                  )}>
                    {user.unidade.secretaria.replace("Secretaria de ", "")}
                  </span>
                </div>
                <p className={cn(
                    "text-xs pl-6",
                    currentStyle.userSub
                )}>
                  {(user.unidade.departamentos?.length ? user.unidade.departamentos : [user.unidade.departamento].filter(Boolean)).join(", ")}
                </p>
              </div>
            </>
          )}
        </nav>

        {/* Sidebar footer */}
        <div className={cn(
            "border-t px-4 py-4",
            currentStyle.border
        )}>
          <div className="flex items-center gap-3 rounded-lg px-3 py-2 mb-2">
            <div className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                currentStyle.logoIconBg,
                currentStyle.logoIconText
            )}>
              {user?.avatar || "??"}
            </div>
            <div className="flex-1 min-w-0">
              <span className={cn(
                  "block text-sm font-medium truncate",
                  currentStyle.userText
              )}>
                {user?.nome || "Usuario"}
              </span>
              <Badge
                className={`text-[9px] px-1.5 py-0 mt-0.5 ${user ? roleColors[user.role] : ""}`}
              >
                {user ? roleLabels[user.role] : ""}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                  "h-8 w-8 shrink-0",
                  currentStyle.logoutBtn
              )}
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sair</span>
            </Button>
          </div>
          
          <div className="px-3 text-center">
            {/* <p className="text-[10px] text-sidebar-foreground/40">
                  Desenvolvido por <span className="font-semibold text-sidebar-foreground/60">Emerson</span>
                </p> */}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center gap-4 border-b border-border bg-card px-4 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir menu</span>
          </Button>

          <div className="relative hidden flex-1 max-w-md md:flex">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por patrimonio, descricao, responsavel..."
              className="pl-9 bg-muted border-0"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              onKeyDown={handleGlobalSearch}
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Role indicator */}
            {user && (
              <div className="hidden items-center gap-2 sm:flex">
                <Badge
                  variant="outline"
                  className={`text-xs ${roleColors[user.role]} border-0`}
                >
                  {roleLabels[user.role]}
                </Badge>
              </div>
            )}

            <NotificationsPopover />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
