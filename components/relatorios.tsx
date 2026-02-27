"use client"

import React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
    filtros: ["secretaria", "categoria", "status"],
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
    id: "movimentacoes",
    nome: "Movimentacoes",
    descricao: "Historico de transferencias de bens entre setores e departamentos",
    icon: ArrowRightLeft,
    cor: "bg-accent/10 text-accent",
    filtros: [],
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
    filtros: [],
  },
]

export function Relatorios() {
  const { toast } = useToast()
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Filter state
  const [filterSecretaria, setFilterSecretaria] = useState("todas")
  const [filterCategoria, setFilterCategoria] = useState("todas")
  const [filterStatus, setFilterStatus] = useState("todos")
  const [filterBem, setFilterBem] = useState("")

  // Load data from API
  const { data: bensResult } = useSWR("/bens?veiculos=false&limit=9999", fetcher)
  const { data: veiculos = [] } = useSWR<Asset[]>("/veiculos", fetcher)
  const { data: movimentacoesResult } = useSWR("/movimentacoes?limit=9999", fetcher)
  const { data: secretarias = [] } = useSWR<any[]>("/secretarias", fetcher)

  const bens = bensResult?.data || []
  const movimentacoes = movimentacoesResult?.data || []
  
  const { data: apiPdfSettings } = useSWR<PdfSettings>("/configuracoes/pdf", fetcher)
  
  const pdfSettings = apiPdfSettings || defaultPdfSettings

  const allAssets = [...bens, ...veiculos]

  const openReport = (report: ReportType) => {
    setSelectedReport(report)
    setFilterSecretaria("todas")
    setFilterCategoria("todas")
    setFilterStatus("todos")
    setFilterBem("")
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
            categoria: filterCategoria,
            status: filterStatus,
          })
          break
        case "secretaria": {
          if (filterSecretaria === "todas" && selectedReport.filtros.includes("secretaria")) {
              // Just a warning, or let it generate for all?
              // The original code defaults to "Administracao" if "todas".
              // Let's keep it but maybe warn if that's not intended.
              // Actually, existing logic: const secNome = filterSecretaria === "todas" ? "Administracao" : filterSecretaria
          }
          const secNome = filterSecretaria === "todas" ? "Administracao" : filterSecretaria
          gerarRelatorioPorSecretaria(allAssets, secNome, options)
          break
        }
        case "movimentacoes":
          if (movimentacoes.length === 0) {
            toast({
              title: "Sem dados",
              description: "Não há movimentações para gerar relatório.",
              variant: "destructive",
            })
            return
          }
          gerarRelatorioMovimentacoes(movimentacoes, options)
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
          const provs = allAssets.filter(a => a.patrimonioTipo === 'provisorio')
          if (provs.length === 0) {
             toast({ title: "Sem dados", description: "Não há bens provisórios.", variant: "destructive" })
             return
          }
          gerarRelatorioProvisorio(allAssets, options)
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

          {selectedReport && (
            <div className="flex flex-col gap-6 mt-2">
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
                        <Select value={filterSecretaria} onValueChange={setFilterSecretaria}>
                          <SelectTrigger id="filter-sec" className="w-full">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todas">Todas as Secretarias</SelectItem>
                            {secretarias.map((s) => {
                              const nome = s.nome.replace("Secretaria de ", "")
                              return (
                                <SelectItem key={s.nome} value={nome}>
                                  Sec. de {nome}
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {selectedReport.filtros.includes("categoria") && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="filter-cat">Categoria</label>
                        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                          <SelectTrigger id="filter-cat" className="w-full">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todas">Todas as Categorias</SelectItem>
                            <SelectItem value="informatica">Informatica</SelectItem>
                            <SelectItem value="movel">Movel</SelectItem>
                            <SelectItem value="equipamento">Equipamento</SelectItem>
                            <SelectItem value="eletronico">Eletronico</SelectItem>
                            <SelectItem value="veiculo">Veiculo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {selectedReport.filtros.includes("status") && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="filter-status">Status</label>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                          <SelectTrigger id="filter-status" className="w-full">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos os Status</SelectItem>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="em_manutencao">Em Manutencao</SelectItem>
                            <SelectItem value="baixado">Baixado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {selectedReport.filtros.includes("bem") && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="filter-bem">Selecione o Bem</label>
                        <Select value={filterBem} onValueChange={setFilterBem}>
                          <SelectTrigger id="filter-bem" className="w-full">
                            <SelectValue placeholder="Selecione um bem" />
                          </SelectTrigger>
                          <SelectContent>
                            {allAssets.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.patrimonio} - {a.descricao}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
