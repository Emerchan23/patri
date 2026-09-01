"use client"

import Link from "next/link"
import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import {
  Package,
  CheckCircle2,
  Wrench,
  XCircle,
  Clock,
  Car,
  ArrowRightLeft,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Tag,
  Loader2,
  Building2,
  MapPin,
  DoorOpen,
  Filter
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency, formatDate, getCategoryLabel, getStatusLabel, getStatusColor } from "@/lib/data"
import { api } from "@/lib/api-client"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const CHART_COLORS = [
  "hsl(210, 70%, 42%)",
  "hsl(170, 55%, 40%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(262, 52%, 47%)",
  "hsl(120, 60%, 45%)",
  "hsl(300, 70%, 50%)",
  "hsl(240, 60%, 50%)",
  "hsl(60, 80%, 45%)",
  "hsl(15, 80%, 50%)",
]

const fetcher = (url: string) => api.dashboardStats(url)

export function Dashboard() {
  const { user, hasPermission } = useAuth()
  const [selectedSecretaria, setSelectedSecretaria] = useState<string>("all")
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>("all")
  const [selectedSala, setSelectedSala] = useState<string>("all")
  const [hasLoadedDashboardOnce, setHasLoadedDashboardOnce] = useState(false)

  // Carregar do localStorage ao iniciar
  useEffect(() => {
    const savedSecretaria = localStorage.getItem("dashboard_selected_secretaria")
    if (savedSecretaria) {
      setSelectedSecretaria(savedSecretaria)
    }
  }, [])

  // Fetch stats with filter if a secretariat is selected
  const statsUrl = selectedSecretaria !== "all" ? `secretaria=${encodeURIComponent(selectedSecretaria)}` : ""
  const { data: stats, isLoading, isValidating, error, mutate: retryDashboard } = useSWR(
    ["dashboard-stats", statsUrl],
    () => api.dashboardStats(statsUrl),
    {
      refreshInterval: 60000,
      keepPreviousData: true,
      errorRetryCount: 3,
      errorRetryInterval: 1500,
    }
  )
  
  // Fetch hierarchy for dropdowns
  const { data: secretariasData } = useSWR("secretarias-list", () => api.getSecretarias("all=true"))
  const secretarias = Array.isArray(secretariasData) ? secretariasData : (secretariasData?.data || [])
  
  // Fetch filtered assets list when drill-down is active
  const shouldFetchAssets = selectedSecretaria !== "all"
  const assetsQuery = new URLSearchParams()
  if (selectedSecretaria !== "all") assetsQuery.set("secretaria", selectedSecretaria)
  if (selectedDepartamento !== "all") assetsQuery.set("departamento", selectedDepartamento)
  if (selectedSala !== "all") assetsQuery.set("sala", selectedSala)
  
  const { data: result, isLoading: isLoadingAssets } = useSWR(
    shouldFetchAssets ? ["bens-filtered", assetsQuery.toString()] : null,
    () => api.getBens(assetsQuery.toString())
  )
  const filteredAssets = result?.data || []
  const meta = result?.meta || { total: 0 }

  // Derived options for dropdowns
  const departamentoOptions = useMemo(() => {
    if (selectedSecretaria === "all" || !secretarias) return []
    const sec = secretarias.find((s: any) => s.nome === selectedSecretaria)
    return sec?.departamentos || []
  }, [selectedSecretaria, secretarias])

  const salaOptions = useMemo(() => {
    if (selectedDepartamento === "all" || !departamentoOptions) return []
    const dep = departamentoOptions.find((d: any) => d.nome === selectedDepartamento)
    return dep?.salas || []
  }, [selectedDepartamento, departamentoOptions])

  useEffect(() => {
    if (stats) {
      setHasLoadedDashboardOnce(true)
    }
  }, [stats])

  if (!stats && (isLoading || isValidating || !hasLoadedDashboardOnce)) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <p className="text-muted-foreground">
          Nao foi possivel concluir a primeira carga do dashboard agora. Estamos tentando novamente.
        </p>
        <Button variant="outline" onClick={() => retryDashboard()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  const categoryData = stats?.porCategoria || []
  const secretariaData = stats?.porSecretaria || []
  const departamentoData = stats?.porDepartamento || []
  const recentMovements = stats?.movimentacoesRecentes || []
  const provisorios = stats?.provisorios || []

  const handleSecretariaChange = (value: string) => {
    setSelectedSecretaria(value)
    setSelectedDepartamento("all")
    setSelectedSala("all")
    if (value === "all") {
      localStorage.removeItem("dashboard_selected_secretaria")
    } else {
      localStorage.setItem("dashboard_selected_secretaria", value)
    }
  }

  const handleDepartamentoChange = (value: string) => {
    setSelectedDepartamento(value)
    setSelectedSala("all")
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-balance">Dashboard Patrimonial</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visao geral do patrimonio municipal
        </p>
      </div>

      {hasPermission("verPendenciasPatrimonio") && stats.totalProvisorio > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
                <Tag className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {stats.totalProvisorio} bens aguardando patrimonio definitivo
                </p>
                <p className="text-xs text-muted-foreground">
                  Acesse a tela de pendencias para atribuir numeros e gerar etiquetas
                </p>
              </div>
            </div>
            <Link href="/pendencias">
              <Button size="sm" className="gap-2">
                Gerenciar Pendencias
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Bens</p>
              <p className="text-2xl font-bold">{stats.totalBens}</p>
            </div>
          </CardContent>
        </Card>
        <Link href="/bens?status=ativo" className="block transition-transform hover:scale-[1.02]">
          <Card className="h-full hover:border-success/50 cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ativos</p>
                <p className="text-2xl font-bold">{stats.totalAtivos}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/bens?status=em_manutencao" className="block transition-transform hover:scale-[1.02]">
          <Card className="h-full hover:border-warning/50 cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning/10">
                <Wrench className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Manutencao</p>
                <p className="text-2xl font-bold">{stats.totalManutencao}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/bens?status=baixado" className="block transition-transform hover:scale-[1.02]">
          <Card className="h-full hover:border-destructive/50 cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Baixados</p>
                <p className="text-2xl font-bold">{stats.totalBaixados}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/pendencias" className="block transition-transform hover:scale-[1.02]">
          <Card className="border-l-4 border-l-info h-full cursor-pointer hover:bg-muted/50">
            <CardContent className="flex items-center gap-4 p-5">
              <Clock className="h-5 w-5 text-info shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">Patrimonios Provisorios</p>
                <p className="text-xl font-bold">{stats.totalProvisorio}</p>
                <p className="text-xs text-muted-foreground">Aguardando definitivo</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/veiculos" className="block transition-transform hover:scale-[1.02]">
          <Card className="border-l-4 border-l-primary h-full cursor-pointer hover:bg-muted/50">
            <CardContent className="flex items-center gap-4 p-5">
              <Car className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">Veiculos</p>
                <p className="text-xl font-bold">{stats.totalVeiculos}</p>
                <p className="text-xs text-muted-foreground">Na frota municipal</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Card className="border-l-4 border-l-accent">
          <CardContent className="flex items-center gap-4 p-5">
            <TrendingUp className="h-5 w-5 text-accent shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className="text-xl font-bold">{formatCurrency(stats.valorTotal)}</p>
              <p className="text-xs text-muted-foreground">Em patrimonio</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drill-down Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">
                  {selectedSecretaria !== "all" ? `Departamentos: ${selectedSecretaria}` : "Bens por Secretaria"}
                </CardTitle>
                <CardDescription>
                  {selectedSecretaria !== "all" 
                    ? "Distribuicao de bens por departamentos desta secretaria" 
                    : "Distribuicao de bens entre as secretarias"}
                </CardDescription>
              </div>
              <Select value={selectedSecretaria} onValueChange={handleSecretariaChange}>
                <SelectTrigger className="w-[200px]">
                  <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Filtrar Secretaria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Secretarias</SelectItem>
                  {secretarias?.map((s: any) => (
                    <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={selectedSecretaria !== "all" 
                  ? departamentoData.map((d: any) => ({ name: d.departamento, bens: d.quantidade }))
                  : secretariaData.map((s: any) => ({ name: (s.secretaria || "").replace("Secretaria de ", "").substring(0, 15), bens: s.quantidade }))
                }>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(0, 0%, 100%)",
                      border: "1px solid hsl(214, 15%, 88%)",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="bens" radius={[6, 6, 0, 0]}>
                    {(selectedSecretaria !== "all" 
                      ? departamentoData 
                      : secretariaData
                    ).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por Categoria</CardTitle>
            <CardDescription>Tipos de bens cadastrados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData.map((c: any) => ({ name: getCategoryLabel(c.categoria), value: c.quantidade }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryData.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {categoryData.map((item: any, i: number) => (
                <div key={item.categoria} className="flex items-center gap-1.5">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {getCategoryLabel(item.categoria)} ({item.quantidade})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtered Assets List Section - Only visible when filtering */}
      {selectedSecretaria !== "all" && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">Bens Localizados</CardTitle>
                <CardDescription>
                  Listagem de bens filtrados por localizacao
                </CardDescription>
              </div>
              <div className="flex gap-3">
                <Select value={selectedDepartamento} onValueChange={handleDepartamentoChange}>
                  <SelectTrigger className="w-[200px]">
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Selecione Departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Departamentos</SelectItem>
                    {departamentoOptions.map((d: any) => (
                      <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedSala} onValueChange={setSelectedSala} disabled={selectedDepartamento === "all"}>
                  <SelectTrigger className="w-[200px]">
                    <DoorOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Selecione Sala" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Salas</SelectItem>
                    {salaOptions.map((s: any) => (
                      <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingAssets ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="rounded-md border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patrimonio</TableHead>
                      <TableHead>Descricao</TableHead>
                      <TableHead>Localizacao</TableHead>
                      <TableHead>Responsavel</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Nenhum bem encontrado nesta localizacao.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAssets.slice(0, 10).map((asset: any) => (
                        <TableRow key={asset.id}>
                          <TableCell className="font-mono">{asset.patrimonio}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{asset.descricao}</span>
                              <span className="text-xs text-muted-foreground">{getCategoryLabel(asset.categoria)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col text-xs">
                              <span className="font-medium">{asset.localizacao.departamento}</span>
                              <span className="text-muted-foreground">{asset.localizacao.sala}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{typeof asset.responsavel === 'object' ? asset.responsavel.nome : asset.responsavel}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${getStatusColor(asset.status)}`}>
                              {getStatusLabel(asset.status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {filteredAssets.length > 10 && (
                  <div className="p-3 text-center border-t text-xs text-muted-foreground">
                    Exibindo 10 de {meta.total} bens. Use a busca completa para ver todos.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Movimentacoes Recentes</CardTitle>
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {recentMovements.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentacao recente</p>
              )}
              {recentMovements.slice(0, 4).map((mov: any) => (
                <div
                  key={mov.id}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <ArrowRightLeft className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{mov.bem_descricao}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {mov.de_departamento} {"->"}  {mov.para_departamento}
                    </p>
                    <p className="text-xs text-muted-foreground">{mov.responsavel}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(mov.data_movimentacao)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Patrimonios Provisorios</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </div>
            <CardDescription>
              Bens aguardando numero de patrimonio definitivo da prefeitura
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {provisorios.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum patrimonio provisorio</p>
              )}
              {provisorios.map((asset: any) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/10">
                    <Clock className="h-4 w-4 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{asset.descricao}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning/50 text-warning">
                        {asset.numero_patrimonio || asset.numero_provisorio}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {getCategoryLabel(asset.categoria)}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {asset.departamento}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
