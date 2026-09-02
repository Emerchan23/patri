"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Tag,
  User,
  Send,
  Printer,
  Search,
  Calendar,
  ArrowRight,
  FileCheck,
  Save,
  ImageIcon,
  X,
  Loader2,
} from "lucide-react"
import {
  getCategoryLabel,
  formatDate,
  getEtiquetaStatusColor,
  getEtiquetaStatusLabel,
  type PdfSettings,
} from "@/lib/data"
import type { Asset } from "@/lib/data"
import { gerarPdfApoioColagemEtiquetas, gerarRelatorioProvisorio } from "@/lib/pdf-generator"
import { api, fetcher, getApiErrorMessage, isApiError } from "@/lib/api-client"
import useSWR, { useSWRConfig } from "swr"
import { useToast } from "@/components/ui/use-toast"
import { PaginationControl } from "@/components/ui/pagination-control"
import { useDebounce } from "@/hooks/use-debounce"
import { useAuth } from "@/lib/auth-context"

export function PendenciasPatrimonio() {
  const { user } = useAuth()
  const { mutate } = useSWRConfig()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 400)
  const [secretariaFilter, setSecretariaFilter] = useState<string>("todos")
  const [departamentoFilter, setDepartamentoFilter] = useState<string>("todos")
  const [salaFilter, setSalaFilter] = useState<string>("todos")
  const [page, setPage] = useState(1)
  const limit = 20
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [showAtribuirDialog, setShowAtribuirDialog] = useState(false)
  const [showAtribuirLoteDialog, setShowAtribuirLoteDialog] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [definitiveNumber, setDefinitiveNumber] = useState("")
  // const [batchPrefix, setBatchPrefix] = useState("PAT-2025-") // Removed prefix
  const [batchStartNumber, setBatchStartNumber] = useState("00500")
  const [saved, setSaved] = useState(false)
  const [workflowLoadingId, setWorkflowLoadingId] = useState<string | null>(null)
  const [showPdfApoioDialog, setShowPdfApoioDialog] = useState(false)
  const [pdfApoioScope, setPdfApoioScope] = useState<"aguardando_colagem" | "todos_pendentes">("aguardando_colagem")
  const [pdfApoioPatrimonioTipo, setPdfApoioPatrimonioTipo] = useState<"todos" | "provisorio" | "definitivo">("todos")
  const [pdfApoioPrefixoProvisorio, setPdfApoioPrefixoProvisorio] = useState("todos")
  const [pdfApoioSequenciaInicial, setPdfApoioSequenciaInicial] = useState("")
  const [pdfApoioSequenciaFinal, setPdfApoioSequenciaFinal] = useState("")

  const pendenciasParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  })
  if (debouncedSearch) pendenciasParams.set("search", debouncedSearch)
  if (secretariaFilter !== "todos") pendenciasParams.set("secretaria", secretariaFilter)
  if (departamentoFilter !== "todos") pendenciasParams.set("departamento", departamentoFilter)
  if (salaFilter !== "todos") pendenciasParams.set("sala", salaFilter)
  const pendenciasUrl = `/pendencias?${pendenciasParams.toString()}`

  // Load data from API
  const { data: pendenciasResult } = useSWR(pendenciasUrl, fetcher, {
    keepPreviousData: true,
  })
  const { data: pdfSettings } = useSWR<PdfSettings>("/configuracoes/pdf", fetcher)
  const { data: secretariasData } = useSWR("/secretarias?all=true", fetcher)
  const secretarias = (Array.isArray(secretariasData) ? secretariasData : (secretariasData?.data || [])) as any[]

  const assets = (pendenciasResult?.data || []) as Asset[]
  const meta = pendenciasResult?.meta || { total: 0, page: 1, limit, totalPages: 1 }
  const selectableAssets = assets.filter((asset) => asset.patrimonioTipo === "provisorio")
  const waitingStats = pendenciasResult?.totals || {
    total: 0,
    menosDe30: 0,
    entre30e60: 0,
    maisDe60: 0,
  }
  const allAssets = assets
  const provisionalPrefixOptions = Array.from(
    new Set(
      allAssets
        .map((asset) => {
          const codigo = String(asset.patrimonio || asset.patrimonioProvisorio || "").trim().toUpperCase()
          const match = codigo.match(/^(.*?)(\d+)$/)
          if (!match) return null
          return codigo.startsWith("PROV-") ? match[1] : null
        })
        .filter(Boolean) as string[]
    )
  ).sort()

  const availableDepartamentos = secretarias.flatMap((sec: any) =>
    secretariaFilter !== "todos" && sec.nome !== secretariaFilter ? [] : (sec.departamentos || [])
  )
  const availableSalas = availableDepartamentos.flatMap((dep: any) =>
    departamentoFilter !== "todos" && dep.nome !== departamentoFilter ? [] : (dep.salas || [])
  )

  useEffect(() => {
    setPage(1)
    setSelectedItems([])
  }, [debouncedSearch, secretariaFilter, departamentoFilter, salaFilter])

  const getDaysWaiting = (dateStr?: string) => {
    if (!dateStr) return 0
    return Math.floor(
      (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
    )
  }

  const toggleItem = (id: string | number) => {
    const strId = String(id)
    setSelectedItems((prev) =>
      prev.includes(strId) ? prev.filter((i) => i !== strId) : [...prev, strId]
    )
  }

  const toggleAll = () => {
    if (selectedItems.length === selectableAssets.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(selectableAssets.map((a) => String(a.id)))
    }
  }

  const handleAtribuirIndividual = async () => {
    if (!selectedAsset || !definitiveNumber.trim()) {
      toast({
        title: "Erro de validação",
        description: "Por favor, preencha o número de patrimônio definitivo.",
        variant: "destructive",
      })
      return
    }
    
    // Check for duplicate
    const exists = allAssets.some(a => a.patrimonio === definitiveNumber && a.id !== selectedAsset.id)
    if (exists) {
        toast({
            title: "Erro de duplicidade",
            description: `O patrimônio ${definitiveNumber} já existe no sistema.`,
            variant: "destructive",
        })
        return
    }

    try {
      const updateData = {
        ...selectedAsset,
        patrimonio: definitiveNumber,
        patrimonioTipo: "definitivo",
        numero_patrimonio: definitiveNumber,
        etiquetaEnviadaEm: null,
        etiquetaEnviadaPor: null,
        etiquetaColadaEm: null,
        etiquetaColadaPor: null,
      }

      if (selectedAsset.categoria === 'veiculo' || selectedAsset.categoria === 'Veiculo') {
        await api.updateVeiculo(selectedAsset.id, updateData)
      } else {
        await api.updateBem(selectedAsset.id, updateData)
      }
      
      await mutate(pendenciasUrl)

      toast({
        title: "Sucesso",
        description: `Patrimônio ${definitiveNumber} atribuído com sucesso!`,
      })
      
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setShowAtribuirDialog(false)
        setSelectedAsset(null)
        setDefinitiveNumber("")
      }, 1500)
    } catch (error) {
      console.error("Erro ao atribuir patrimonio:", error)
      toast({
        title: "Erro ao salvar",
        description:
          isApiError(error) && error.status === 409
            ? getApiErrorMessage(error, "O patrimônio informado já está em uso.")
            : getApiErrorMessage(error, "Não foi possível atribuir o patrimônio. Tente novamente."),
        variant: "destructive",
      })
    }
  }

  const handleAtribuirLote = async () => {
    if (selectedItems.length === 0) {
      toast({
        title: "Seleção vazia",
        description: "Selecione pelo menos um bem para atribuir.",
        variant: "destructive",
      })
      return
    }

    try {
      const startNum = parseInt(batchStartNumber) || 0
      const updatesToProcess: { asset: Asset; newPatrimonio: string }[] = []

      // First pass: Validate all items
      for (let i = 0; i < selectedItems.length; i++) {
        const id = selectedItems[i]
        const asset = allAssets.find((a) => a.id === id)
        if (!asset) continue
        
        const currentNum = startNum + i
        const newNum = String(currentNum).padStart(Math.max(batchStartNumber.length, 5), "0")
        const newPatrimonio = newNum // No prefix

        // Check for duplicates
        const exists = allAssets.some(a => a.patrimonio === newPatrimonio && a.id !== id)
        if (exists) {
            toast({
                title: "Erro de duplicidade",
                description: `O patrimônio ${newPatrimonio} já existe. Ajuste o número inicial.`,
                variant: "destructive",
            })
            return
        }
        
        updatesToProcess.push({ asset, newPatrimonio })
      }

      // Second pass: Update
      const updates = updatesToProcess.map(({ asset, newPatrimonio }) => {
        const updateData = {
          ...asset,
          patrimonio: newPatrimonio,
          patrimonioTipo: "definitivo",
          numero_patrimonio: newPatrimonio,
          etiquetaEnviadaEm: null,
          etiquetaEnviadaPor: null,
          etiquetaColadaEm: null,
          etiquetaColadaPor: null,
        }

        if (asset.categoria === 'veiculo' || asset.categoria === 'Veiculo') {
            return api.updateVeiculo(asset.id, updateData)
        }
        return api.updateBem(asset.id, updateData)
      })

      await Promise.all(updates)
      
      await mutate(pendenciasUrl)
      
      toast({
        title: "Sucesso",
        description: `${selectedItems.length} patrimônios atribuídos em lote!`,
      })
      
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setShowAtribuirLoteDialog(false)
        setSelectedItems([])
      }, 1500)
    } catch (error) {
      console.error("Erro ao atribuir lote:", error)
      toast({
        title: "Erro ao processar lote",
        description:
          isApiError(error) && error.status === 409
            ? getApiErrorMessage(error, "Um dos patrimônios informados já está em uso.")
            : getApiErrorMessage(error, "Não foi possível atribuir os patrimônios em lote."),
        variant: "destructive",
      })
    }
  }


  const getDaysColor = (days: number) => {
    if (days < 30) return "text-success"
    if (days < 60) return "text-warning"
    return "text-destructive"
  }

  const extractSequenceNumber = (patrimonio?: string) => {
    const codigo = String(patrimonio || "").trim().toUpperCase()
    const match = codigo.match(/(\d+)(?!.*\d)/)
    return match ? Number(match[1]) : null
  }

  const extractSequencePrefix = (patrimonio?: string) => {
    const codigo = String(patrimonio || "").trim().toUpperCase()
    const match = codigo.match(/^(.*?)(\d+)$/)
    return match ? match[1] : null
  }

  const handleEtiquetaWorkflow = async (
    asset: Asset,
    action: "marcar_enviada" | "reabrir_pendente"
  ) => {
    setWorkflowLoadingId(String(asset.id))
    try {
      await api.updateBemEtiquetaFluxo(asset.id, action)
      await mutate(pendenciasUrl)
      toast({
        title: "Sucesso",
        description:
          action === "marcar_enviada"
            ? "Etiqueta enviada para a unidade com sucesso."
            : "Fluxo de etiqueta removido com sucesso.",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: getApiErrorMessage(error, "Nao foi possivel atualizar o fluxo da etiqueta."),
        variant: "destructive",
      })
    } finally {
      setWorkflowLoadingId(null)
    }
  }

  const buildPendenciasReportParams = (customLimit = 5000) => {
    const params = new URLSearchParams({
      page: "1",
      limit: customLimit.toString(),
    })
    if (debouncedSearch) params.set("search", debouncedSearch)
    if (secretariaFilter !== "todos") params.set("secretaria", secretariaFilter)
    if (departamentoFilter !== "todos") params.set("departamento", departamentoFilter)
    if (salaFilter !== "todos") params.set("sala", salaFilter)
    return params
  }

  const handleImprimirRelatorio = async () => {
    const reportResult = await api.getPendencias(buildPendenciasReportParams().toString())
    const reportAssets = (reportResult?.data || []) as Asset[]

    const dataParaRelatorio = reportAssets.map(asset => ({
      patrimonio: asset.patrimonio || "",
      descricao: asset.descricao,
      categoria: asset.categoria,
      localizacao: asset.localizacao,
      responsavel: typeof asset.responsavel === 'string' 
        ? { nome: asset.responsavel } 
        : asset.responsavel || { nome: "Não informado" },
      valor: asset.valor || 0,
      patrimonioTipo: asset.patrimonioTipo || "provisorio",
      dataAquisicao: asset.dataAquisicao ? asset.dataAquisicao.split('T')[0] : new Date().toISOString().split('T')[0]
    }))

    gerarRelatorioProvisorio(dataParaRelatorio, {
      secretaria: secretariaFilter !== "todos" ? secretariaFilter : undefined,
      settings: pdfSettings
    })
  }

  const handleGerarPdfApoio = async () => {
    try {
      const reportResult = await api.getPendencias(buildPendenciasReportParams().toString())
      let reportAssets = ((reportResult?.data || []) as Asset[])

      if (selectedItems.length > 0) {
        const selectedIds = new Set(selectedItems.map(String))
        reportAssets = reportAssets.filter((asset) => selectedIds.has(String(asset.id)))
      }

      if (pdfApoioScope === "aguardando_colagem") {
        reportAssets = reportAssets.filter((asset) => asset.etiquetaStatus === "enviada")
      }

      if (pdfApoioPatrimonioTipo !== "todos") {
        reportAssets = reportAssets.filter((asset) => asset.patrimonioTipo === pdfApoioPatrimonioTipo)
      }

      if (pdfApoioPatrimonioTipo === "provisorio" && pdfApoioPrefixoProvisorio !== "todos") {
        reportAssets = reportAssets.filter((asset) => {
          const codigo = String(asset.patrimonio || asset.patrimonioProvisorio || "").trim().toUpperCase()
          return extractSequencePrefix(codigo) === pdfApoioPrefixoProvisorio
        })
      }

      const rangeStart = pdfApoioSequenciaInicial.trim() ? Number(pdfApoioSequenciaInicial) : null
      const rangeEnd = pdfApoioSequenciaFinal.trim() ? Number(pdfApoioSequenciaFinal) : null
      const hasRange = rangeStart !== null || rangeEnd !== null

      if (
        (pdfApoioSequenciaInicial.trim() && !Number.isFinite(rangeStart)) ||
        (pdfApoioSequenciaFinal.trim() && !Number.isFinite(rangeEnd))
      ) {
        toast({
          title: "Sequencia invalida",
          description: "Informe apenas numeros nos campos de sequencia inicial e final.",
          variant: "destructive",
        })
        return
      }

      if (rangeStart !== null && rangeEnd !== null && rangeStart > rangeEnd) {
        toast({
          title: "Faixa invalida",
          description: "A sequencia inicial nao pode ser maior que a sequencia final.",
          variant: "destructive",
        })
        return
      }

      if (hasRange) {
        reportAssets = reportAssets.filter((asset) => {
          const codigo = String(asset.patrimonio || asset.patrimonioProvisorio || "").trim()
          const sequence = extractSequenceNumber(codigo)
          if (sequence === null) return false
          if (rangeStart !== null && sequence < rangeStart) return false
          if (rangeEnd !== null && sequence > rangeEnd) return false
          return true
        })
      }

      if (reportAssets.length === 0) {
        toast({
          title: "Nenhum item para o PDF",
          description:
            selectedItems.length > 0
              ? "Os itens selecionados nao geraram nenhum resultado para este tipo de PDF."
              : pdfApoioScope === "aguardando_colagem"
                ? "Nao ha itens aguardando colagem com os filtros atuais."
                : "Nao ha pendencias para gerar no PDF com os filtros e faixa informados.",
          variant: "destructive",
        })
        return
      }

      gerarPdfApoioColagemEtiquetas(
        reportAssets.map((asset) => ({
          id: asset.id,
          patrimonio: asset.patrimonio || asset.patrimonioProvisorio || "Sem patrimonio",
          descricao: asset.descricao,
          numeroSerie: asset.numeroSerie || asset.numero_serie,
          marca: asset.marca,
          modelo: asset.modelo,
          imagem: asset.imagem,
          etiquetaStatus: asset.etiquetaStatus,
          localizacao: asset.localizacao,
          responsavel:
            typeof asset.responsavel === "string"
              ? { nome: asset.responsavel }
              : asset.responsavel || { nome: "Nao informado" },
        })),
        {
          settings: pdfSettings,
          secretaria: secretariaFilter !== "todos" ? secretariaFilter : undefined,
          departamento: departamentoFilter !== "todos" ? departamentoFilter : undefined,
          sala: salaFilter !== "todos" ? salaFilter : undefined,
          somenteAguardandoColagem: pdfApoioScope === "aguardando_colagem",
        }
      )

      setShowPdfApoioDialog(false)
    } catch (error) {
      toast({
        title: "Erro ao gerar PDF",
        description: getApiErrorMessage(error, "Nao foi possivel gerar o PDF de apoio a colagem."),
        variant: "destructive",
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">
            Pendencias de Patrimonio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
              Acompanhe bens aguardando patrimonio definitivo ou colagem confirmada pela unidade
          </p>
        </div>
        <div className="flex gap-2">
          {selectedItems.length > 0 && (
            <Button
              className="gap-2"
              onClick={() => setShowAtribuirLoteDialog(true)}
            >
              <Tag className="h-4 w-4" />
              Atribuir em Lote ({selectedItems.length})
            </Button>
          )}
          <Button 
            variant="outline" 
            className="gap-2 bg-transparent"
            onClick={handleImprimirRelatorio}
          >
            <Printer className="h-4 w-4" />
            Imprimir Relatorio
          </Button>
          <Button
            variant="outline"
            className="gap-2 bg-transparent"
            onClick={() => setShowPdfApoioDialog(true)}
          >
            <FileCheck className="h-4 w-4" />
            PDF Apoio Colagem
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-l-4 border-l-warning">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Pendentes</p>
              <p className="text-2xl font-bold">{waitingStats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10">
              <Clock className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{"< 30 dias"}</p>
              <p className="text-2xl font-bold">{waitingStats.menosDe30}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">30-60 dias</p>
              <p className="text-2xl font-bold">{waitingStats.entre30e60}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
              <Clock className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{"> 60 dias"}</p>
              <p className="text-2xl font-bold">{waitingStats.maisDe60}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow explanation */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                1
              </div>
              <div>
                <p className="text-sm font-medium">Identificar pendencias</p>
                <p className="text-xs text-muted-foreground">Bens sem patrimonio definitivo</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary hidden lg:block" />
            <div className="flex items-center gap-3 flex-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                2
              </div>
              <div>
                <p className="text-sm font-medium">Gerar patrimonio</p>
                <p className="text-xs text-muted-foreground">Atribuir numero definitivo</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary hidden lg:block" />
            <div className="flex items-center gap-3 flex-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                3
              </div>
              <div>
                <p className="text-sm font-medium">Enviar etiquetas</p>
                <p className="text-xs text-muted-foreground">Unidade cola as etiquetas</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary hidden lg:block" />
            <div className="flex items-center gap-3 flex-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-xs font-bold text-success">
                4
              </div>
              <div>
                <p className="text-sm font-medium text-success">Concluido</p>
                <p className="text-xs text-muted-foreground">Assistente confirma colagem</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(260px,1.4fr)_1fr_1fr_1fr]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Patrimonio completo, ultimos numeros, descricao, serie ou responsavel..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <SearchableSelect
              value={secretariaFilter}
              onValueChange={(value) => {
                setSecretariaFilter(value)
                setDepartamentoFilter("todos")
                setSalaFilter("todos")
              }}
              placeholder="Filtrar secretaria..."
              searchPlaceholder="Buscar secretaria..."
              items={[
                { value: "todos", label: "Todas Secretarias" },
                ...secretarias.map((s) => {
                  const nome = s.nome.replace("Secretaria de ", "")
                  return { value: s.nome, label: `Sec. ${nome}`, searchTerms: s.nome }
                })
              ]}
            />
            <SearchableSelect
              value={departamentoFilter}
              onValueChange={(value) => {
                setDepartamentoFilter(value)
                setSalaFilter("todos")
              }}
              placeholder="Todos os departamentos"
              searchPlaceholder="Buscar departamento..."
              items={[
                { value: "todos", label: "Todos os Departamentos" },
                ...availableDepartamentos.map((dep: any) => ({
                  value: dep.nome,
                  label: dep.nome,
                  searchTerms: dep.nome,
                })),
              ]}
            />
            <SearchableSelect
              value={salaFilter}
              onValueChange={setSalaFilter}
              placeholder="Todas as salas"
              searchPlaceholder="Buscar sala..."
              items={[
                { value: "todos", label: "Todas as Salas" },
                ...availableSalas.map((room: any) => {
                  const name = typeof room === "string" ? room : room.nome
                  return {
                    value: name,
                    label: name,
                    searchTerms: name,
                  }
                }),
              ]}
            />
            
            {(search || secretariaFilter !== "todos" || departamentoFilter !== "todos" || salaFilter !== "todos") && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearch("")
                  setSecretariaFilter("todos")
                  setDepartamentoFilter("todos")
                  setSalaFilter("todos")
                }}
                className="h-10 gap-2 xl:col-span-4 xl:justify-self-start"
              >
                <X className="h-4 w-4" />
                Limpar Filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table of pending items */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {meta.total} bens pendentes
            </CardTitle>
            {assets.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={toggleAll}>
                {selectedItems.length === selectableAssets.length
                  ? "Desmarcar Todos"
                  : "Selecionar Todos Provisorios"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead className="w-[60px]">Foto</TableHead>
                  <TableHead>Patrimonio</TableHead>
                  <TableHead>Descricao</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden lg:table-cell">Unidade</TableHead>
                  <TableHead className="hidden md:table-cell">Responsavel</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Dias Aguardando</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => {
                  const days = getDaysWaiting(asset.dataAquisicao)
                  const isProvisional = asset.patrimonioTipo === "provisorio"
                  return (
                    <TableRow
                      key={asset.id}
                      className={selectedItems.includes(String(asset.id)) ? "bg-primary/5" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(String(asset.id))}
                          disabled={!isProvisional}
                          onCheckedChange={() => toggleItem(asset.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="h-10 w-10 rounded-md border bg-muted flex items-center justify-center overflow-hidden">
                          {asset.imagem ? (
                            <img 
                              src={asset.imagem} 
                              alt={asset.descricao}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="font-mono text-[11px] border-warning/50 text-warning"
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            {asset.patrimonio || "Sem Patrimônio"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{asset.descricao}</span>
                          {asset.marca && (
                            <span className="text-xs text-muted-foreground">
                              {asset.marca} {asset.modelo}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="secondary" className="text-xs">
                          {getCategoryLabel(asset.categoria)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">
                            {asset.localizacao.departamento}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {asset.localizacao.sala}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm">{typeof asset.responsavel === 'object' ? asset.responsavel.nome : asset.responsavel}</span>
                      </TableCell>
                      <TableCell>
                        {asset.etiquetaStatus ? (
                          <Badge variant="outline" className={`text-[10px] ${getEtiquetaStatusColor(asset.etiquetaStatus)}`}>
                            {getEtiquetaStatusLabel(asset.etiquetaStatus)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {isProvisional ? "Aguardando definitivo" : "-"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-bold ${getDaysColor(days)}`}>
                            {days}d
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isProvisional ? (
                            <Button
                              size="sm"
                              className="h-8 gap-1.5 text-xs"
                              onClick={() => {
                                setSelectedAsset(asset)
                                setShowAtribuirDialog(true)
                              }}
                            >
                              <Tag className="h-3.5 w-3.5" />
                              Atribuir
                            </Button>
                          ) : asset.etiquetaStatus === "enviada" && (user?.role === "gestor" || user?.role === "administrador") ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 text-xs"
                              onClick={() => handleEtiquetaWorkflow(asset, "reabrir_pendente")}
                              disabled={workflowLoadingId === String(asset.id)}
                            >
                              {workflowLoadingId === String(asset.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
                              Reabrir
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Aguardando unidade</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {assets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-8 w-8 text-success" />
                        <p className="text-sm font-medium text-success">
                          Nenhuma pendencia encontrada!
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Todos os bens possuem patrimonio definitivo.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="border-t px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Pagina {meta.page} de {meta.totalPages} • {meta.total} registro(s)
              </p>
              <PaginationControl
                currentPage={meta.page}
                totalPages={meta.totalPages}
                onPageChange={(nextPage) => {
                  setSelectedItems([])
                  setPage(nextPage)
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual assign dialog */}
      <Dialog open={showPdfApoioDialog} onOpenChange={setShowPdfApoioDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>PDF de Apoio a Colagem</DialogTitle>
            <DialogDescription>
              Gere uma folha operacional para conferir patrimonio, numero de serie e localizacao antes de colar as etiquetas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="font-medium">O que vai entrar no PDF?</p>
              <p className="mt-1 text-muted-foreground">
                Os filtros atuais de secretaria, departamento, sala e busca serao respeitados.
              </p>
              {selectedItems.length > 0 && (
                <p className="mt-2 text-xs text-primary">
                  Itens selecionados na tabela serao priorizados nesta geracao.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pdf-apoio-scope">Tipo do PDF</Label>
              <Select
                value={pdfApoioScope}
                onValueChange={(value: "aguardando_colagem" | "todos_pendentes") => setPdfApoioScope(value)}
              >
                <SelectTrigger id="pdf-apoio-scope">
                  <SelectValue placeholder="Selecione o tipo do PDF" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aguardando_colagem">So Aguardando Colagem</SelectItem>
                  <SelectItem value="todos_pendentes">Todos os Pendentes Filtrados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pdf-apoio-patrimonio-tipo">Patrimonio</Label>
                <Select
                  value={pdfApoioPatrimonioTipo}
                  onValueChange={(value: "todos" | "provisorio" | "definitivo") => {
                    setPdfApoioPatrimonioTipo(value)
                    if (value !== "provisorio") {
                      setPdfApoioPrefixoProvisorio("todos")
                    }
                  }}
                >
                  <SelectTrigger id="pdf-apoio-patrimonio-tipo">
                    <SelectValue placeholder="Tipo do patrimonio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="provisorio">Provisorio</SelectItem>
                    <SelectItem value="definitivo">Permanente / Definitivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {pdfApoioPatrimonioTipo === "provisorio" && (
                <div className="space-y-2">
                  <Label htmlFor="pdf-apoio-prefixo">Prefixo Provisorio</Label>
                  <Select
                    value={pdfApoioPrefixoProvisorio}
                    onValueChange={setPdfApoioPrefixoProvisorio}
                  >
                    <SelectTrigger id="pdf-apoio-prefixo">
                      <SelectValue placeholder="Selecione o prefixo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os prefixos PROV</SelectItem>
                      {provisionalPrefixOptions.map((prefixo) => (
                        <SelectItem key={prefixo} value={prefixo}>
                          {prefixo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pdf-apoio-sequencia-inicial">Sequencia inicial</Label>
                <Input
                  id="pdf-apoio-sequencia-inicial"
                  inputMode="numeric"
                  placeholder={pdfApoioPatrimonioTipo === "provisorio" ? "Ex.: 331" : "Ex.: 1001"}
                  value={pdfApoioSequenciaInicial}
                  onChange={(e) => setPdfApoioSequenciaInicial(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pdf-apoio-sequencia-final">Sequencia final</Label>
                <Input
                  id="pdf-apoio-sequencia-final"
                  inputMode="numeric"
                  placeholder={pdfApoioPatrimonioTipo === "provisorio" ? "Ex.: 360" : "Ex.: 1050"}
                  value={pdfApoioSequenciaFinal}
                  onChange={(e) => setPdfApoioSequenciaFinal(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>

            <div className="rounded-lg bg-info/10 p-3 text-xs text-muted-foreground">
              O PDF destaca numero de serie, marca/modelo, localizacao, responsavel e foto quando existir.
              Se voce filtrar patrimonio provisorio, pode escolher o prefixo do ano, como PROV-2025-, PROV-2026- ou PROV-2027-,
              e ainda limitar pela faixa numerica inicial/final.
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPdfApoioDialog(false)}>
                Cancelar
              </Button>
              <Button className="gap-2" onClick={handleGerarPdfApoio}>
                <Printer className="h-4 w-4" />
                Gerar PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showAtribuirDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowAtribuirDialog(false)
            setSelectedAsset(null)
            setDefinitiveNumber("")
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir Patrimonio Definitivo</DialogTitle>
            <DialogDescription>
              Confirme os dados e insira o número do patrimônio definitivo.
            </DialogDescription>
          </DialogHeader>
          {selectedAsset && (
            <div className="flex flex-col gap-4 mt-2">
              {/* Asset Image Banner */}
              <div className="flex justify-center rounded-lg border bg-muted/30 p-2">
                 {selectedAsset.imagem ? (
                   <img 
                     src={selectedAsset.imagem} 
                     alt={selectedAsset.descricao}
                     className="max-h-[150px] w-auto rounded-md object-contain"
                   />
                 ) : (
                   <div className="flex flex-col items-center justify-center py-4 text-muted-foreground/50">
                     <ImageIcon className="h-8 w-8 mb-1" />
                     <p className="text-[10px]">Sem foto</p>
                   </div>
                 )}
              </div>

              {/* Asset info */}
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-semibold">{selectedAsset.descricao}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] border-warning/50 text-warning font-mono"
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    {selectedAsset.patrimonio}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {selectedAsset.localizacao.departamento}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {typeof selectedAsset.responsavel === 'object' ? selectedAsset.responsavel.nome : selectedAsset.responsavel}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(selectedAsset.dataAquisicao)}
                  </span>
                </div>
              </div>

              {/* Input */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="definitivo-num">Numero de Patrimonio Definitivo</Label>
                <Input
                  id="definitivo-num"
                  placeholder="PAT-2025-XXXXX"
                  value={definitiveNumber}
                  onChange={(e) => setDefinitiveNumber(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Digite o numero oficial recebido da prefeitura para concluir a regularizacao do patrimonio
                </p>
              </div>

              {/* Info */}
              <div className="flex items-center gap-2 rounded-lg bg-info/10 p-3">
                <Send className="h-4 w-4 text-info shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Apos confirmar, o bem fica definitivo. O fluxo de etiqueta so deve ser iniciado depois,
                  se voce realmente precisar enviar a etiqueta para a unidade.
                </p>
              </div>

              {saved && (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Patrimonio definitivo atribuido com sucesso!
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAtribuirDialog(false)
                    setSelectedAsset(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="gap-2"
                  disabled={!definitiveNumber.trim()}
                  onClick={handleAtribuirIndividual}
                >
                  <FileCheck className="h-4 w-4" />
                  Confirmar Patrimonio Definitivo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Batch assign dialog */}
      <Dialog
        open={showAtribuirLoteDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowAtribuirLoteDialog(false)
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Atribuir Patrimonio em Lote</DialogTitle>
            <DialogDescription>
              Atribua números de patrimônio sequenciais para os bens selecionados.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div className="rounded-lg bg-warning/10 border border-warning/30 p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <p className="text-sm font-semibold">
                  {selectedItems.length} bens selecionados
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Os numeros serao atribuidos sequencialmente a partir do numero inicial informado.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Numero Inicial</Label>
                <Input
                  value={batchStartNumber}
                  onChange={(e) => setBatchStartNumber(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Pre-visualizacao
              </p>
              <div className="flex flex-col gap-1.5">
                {selectedItems.length > 0 ? (
                  selectedItems.slice(0, 5).map((id, i) => {
                    const asset = allAssets.find((a) => a.id === id)
                    // Generate number based on start number + index
                    // Use parseInt to handle numeric addition, then convert back to string
                    const startNum = parseInt(batchStartNumber) || 0
                    const currentNum = startNum + i
                    // Pad with leading zeros to match the input length or default to 5
                    const numStr = String(currentNum).padStart(Math.max(batchStartNumber.length, 5), "0")
                    
                    return (
                      <div key={id} className="flex items-center gap-2 text-sm">
                        <div className="h-8 w-8 shrink-0 rounded border bg-muted flex items-center justify-center overflow-hidden">
                          {asset?.imagem ? (
                            <img 
                              src={asset.imagem} 
                              alt={asset.descricao}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="w-24 shrink-0">
                          <Badge variant="outline" className="w-full justify-center font-mono text-[10px] border-warning/50 text-warning">
                            {asset?.patrimonio || "N/A"}
                          </Badge>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <div className="w-28 shrink-0">
                          <Badge className="w-full justify-center font-mono text-[10px] bg-success text-success-foreground hover:bg-success/90">
                            {numStr}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground truncate min-w-0 flex-1" title={asset?.descricao}>
                          {asset?.descricao}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Nenhum item selecionado
                  </p>
                )}
                {selectedItems.length > 5 && (
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    ... e mais {selectedItems.length - 5} itens
                  </p>
                )}
              </div>
            </div>

            {saved && (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                {selectedItems.length} patrimonios atribuidos com sucesso!
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAtribuirLoteDialog(false)}>
                Cancelar
              </Button>
              <Button className="gap-2" onClick={handleAtribuirLote}>
                <FileCheck className="h-4 w-4" />
                Atribuir {selectedItems.length} Patrimonios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
