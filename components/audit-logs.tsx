"use client"

import React from "react"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Search,
  Filter,
  Clock,
  User,
  Package,
  LogIn,
  LogOut,
  Pencil,
  Trash2,
  ArrowRightLeft,
  Tag,
  FileText,
  UserPlus,
  UserX,
  Wrench,
  XCircle,
  FileDown,
  ChevronDown,
  ChevronUp,
  Eye,
  Shield,
  Activity,
  Calendar,
  Hash,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react"
import {
  getLogActionLabel,
  getLogActionColor,
  formatDate,
  formatDateTime,
  formatTime,
  type AuditLog,
  type LogAction,
} from "@/lib/data"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { api, fetcher } from "@/lib/api-client"

const actionIcons: Record<LogAction, React.ComponentType<{ className?: string }>> = {
  cadastro: Package,
  edicao: Pencil,
  exclusao: Trash2,
  transferencia: ArrowRightLeft,
  baixa: XCircle,
  manutencao: Wrench,
  patrimonio_definitivo: Tag,
  entrada_nf: FileText,
  login: LogIn,
  logout: LogOut,
  usuario_criado: UserPlus,
  usuario_editado: Pencil,
  usuario_desativado: UserX,
  etiqueta_gerada: Tag,
  relatorio_gerado: FileDown,
  emprestimo: ArrowUpRight,
  devolucao: ArrowDownLeft,
}

function groupLogsByDate(logs: AuditLog[]): Record<string, AuditLog[]> {
  const groups: Record<string, AuditLog[]> = {}
  for (const log of logs) {
    if (!log.dataHora) continue
    const dateKey = log.dataHora.split("T")[0]
    if (!groups[dateKey]) groups[dateKey] = []
    groups[dateKey].push(log)
  }
  return groups
}

export function AuditLogs() {
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState<string>("todas")
  const [userFilter, setUserFilter] = useState<string>("todos")
  const [entityFilter, setEntityFilter] = useState<string>("todos")
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined)
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [limit] = useState(300)

  const queryParams = new URLSearchParams()
  queryParams.set("page", page.toString())
  queryParams.set("limit", limit.toString())
  if (actionFilter !== "todas") queryParams.set("acao", actionFilter)
  if (userFilter !== "todos") queryParams.set("usuario", userFilter) // This works differently now, it filters by name in backend, or we filter in frontend. Let's rely on backend where possible.
  // Actually the original implementation fetched all and filtered in frontend.
  // With pagination, we should fetch from backend with filters.
  
  // To keep it simple and preserve existing user list, let's fetch a list of users for the filter, 
  // and fetch logs based on the selected filters.
  
  if (dataInicio) queryParams.set("dataInicio", dataInicio.toISOString().split('T')[0])
  if (dataFim) queryParams.set("dataFim", dataFim.toISOString().split('T')[0])
  if (search) queryParams.set("busca", search)

  const { data: logsData } = useSWR(`/logs?${queryParams.toString()}`, fetcher)
  
  const logs = logsData?.data || []
  const meta = logsData?.meta || { total: 0, page: 1, limit: 300, totalPages: 1 }

  // Fetch all logs once just to extract unique users? No, better to fetch users from /api/usuarios
  const { data: usersData } = useSWR("/usuarios", fetcher)
  const uniqueUsers = useMemo(() => {
    const users = new Map<string, string>()
    if (usersData && Array.isArray(usersData)) {
      for (const u of usersData) {
        users.set(String(u.id), u.nome)
      }
    }
    return Array.from(users.entries())
  }, [usersData])

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // We filter entity in frontend since backend doesn't have entity filter parameter implemented directly.
  const filtered = useMemo(() => {
    return logs.filter((log: AuditLog) => {
      const matchEntity =
        entityFilter === "todos" ||
        (entityFilter === "sem_entidade" && !log.entidade) ||
        (log.entidade && log.entidade.tipo === entityFilter)

      // Apply user filter here if backend doesn't support by ID
      const matchUser = userFilter === "todos" || (log.usuario && log.usuario.id === userFilter)

      return matchEntity && matchUser
    })
  }, [entityFilter, userFilter, logs])

  const grouped = useMemo(() => groupLogsByDate(filtered), [filtered])
  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  // Stats
  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    const todayLogs = logs.filter((l: AuditLog) => l.dataHora && l.dataHora.startsWith(today))
    const criticos = logs.filter((l: AuditLog) =>
      ["exclusao", "baixa", "usuario_desativado"].includes(l.acao)
    )
    return {
      total: meta.total || logs.length,
      hoje: todayLogs.length,
      criticos: criticos.length,
      usuarios: new Set(logs.map((l: AuditLog) => l.usuario?.id).filter(Boolean)).size,
    }
  }, [logs, meta.total])

  const toggleGroup = (dateKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-balance">
          Registro de Atividades
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historico completo de todas as acoes realizadas no sistema
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Registros</p>
              <p className="text-lg font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
              <Calendar className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Hoje</p>
              <p className="text-lg font-bold">{stats.hoje}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <Shield className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Acoes Criticas</p>
              <p className="text-lg font-bold">{stats.criticos}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-info/10">
              <User className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Usuarios Ativos</p>
              <p className="text-lg font-bold">{stats.usuarios}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por descricao, usuario, entidade..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <DatePicker
                  date={dataInicio}
                  setDate={setDataInicio}
                  placeholder="Data Início"
                />
                <span className="text-muted-foreground text-sm">até</span>
                <DatePicker
                  date={dataFim}
                  setDate={setDataFim}
                  placeholder="Data Fim"
                />
              </div>

              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-44">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Acao" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas Acoes</SelectItem>
                  <SelectItem value="cadastro">Cadastro</SelectItem>
                  <SelectItem value="edicao">Edicao</SelectItem>
                  <SelectItem value="exclusao">Exclusao</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="manutencao">Manutencao</SelectItem>
                  <SelectItem value="patrimonio_definitivo">Patrimonio Definitivo</SelectItem>
                  <SelectItem value="entrada_nf">Entrada por NF</SelectItem>
                  <SelectItem value="emprestimo">Emprestimo</SelectItem>
                  <SelectItem value="devolucao">Devolucao</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                  <SelectItem value="usuario_criado">Usuario Criado</SelectItem>
                  <SelectItem value="usuario_desativado">Usuario Desativado</SelectItem>
                  <SelectItem value="etiqueta_gerada">Etiqueta Gerada</SelectItem>
                  <SelectItem value="relatorio_gerado">Relatorio Gerado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-44">
                  <User className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Usuarios</SelectItem>
                  {uniqueUsers.map(([id, nome]) => (
                    <SelectItem key={id} value={id}>
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-44">
                  <Package className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Entidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas Entidades</SelectItem>
                  <SelectItem value="bem">Bens</SelectItem>
                  <SelectItem value="veiculo">Veiculos</SelectItem>
                  <SelectItem value="usuario">Usuarios</SelectItem>
                  <SelectItem value="movimentacao">Movimentacoes</SelectItem>
                  <SelectItem value="emprestimo">Emprestimos</SelectItem>
                  <SelectItem value="relatorio">Relatorios</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results count & Pagination */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {meta.total} registro{meta.total !== 1 ? "s" : ""} encontrado{meta.total !== 1 ? "s" : ""}
        </p>

        {meta.totalPages > 1 && (
          <Pagination className="justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              <PaginationItem>
                <span className="text-sm text-muted-foreground px-4">
                  Página {page} de {meta.totalPages}
                </span>
              </PaginationItem>

              <PaginationItem>
                <PaginationNext 
                  onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                  className={page === meta.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      {/* Timeline grouped by date */}
      <div className="flex flex-col gap-4">
        {dateKeys.map((dateKey) => {
          const logs = grouped[dateKey]
          const isCollapsed = expandedGroups.has(dateKey)
          const dateLabel = formatDate(dateKey)
          const isToday = dateKey === new Date().toISOString().split("T")[0]

          return (
            <div key={dateKey}>
              {/* Date header */}
              <button
                type="button"
                onClick={() => toggleGroup(dateKey)}
                className="flex w-full items-center gap-3 mb-3"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      isToday ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <Calendar
                      className={`h-4 w-4 ${
                        isToday ? "text-primary-foreground" : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  <span className="text-sm font-semibold">
                    {isToday ? "Hoje" : dateLabel}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {logs.length}
                  </Badge>
                </div>
                <div className="flex-1 border-t border-border" />
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {/* Log entries */}
              {!isCollapsed && (
                <div className="flex flex-col gap-2 ml-4 pl-6 border-l-2 border-border">
                  {logs.map((log) => {
                    const IconComponent = actionIcons[log.acao] || Activity // Fallback to Activity if icon not found
                    const isCritical = ["exclusao", "baixa", "usuario_desativado"].includes(
                      log.acao
                    )

                    return (
                      <div
                        key={log.id}
                        className={`relative flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50 ${
                          isCritical
                            ? "border-destructive/20 bg-destructive/5"
                            : "border-border"
                        }`}
                      >
                        {/* Timeline dot */}
                        <div className="absolute -left-[33px] top-5 h-3 w-3 rounded-full border-2 border-background bg-border" />

                        {/* Icon */}
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            isCritical ? "bg-destructive/10" : "bg-muted"
                          }`}
                        >
                          <IconComponent
                            className={`h-4 w-4 ${
                              isCritical ? "text-destructive" : "text-muted-foreground"
                            }`}
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-snug">
                                {log.descricao}
                              </p>
                              {log.detalhes && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {log.detalhes}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="sr-only">Ver detalhes</span>
                            </Button>
                          </div>

                          {/* Meta */}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge
                              className={`text-[10px] px-1.5 py-0 ${getLogActionColor(log.acao)}`}
                            >
                              {getLogActionLabel(log.acao)}
                            </Badge>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              {log.usuario?.nome || "Sistema"}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatTime(log.dataHora)}
                            </span>
                            {log.entidade && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Hash className="h-3 w-3" />
                                {log.entidade.descricao}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {dateKeys.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum registro encontrado com os filtros selecionados.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedLog && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">Detalhes do Registro</DialogTitle>
                <DialogDescription className="sr-only">Detalhes do registro de auditoria.</DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-5 mt-2">
                {/* Action badge */}
                <div className="flex items-center gap-3">
                  <Badge className={`${getLogActionColor(selectedLog.acao)} text-xs`}>
                    {getLogActionLabel(selectedLog.acao)}
                  </Badge>
                  {["exclusao", "baixa", "usuario_desativado"].includes(selectedLog.acao) && (
                    <Badge variant="outline" className="text-xs border-destructive/50 text-destructive">
                      Acao Critica
                    </Badge>
                  )}
                </div>

                {/* Description */}
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm font-medium">{selectedLog.descricao}</p>
                  {selectedLog.detalhes && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {selectedLog.detalhes}
                    </p>
                  )}
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Usuario</p>
                    <p className="text-sm font-medium">{selectedLog.usuario?.nome || "Sistema"}</p>
                    <Badge variant="secondary" className="text-[10px] mt-1">
                      {selectedLog.usuario?.role || "sistema"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Data / Hora</p>
                    <p className="text-sm font-medium">{formatDateTime(selectedLog.dataHora)}</p>
                  </div>
                  {selectedLog.ip && (
                    <div>
                      <p className="text-xs text-muted-foreground">Endereco IP</p>
                      <p className="text-sm font-mono">{selectedLog.ip}</p>
                    </div>
                  )}
                  {selectedLog.entidade && (
                    <div>
                      <p className="text-xs text-muted-foreground">Entidade</p>
                      <p className="text-sm font-medium">{selectedLog.entidade.descricao}</p>
                      <Badge variant="outline" className="text-[10px] mt-1">
                        {selectedLog.entidade.tipo}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Data changes */}
                {(selectedLog.dadosAnteriores || selectedLog.dadosNovos) && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Alteracoes nos Dados
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {selectedLog.dadosAnteriores && (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive mb-2">
                            Antes
                          </p>
                          {Object.entries(selectedLog.dadosAnteriores).map(([key, value]) => (
                            <div key={key} className="flex justify-between py-1">
                              <span className="text-xs text-muted-foreground">{key}</span>
                              <span className="text-xs font-mono font-medium">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedLog.dadosNovos && (
                        <div className="rounded-lg border border-success/20 bg-success/5 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-success mb-2">
                            Depois
                          </p>
                          {Object.entries(selectedLog.dadosNovos).map(([key, value]) => (
                            <div key={key} className="flex justify-between py-1">
                              <span className="text-xs text-muted-foreground">{key}</span>
                              <span className="text-xs font-mono font-medium">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Log ID */}
                <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                  <span className="text-xs text-muted-foreground">ID do Registro</span>
                  <span className="text-xs font-mono">{selectedLog.id}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
