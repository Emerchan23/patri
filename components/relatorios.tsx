"use client"

import React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SearchableSelect } from "@/components/ui/searchable-select"
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
  FileText,
  Building2,
  ArrowRightLeft,
  FileCheck,
  XCircle,
  Clock,
  Download,
  Settings2,
  Filter,
  Package,
  Printer,
} from "lucide-react"
import {
  formatCurrency,
  type PdfSettings,
  defaultPdfSettings,
} from "@/lib/data"
import {
  gerarRelatorioInventarioGeral,
  gerarRelatorioPorSecretaria,
  gerarRelatorioMovimentacoes,
  gerarRelatorioTermoResponsabilidade,
  gerarRelatorioBaixas,
  gerarRelatorioProvisorio,
  gerarRelatorioPorDepartamento,
  gerarRelatorioPorSala,
} from "@/lib/pdf-generator"
import { api, fetcher } from "@/lib/api-client"
import useSWR from "swr"
import type { Asset, Movement } from "@/lib/data"
import { useToast } from "@/components/ui/use-toast"

interface ReportType {
  id: string
  nome: string
  descricao: string
  icon: React.ComponentType<{ className?: string }>
  cor: string
  filtros: string[]
}

const reportTypes: ReportType[] = [
  {
    id: "inventario",
    nome: "Inventario Geral",
    descricao: "Lista completa de todos os bens patrimoniais com valores e localizacao",
    icon: Package,
    cor: "bg-primary/10 text-primary",
    filtros: ["secretaria", "grupo", "categoria", "status"],
  },
  {
    id: "secretaria",
    nome: "Relatorio por Secretaria",
    descricao: "Bens agrupados por departamento dentro de uma secretaria especifica",
    icon: Building2,
    cor: "bg-info/10 text-info",
    filtros: ["secretaria"],
  },
  {
    id: "departamento",
    nome: "Relatorio por Departamento",
    descricao: "Bens agrupados por sala dentro de um departamento especifico",
    icon: Building2,
    cor: "bg-purple-500/10 text-purple-500",
    filtros: ["secretaria", "departamento"],
  },
  {
    id: "sala",
    nome: "Relatorio por Sala",
    descricao: "Lista de bens localizados em uma sala especifica",
    icon: Building2,
    cor: "bg-pink-500/10 text-pink-500",
    filtros: ["secretaria", "departamento", "sala"],
  },
  {
    id: "movimentacoes",
    nome: "Movimentacoes",
    descricao: "Historico de transferencias de bens entre setores e departamentos",
    icon: ArrowRightLeft,
    cor: "bg-accent/10 text-accent",
    filtros: ["secretaria", "departamento", "sala"],
  },
  {
    id: "termo",
    nome: "Termo de Responsabilidade",
    descricao: "Documento de responsabilidade individual para um bem especifico",
    icon: FileCheck,
    cor: "bg-success/10 text-success",
    filtros: ["bem"],
  },
  {
    id: "baixas",
    nome: "Bens Baixados",
    descricao: "Relatorio de todos os bens que foram baixados do patrimonio",
    icon: XCircle,
    cor: "bg-destructive/10 text-destructive",
    filtros: [],
  },
  {
    id: "provisorios",
    nome: "Patrimonios Provisorios",
    descricao: "Bens aguardando atribuicao de numero de patrimonio definitivo",
    icon: Clock,
    cor: "bg-warning/10 text-warning",
    filtros: ["secretaria", "departamento", "sala"],
  },
  {
    id: "emenda",
    nome: "Bens por Emenda Parlamentar",
    descricao: "Relatorio de bens adquiridos atraves de Emenda Parlamentar",
    icon: FileText,
    cor: "bg-blue-500/10 text-blue-500",
    filtros: ["emenda", "secretaria", "departamento", "sala"],
  },
]

export function Relatorios() {
  const { toast } = useToast()
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Filter state
  const [filterSecretaria, setFilterSecretaria] = useState("todas")
  const [filterDepartamento, setFilterDepartamento] = useState("todos")
  const [filterSala, setFilterSala] = useState("todos")
  const [filterGrupo, setFilterGrupo] = useState("todos")
  const [filterCategoria, setFilterCategoria] = useState("todas")
  const [filterStatus, setFilterStatus] = useState("todos")
  const [filterBem, setFilterBem] = useState("")
  const [filterEmenda, setFilterEmenda] = useState("")
  
  // Load data from API
  const { data: bensResult } = useSWR("/bens?veiculos=false&limit=9999", fetcher)
  const { data: veiculos = [] } = useSWR<Asset[]>("/veiculos", fetcher)
  const { data: movimentacoesResult } = useSWR("/movimentacoes?limit=9999", fetcher)
  const { data: secretariasData } = useSWR("/secretarias?all=true", fetcher)
  const secretarias = (Array.isArray(secretariasData) ? secretariasData : (secretariasData?.data || [])) as any[]
  
  const { data: gruposData } = useSWR("/api/grupos?all=true", fetcher)
  const grupos = (Array.isArray(gruposData) ? gruposData : (gruposData?.data || [])) as any[]

  const bens = bensResult?.data || []
  const movimentacoes = movimentacoesResult?.data || []
  
  const { data: apiPdfSettings } = useSWR<PdfSettings>("/configuracoes/pdf", fetcher)
  
  const pdfSettings = apiPdfSettings || defaultPdfSettings

  const allAssets = [...bens, ...veiculos]

  // Computed lists based on selection
  const selectedSec = secretarias.find((s) => s.nome.replace("Secretaria de ", "") === filterSecretaria || s.nome === filterSecretaria)
  const departamentosList = filterSecretaria === "todas" 
    ? secretarias.flatMap((s) => s.departamentos || [])
    : selectedSec?.departamentos || []
  
  const selectedDep = departamentosList.find((d: any) => d.nome === filterDepartamento)
  const salasList = filterDepartamento === "todos"
    ? departamentosList.flatMap((d: any) => d.salas || [])
    : selectedDep?.salas || []

  const assetMatchesLocationFilter = (asset: Asset) => {
    const secretariaNome = asset.localizacao?.secretaria || asset.secretaria || ""
    const departamentoNome = asset.localizacao?.departamento || asset.departamento || ""
    const salaNome = asset.localizacao?.sala || asset.sala || ""

    if (filterSecretaria !== "todas" && secretariaNome !== filterSecretaria) return false
    if (filterDepartamento !== "todos" && departamentoNome !== filterDepartamento) return false
    if (filterSala !== "todos" && salaNome !== filterSala) return false
    return true
  }

  const movementMatchesLocationFilter = (movement: Movement) => {
    const origemSecretaria = movement.de?.secretaria || movement.de_secretaria || ""
    const destinoSecretaria = movement.para?.secretaria || movement.para_secretaria || ""
    const origemDepartamento = movement.de?.departamento || movement.de_departamento || ""
    const destinoDepartamento = movement.para?.departamento || movement.para_departamento || ""
    const origemSala = movement.de?.sala || movement.de_sala || ""
    const destinoSala = movement.para?.sala || movement.para_sala || ""

    if (
      filterSecretaria !== "todas" &&
      origemSecretaria !== filterSecretaria &&
      destinoSecretaria !== filterSecretaria
    ) {
      return false
    }

    if (
      filterDepartamento !== "todos" &&
      origemDepartamento !== filterDepartamento &&
      destinoDepartamento !== filterDepartamento
    ) {
      return false
    }

    if (filterSala !== "todos" && origemSala !== filterSala && destinoSala !== filterSala) {
      return false
    }

    return true
  }

  const openReport = (report: ReportType) => {
    setSelectedReport(report)
    setFilterSecretaria("todas")
    setFilterDepartamento("todos")
    setFilterSala("todos")
    setFilterGrupo("todos")
    setFilterCategoria("todas")
    setFilterStatus("todos")
    setFilterBem("")
    setFilterEmenda("")
    setDialogOpen(true)
  }

  const generateReport = () => {
    if (!selectedReport) return

    const options = { settings: pdfSettings }

    try {
      switch (selectedReport.id) {
        case "inventario":
          gerarRelatorioInventarioGeral(allAssets, {
            ...options,
            secretaria: filterSecretaria,
            departamento: filterDepartamento,
            grupo: filterGrupo,
            categoria: filterCategoria,
            status: filterStatus,
          })
          break
        case "secretaria": {
          const secNome = filterSecretaria === "todas" ? "todas" : filterSecretaria
          gerarRelatorioPorSecretaria(allAssets, secNome, options)
          break
        }
        case "departamento": {
          const secNomeDep = filterSecretaria === "todas" ? "todas" : filterSecretaria
          gerarRelatorioPorDepartamento(allAssets, filterDepartamento, secNomeDep, options)
          break
        }
        case "sala": {
          const secNomeSala = filterSecretaria === "todas" ? "todas" : filterSecretaria
          gerarRelatorioPorSala(allAssets, filterSala, filterDepartamento, secNomeSala, options)
          break
        }
        case "movimentacoes":
          const filteredMovimentacoes = movimentacoes.filter(movementMatchesLocationFilter)
          if (filteredMovimentacoes.length === 0) {
            toast({
              title: "Sem dados",
              description: "Não há movimentações para gerar relatório com os filtros selecionados.",
              variant: "destructive",
            })
            return
          }
          gerarRelatorioMovimentacoes(filteredMovimentacoes, options)
          break
        case "termo": {
          if (!filterBem) {
            toast({
              title: "Erro de validação",
              description: "Selecione um bem para gerar o termo.",
              variant: "destructive",
            })
            return
          }
          // @ts-ignore - ID mismatch string/number
          const bem = allAssets.find((a) => String(a.id) === String(filterBem))
          if (!bem) {
             toast({ title: "Erro", description: "Bem não encontrado.", variant: "destructive" })
             return
          }
          gerarRelatorioTermoResponsabilidade(bem, options)
          break
        }
        case "baixas":
          const baixados = allAssets.filter(a => a.status === 'baixado')
          if (baixados.length === 0) {
             toast({ title: "Sem dados", description: "Não há bens baixados.", variant: "destructive" })
             return
          }
          gerarRelatorioBaixas(allAssets, options)
          break
        case "provisorios":
          const provs = allAssets.filter(a => a.patrimonioTipo === 'provisorio' && assetMatchesLocationFilter(a))
          if (provs.length === 0) {
             toast({ title: "Sem dados", description: "Não há bens provisórios com os filtros selecionados.", variant: "destructive" })
             return
          }
          gerarRelatorioProvisorio(provs, options)
          break
        case "emenda":
            const emendaFiltro = filterEmenda.trim().toLowerCase()
            const bensEmenda = allAssets.filter((a) => {
              const emenda = a.emendaParlamentar?.trim() || ""
              if (!emenda) return false
              if (emendaFiltro && !emenda.toLowerCase().includes(emendaFiltro)) return false
              return assetMatchesLocationFilter(a)
            })
            if (bensEmenda.length === 0) {
                toast({ title: "Sem dados", description: "Não há bens vinculados a emendas com os filtros selecionados.", variant: "destructive" })
                return
            }
            gerarRelatorioInventarioGeral(bensEmenda, {
                ...options,
                titulo: filterEmenda ? `Relatório de Emenda: ${filterEmenda}` : "Relatório de Bens por Emenda Parlamentar",
                secretaria: filterSecretaria,
                departamento: filterDepartamento,
              })
            break
      }
      
      toast({
        title: "Relatório gerado",
        description: "O PDF foi aberto em uma nova aba.",
      })

      setDialogOpen(false)
    } catch (error) {
      console.error(error)
      toast({
        title: "Erro ao gerar relatório",
        description: "Ocorreu um erro inesperado.",
        variant: "destructive",
      })
    }
  }

  // Stats for quick info
  const stats = {
    totalBens: allAssets.length,
    valorTotal: allAssets.reduce((sum, a) => sum + (Number(a.valor) || 0), 0),
    provisorios: allAssets.filter((a) => a.patrimonioTipo === "provisorio").length,
    baixados: allAssets.filter((a) => a.status === "baixado").length,
    movimentacoes: movimentacoes.length,
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">Relatorios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gere relatorios em PDF para controle e auditoria patrimonial
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2 bg-transparent"
          onClick={() => window.location.href = "/configuracoes"}
        >
          <Settings2 className="h-4 w-4" />
          Personalizar PDF
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Bens</p>
          <p className="text-lg font-bold">{stats.totalBens}</p>
        </div>
        <div className="rounded-xl border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">Valor Total</p>
          <p className="text-lg font-bold">{formatCurrency(stats.valorTotal)}</p>
        </div>
        <div className="rounded-xl border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">Provisorios</p>
          <p className="text-lg font-bold text-warning">{stats.provisorios}</p>
        </div>
        <div className="rounded-xl border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">Baixados</p>
          <p className="text-lg font-bold text-destructive">{stats.baixados}</p>
        </div>
        <div className="rounded-xl border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">Movimentacoes</p>
          <p className="text-lg font-bold">{stats.movimentacoes}</p>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportTypes.map((report) => {
          const IconComp = report.icon
          return (
            <Card
              key={report.id}
              className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
              onClick={() => openReport(report)}
            >
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${report.cor}`}>
                    <IconComp className="h-5 w-5" />
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted opacity-0 transition-opacity group-hover:opacity-100">
                    <Printer className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{report.nome}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {report.descricao}
                  </p>
                </div>
                {report.filtros.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {report.filtros.map((f) => (
                      <Badge key={f} variant="secondary" className="text-[10px]">
                        <Filter className="h-2.5 w-2.5 mr-1" />
                        {f}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Generate Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg h-[90vh] flex flex-col p-0 gap-0">
          <div className="p-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {selectedReport && (
                  <>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${selectedReport.cor}`}>
                      <selectedReport.icon className="h-4 w-4" />
                    </div>
                    {selectedReport.nome}
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {selectedReport && (
              <div className="flex flex-col gap-6">
                <p className="text-sm text-muted-foreground">{selectedReport.descricao}</p>

                {/* Filters */}
                {selectedReport.filtros.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Filtros do Relatorio
                    </p>

                    <div className="space-y-4">
                      {selectedReport.filtros.includes("secretaria") && (
                        <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="filter-sec">Secretaria</label>
                        <SearchableSelect 
                          value={filterSecretaria} 
                          onValueChange={(v) => { setFilterSecretaria(v); setFilterDepartamento("todos"); setFilterSala("todos"); }}
                          placeholder="Selecione a secretaria..."
                          searchPlaceholder="Buscar secretaria..."
                          items={[
                            { value: "todas", label: "Todas as Secretarias" },
                            ...secretarias.map((s) => {
                              const nome = s.nome.replace("Secretaria de ", "")
                              return { value: nome, label: `Sec. de ${nome}`, searchTerms: s.nome }
                            })
                          ]}
                        />
                      </div>
                    )}

                    {selectedReport.filtros.includes("departamento") && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="filter-dep">Departamento</label>
                        <SearchableSelect 
                          value={filterDepartamento} 
                          onValueChange={(v) => { setFilterDepartamento(v); setFilterSala("todos"); }}
                          placeholder="Selecione o departamento..."
                          searchPlaceholder="Buscar departamento..."
                          items={[
                            { value: "todos", label: "Todos os Departamentos" },
                            ...departamentosList.map((d: any) => ({ value: d.nome, label: d.nome }))
                          ]}
                        />
                      </div>
                    )}

                    {selectedReport.filtros.includes("sala") && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="filter-sala">Sala</label>
                        <SearchableSelect 
                          value={filterSala} 
                          onValueChange={setFilterSala}
                          placeholder="Selecione a sala..."
                          searchPlaceholder="Buscar sala..."
                          items={[
                            { value: "todos", label: "Todas as Salas" },
                            ...salasList.map((s: any) => ({ value: s.nome, label: s.nome }))
                          ]}
                        />
                      </div>
                    )}

                    {selectedReport.filtros.includes("grupo") && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="filter-grupo">Grupo</label>
                        <SearchableSelect 
                          value={filterGrupo} 
                          onValueChange={setFilterGrupo}
                          placeholder="Selecione o grupo..."
                          searchPlaceholder="Buscar grupo..."
                          items={[
                            { value: "todos", label: "Todos os Grupos" },
                            ...grupos.map((g: any) => ({ value: g.nome, label: g.nome }))
                          ]}
                        />
                      </div>
                    )}

                    {selectedReport.filtros.includes("categoria") && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="filter-cat">Categoria</label>
                        <SearchableSelect 
                          value={filterCategoria} 
                          onValueChange={setFilterCategoria}
                          placeholder="Selecione a categoria..."
                          searchPlaceholder="Buscar categoria..."
                          items={[
                            { value: "todas", label: "Todas as Categorias" },
                            { value: "informatica", label: "Informatica" },
                            { value: "movel", label: "Movel" },
                            { value: "equipamento", label: "Equipamento" },
                            { value: "eletronico", label: "Eletronico" },
                            { value: "veiculo", label: "Veiculo" },
                          ]}
                        />
                      </div>
                    )}

                    {selectedReport.filtros.includes("status") && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="filter-status">Status</label>
                        <SearchableSelect 
                          value={filterStatus} 
                          onValueChange={setFilterStatus}
                          placeholder="Selecione o status..."
                          searchPlaceholder="Buscar status..."
                          items={[
                            { value: "todos", label: "Todos os Status" },
                            { value: "ativo", label: "Ativo" },
                            { value: "em_manutencao", label: "Em Manutencao" },
                            { value: "baixado", label: "Baixado" },
                          ]}
                        />
                      </div>
                    )}

                    {selectedReport.filtros.includes("bem") && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="filter-bem">Selecione o Bem</label>
                        <SearchableSelect 
                          value={filterBem} 
                          onValueChange={setFilterBem}
                          placeholder="Selecione um bem..."
                          searchPlaceholder="Buscar por número do patrimônio ou nome..."
                          items={allAssets.map((a) => ({
                            value: String(a.id),
                            label: `${a.patrimonio || a.patrimonioProvisorio || "Sem Número"} - ${a.descricao}`,
                            searchTerms: `${a.patrimonio || ""} ${a.patrimonioProvisorio || ""} ${a.descricao}`
                          }))}
                        />
                      </div>
                    )}

                    {selectedReport.filtros.includes("emenda") && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="filter-emenda">
                          Emenda Parlamentar
                        </label>
                        <input
                          id="filter-emenda"
                          value={filterEmenda}
                          onChange={(e) => setFilterEmenda(e.target.value)}
                          placeholder="Digite parte do nome, processo ou numero da emenda..."
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Preview info */}
              <div className="rounded-lg bg-muted/50 p-4 border border-border/50">
                <p className="text-xs font-semibold text-primary mb-3">Informacoes do Documento</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Formato</span>
                    <span className="font-medium">PDF (via impressao)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cabecalho</span>
                    <span className="font-medium truncate max-w-[200px] text-right" title={pdfSettings.nomeOrgao}>{pdfSettings.nomeOrgao}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Assinatura</span>
                    <span className="font-medium">{pdfSettings.mostrarAssinatura ? "Sim" : "Nao"}</span>
                  </div>
              </div>

              </div>
            </div>
            )}
          </div>
          
          <div className="p-4 border-t bg-background mt-auto flex justify-end gap-3 z-10">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button className="gap-2" onClick={generateReport}>
                  <Download className="h-4 w-4" />
                  Gerar Relatorio
                </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
