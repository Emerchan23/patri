"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
  ArrowRightLeft,
  ArrowRight,
  Plus,
  MapPin,
  Calendar,
  User,
  Package,
  CheckCircle2,
  Loader2,
  ClipboardList,
  X,
  ShieldCheck,
  ShieldX,
  Printer,
} from "lucide-react"
import { formatDate } from "@/lib/data"
import { fetcher, api, getApiErrorMessage, isApiError } from "@/lib/api-client"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-context"
import { ResponsavelSelect } from "@/components/responsavel-select"
import { cn } from "@/lib/utils"
import { gerarPdfSolicitacaoMovimentacao } from "@/lib/pdf-generator"

const requestStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
}

const requestStatusClasses: Record<string, string> = {
  pendente: "bg-warning/10 text-warning border-warning/20",
  aprovada: "bg-success/10 text-success border-success/20",
  rejeitada: "bg-destructive/10 text-destructive border-destructive/20",
  cancelada: "bg-muted text-muted-foreground border-border",
}

export function Movimentacoes() {
  const { toast } = useToast()
  const { user, hasPermission } = useAuth()
  const canRegisterMovement = hasPermission("registrarMovimentacao")
  const canApproveRequests = hasPermission("aprovarMovimentacao")
  const isAssistantRequester = user?.role === "assistente"
  const [activeTab, setActiveTab] = useState<string>(canRegisterMovement ? "historico" : "solicitacoes")

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [search, setSearch] = useState("")
  const [periodo, setPeriodo] = useState("30")
  const [secretariaFiltro, setSecretariaFiltro] = useState("todas")
  const [departamentoFiltro, setDepartamentoFiltro] = useState("todos")
  const [salaFiltro, setSalaFiltro] = useState("todos")
  const [responsavelFiltro, setResponsavelFiltro] = useState("todos")

  const [requestsPage, setRequestsPage] = useState(1)
  const [requestStatusFilter, setRequestStatusFilter] = useState(canApproveRequests ? "pendente" : "todas")
  const [requestSecretariaFilter, setRequestSecretariaFilter] = useState("todas")
  const [requestSolicitanteFilter, setRequestSolicitanteFilter] = useState("todos")

  const queryParams = new URLSearchParams()
  queryParams.set("page", page.toString())
  queryParams.set("limit", limit.toString())
  if (search) queryParams.set("busca", search)
  if (periodo !== "todos") queryParams.set("periodo", periodo)
  if (secretariaFiltro !== "todas") queryParams.set("secretaria", secretariaFiltro)
  if (departamentoFiltro !== "todos") queryParams.set("departamento", departamentoFiltro)
  if (salaFiltro !== "todos") queryParams.set("sala", salaFiltro)
  if (responsavelFiltro !== "todos") queryParams.set("responsavel", responsavelFiltro)

  const requestParams = new URLSearchParams()
  requestParams.set("page", requestsPage.toString())
  requestParams.set("limit", "20")
  if (requestStatusFilter !== "todas") requestParams.set("status", requestStatusFilter)
  if (requestSecretariaFilter !== "todas") requestParams.set("secretaria", requestSecretariaFilter)
  if (requestSolicitanteFilter !== "todos") requestParams.set("solicitante", requestSolicitanteFilter)

  const { data: result, mutate } = useSWR(["movimentacoes", queryParams.toString()], () => api.getMovimentacoes(queryParams.toString()))
  const { data: requestsResult, mutate: mutateRequests } = useSWR(
    ["solicitacoes-movimentacao", requestParams.toString()],
    () => api.getSolicitacoesMovimentacao(requestParams.toString())
  )

  const movements = result?.data || []
  const meta = result?.meta || { total: 0, page: 1, limit: 20, totalPages: 1 }
  const requests = requestsResult?.data || []
  const requestsMeta = requestsResult?.meta || { total: 0, page: 1, limit: 20, totalPages: 1 }

  const { data: bensResult, isLoading: bensLoading } = useSWR("/bens?limit=1000", fetcher)
  const { data: secretariasData, isLoading: secretariasLoading } = useSWR("/secretarias?all=true", fetcher)
  const { data: responsaveisData } = useSWR("/servidores?all=true", fetcher)
  const { data: pdfSettings } = useSWR("/configuracoes/pdf", fetcher)

  const bens = bensResult?.data || []
  const secretarias = (Array.isArray(secretariasData) ? secretariasData : (secretariasData?.data || [])) as any[]
  const responsaveis = Array.isArray(responsaveisData) ? responsaveisData : (responsaveisData?.data || [])

  const [newMovOpen, setNewMovOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<string[]>([])

  const [formAssetPicker, setFormAssetPicker] = useState("")
  const [formAssetIds, setFormAssetIds] = useState<string[]>([])
  const [formDestinoSec, setFormDestinoSec] = useState("")
  const [formDestinoDep, setFormDestinoDep] = useState("")
  const [formDestinoSala, setFormDestinoSala] = useState("")
  const [formResponsavel, setFormResponsavel] = useState("")
  const [formMotivo, setFormMotivo] = useState("")

  const [requestOpen, setRequestOpen] = useState(false)
  const [requestSaving, setRequestSaving] = useState(false)
  const [requestFieldErrors, setRequestFieldErrors] = useState<string[]>([])
  const [requestAssetPicker, setRequestAssetPicker] = useState("")
  const [requestAssetIds, setRequestAssetIds] = useState<string[]>([])
  const [requestDestinoSec, setRequestDestinoSec] = useState(user?.unidade?.secretaria || "")
  const [requestDestinoDep, setRequestDestinoDep] = useState("")
  const [requestDestinoSala, setRequestDestinoSala] = useState("")
  const [requestMotivo, setRequestMotivo] = useState("")

  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false)
  const [decisionAction, setDecisionAction] = useState<"aprovar" | "rejeitar" | "cancelar">("aprovar")
  const [decisionReason, setDecisionReason] = useState("")
  const [decisionTarget, setDecisionTarget] = useState<any | null>(null)
  const [decisionSaving, setDecisionSaving] = useState(false)

  const selectedSec = secretarias.find((s: any) => s.nome === formDestinoSec)
  const deptos = selectedSec?.departamentos || []
  const selectedDep = deptos.find((d: any) => d.nome === formDestinoDep)
  const salas = selectedDep?.salas || []
  const selectedAssets = formAssetIds
    .map((assetId) => bens.find((asset: any) => asset.id === assetId))
    .filter(Boolean)

  const selectableMovementAssets = useMemo(() => {
    const selectedSet = new Set(formAssetIds)
    return bens
      .filter((asset: any) => !selectedSet.has(asset.id))
      .map((asset: any) => ({
        value: asset.id,
        label: `${asset.patrimonio} - ${asset.descricao}`,
        searchTerms: `${asset.patrimonio} ${asset.descricao} ${asset.localizacao?.departamento || ""} ${asset.localizacao?.sala || ""}`,
      }))
  }, [bens, formAssetIds])

  const requestSelectedSec = secretarias.find((s: any) => s.nome === requestDestinoSec)
  const requestDeptos = requestSelectedSec?.departamentos || []
  const requestSelectedDep = requestDeptos.find((d: any) => d.nome === requestDestinoDep)
  const requestSalas = requestSelectedDep?.salas || []
  const requestSelectedAssets = requestAssetIds
    .map((assetId) => bens.find((asset: any) => asset.id === assetId))
    .filter(Boolean)

  const requestableAssetOptions = useMemo(() => {
    const selectedSet = new Set(requestAssetIds)
    return bens
      .filter((asset: any) => !selectedSet.has(asset.id))
      .map((asset: any) => ({
        value: asset.id,
        label: `${asset.patrimonio} - ${asset.descricao}`,
        searchTerms: `${asset.patrimonio} ${asset.descricao} ${asset.localizacao?.departamento || ""} ${asset.localizacao?.sala || ""}`,
      }))
  }, [bens, requestAssetIds])

  const requestSummary = useMemo(() => {
    const count = requests.length
    const pending = requests.filter((item: any) => item.status === "pendente").length
    return { count, pending }
  }, [requests])

  const handleGerarPdfSolicitacao = (item: any) => {
    gerarPdfSolicitacaoMovimentacao(
      {
        id: item.id,
        solicitanteNome: item.solicitanteNome,
        solicitanteRole: item.solicitanteRole,
        secretariaOrigem: item.secretariaOrigem,
        secretariaDestino: item.secretariaDestino,
        departamentoDestino: item.departamentoDestino,
        salaDestino: item.salaDestino,
        motivo: item.motivo,
        status: item.status,
        criadoEm: item.criadoEm,
        decididoEm: item.decididoEm,
        aprovadoPorNome: item.aprovadoPorNome,
        rejeitadoPorNome: item.rejeitadoPorNome,
        canceladoPorNome: item.canceladoPorNome,
        motivoRejeicao: item.motivoRejeicao,
        itens: item.itens || [],
      },
      {
        settings: pdfSettings,
      }
    )
  }

  const availableDepartamentos = useMemo(() => {
    if (secretariaFiltro !== "todas") {
      const sec = secretarias.find((item: any) => item.nome === secretariaFiltro)
      return sec?.departamentos || []
    }
    return secretarias.flatMap((item: any) => item.departamentos || [])
  }, [secretarias, secretariaFiltro])

  const availableSalas = useMemo(() => {
    if (departamentoFiltro !== "todos") {
      const dep = availableDepartamentos.find((item: any) => item.nome === departamentoFiltro)
      return dep?.salas || []
    }
    return availableDepartamentos.flatMap((item: any) => item.salas || [])
  }, [availableDepartamentos, departamentoFiltro])

  const handleSaveMov = async () => {
    const missingFields: string[] = []
    const newFieldErrors: string[] = []

    if (formAssetIds.length === 0) { missingFields.push("Bens Patrimoniais"); newFieldErrors.push("formAssetIds") }
    if (!formDestinoSec) { missingFields.push("Secretaria de Destino"); newFieldErrors.push("formDestinoSec") }
    if (!formDestinoDep) { missingFields.push("Departamento"); newFieldErrors.push("formDestinoDep") }
    if (!formDestinoSala) { missingFields.push("Sala"); newFieldErrors.push("formDestinoSala") }
    if (!formResponsavel.trim()) { missingFields.push("Responsavel"); newFieldErrors.push("formResponsavel") }
    if (!formMotivo.trim()) { missingFields.push("Motivo"); newFieldErrors.push("formMotivo") }

    setFieldErrors(newFieldErrors)

    if (missingFields.length > 0) {
      toast({
        title: "Campos obrigatorios faltando",
        description: `Preencha: ${missingFields.join(", ")}.`,
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      await api.createMovimentacao({
        assetIds: formAssetIds,
        para: { secretaria: formDestinoSec, departamento: formDestinoDep, sala: formDestinoSala },
        responsavel: formResponsavel,
        motivo: formMotivo,
      })

      toast({
        title: "Sucesso",
        description: "Movimentacao registrada com sucesso!",
      })

      setSaved(true)
      await mutate()
      setTimeout(() => {
        setSaved(false)
        setNewMovOpen(false)
        setFormAssetPicker("")
        setFormAssetIds([])
        setFormDestinoSec("")
        setFormDestinoDep("")
        setFormDestinoSala("")
        setFormResponsavel("")
        setFormMotivo("")
      }, 1200)
    } catch (error: any) {
      toast({
        title: "Erro ao registrar",
        description:
          isApiError(error) && error.status === 403
            ? "Você não tem permissão para registrar essa movimentação."
            : getApiErrorMessage(error, "Não foi possível registrar a movimentação."),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAddRequestAsset = () => {
    if (!requestAssetPicker) return
    setRequestAssetIds((current) => current.includes(requestAssetPicker) ? current : [...current, requestAssetPicker])
    setRequestAssetPicker("")
    setRequestFieldErrors((current) => current.filter((item) => item !== "requestAssetIds"))
  }

  const handleRemoveRequestAsset = (assetId: string) => {
    setRequestAssetIds((current) => current.filter((item) => item !== assetId))
  }

  const handleCreateRequest = async () => {
    const missing: string[] = []
    const errors: string[] = []
    if (requestAssetIds.length === 0) { missing.push("Bens selecionados"); errors.push("requestAssetIds") }
    if (!requestDestinoSec) { missing.push("Secretaria de destino"); errors.push("requestDestinoSec") }
    if (!requestDestinoDep) { missing.push("Departamento de destino"); errors.push("requestDestinoDep") }
    if (!requestDestinoSala) { missing.push("Sala de destino"); errors.push("requestDestinoSala") }
    if (!requestMotivo.trim()) { missing.push("Motivo"); errors.push("requestMotivo") }

    setRequestFieldErrors(errors)

    if (missing.length > 0) {
      toast({
        title: "Solicitacao incompleta",
        description: `Preencha: ${missing.join(", ")}.`,
        variant: "destructive",
      })
      return
    }

    setRequestSaving(true)
    try {
      await api.createSolicitacaoMovimentacao({
        assetIds: requestAssetIds,
        secretariaDestino: requestDestinoSec,
        departamentoDestino: requestDestinoDep,
        salaDestino: requestDestinoSala,
        motivo: requestMotivo,
      })

      toast({
        title: "Solicitacao criada",
        description: "Sua solicitacao foi enviada para aprovacao do patrimonio.",
      })

      setRequestOpen(false)
      setRequestAssetIds([])
      setRequestAssetPicker("")
      setRequestDestinoSec(user?.unidade?.secretaria || "")
      setRequestDestinoDep("")
      setRequestDestinoSala("")
      setRequestMotivo("")
      await mutateRequests()
    } catch (error: any) {
      toast({
        title: "Erro ao criar solicitacao",
        description:
          isApiError(error) && error.status === 403
            ? "Você não tem permissão para enviar esta solicitação."
            : getApiErrorMessage(error, "Não foi possível enviar a solicitação."),
        variant: "destructive",
      })
    } finally {
      setRequestSaving(false)
    }
  }

  const openDecisionDialog = (action: "aprovar" | "rejeitar" | "cancelar", target: any) => {
    setDecisionAction(action)
    setDecisionTarget(target)
    setDecisionReason("")
    setDecisionDialogOpen(true)
  }

  const handleDecision = async () => {
    if (!decisionTarget) return
    if (decisionAction === "rejeitar" && !decisionReason.trim()) {
      toast({
        title: "Motivo obrigatorio",
        description: "Informe o motivo da rejeicao para continuar.",
        variant: "destructive",
      })
      return
    }

    setDecisionSaving(true)
    try {
      await api.updateSolicitacaoMovimentacao(decisionTarget.id, {
        action: decisionAction,
        motivoRejeicao: decisionReason.trim() || undefined,
      })

      toast({
        title:
          decisionAction === "aprovar"
            ? "Solicitacao aprovada"
            : decisionAction === "rejeitar"
              ? "Solicitacao rejeitada"
              : "Solicitacao cancelada",
        description:
          decisionAction === "aprovar"
            ? "Os bens foram movimentados automaticamente."
            : decisionAction === "rejeitar"
              ? "A solicitacao foi devolvida ao solicitante com o motivo informado."
              : "A solicitacao pendente foi cancelada com sucesso.",
      })

      setDecisionDialogOpen(false)
      setDecisionTarget(null)
      await Promise.all([mutateRequests(), mutate()])
    } catch (error: any) {
      toast({
        title: "Erro ao processar solicitacao",
        description: getApiErrorMessage(error, "Não foi possível concluir a ação."),
        variant: "destructive",
      })
    } finally {
      setDecisionSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">Movimentacoes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAssistantRequester
              ? "Solicite mudancas de bens da sua unidade e acompanhe a aprovacao."
              : "Historico de transferencias e fila de solicitacoes de mudanca."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "historico" && canRegisterMovement && (
            <Dialog open={newMovOpen} onOpenChange={setNewMovOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" />Nova Movimentacao</Button>
              </DialogTrigger>
              <DialogContent className="w-[min(96vw,980px)] max-w-[980px]">
                <DialogHeader>
                  <DialogTitle>Registrar Movimentacao</DialogTitle>
                  <DialogDescription>
                    Selecione um ou mais bens para registrar a movimentacao para o mesmo destino.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 mt-2">
                  <div className="flex flex-col gap-2">
                    <Label required className={fieldErrors.includes("formAssetIds") ? "text-destructive" : ""}>Bens Patrimoniais</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="flex-1">
                        <SearchableSelect
                          value={formAssetPicker}
                          onValueChange={setFormAssetPicker}
                          items={selectableMovementAssets}
                          placeholder={bensLoading ? "Carregando..." : "Buscar bem para adicionar"}
                          searchPlaceholder="Buscar por nome, patrimonio ou local..."
                          disabled={bensLoading}
                          className={fieldErrors.includes("formAssetIds") ? "h-auto min-h-10 whitespace-normal text-left border-destructive ring-offset-destructive" : "h-auto min-h-10 whitespace-normal text-left"}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!formAssetPicker) return
                          setFormAssetIds((current) => [...current, formAssetPicker])
                          setFormAssetPicker("")
                          setFieldErrors((current) => current.filter((item) => item !== "formAssetIds"))
                        }}
                        disabled={!formAssetPicker}
                      >
                        Adicionar bem
                      </Button>
                    </div>
                    <div className="grid gap-2">
                      {selectedAssets.length === 0 && (
                        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                          Nenhum bem selecionado.
                        </div>
                      )}
                      {selectedAssets.map((asset: any) => (
                        <div key={asset.id} className="flex items-start justify-between gap-3 rounded-md border bg-muted/40 p-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium break-words">{asset.descricao}</p>
                            <p className="mt-1 break-all text-xs font-mono text-muted-foreground">{asset.patrimonio}</p>
                            <p className="mt-1 text-xs text-muted-foreground break-words">
                              Atual: {asset.localizacao?.departamento || "Nao informado"} / {asset.localizacao?.sala || "Nao informado"}
                            </p>
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => setFormAssetIds((current) => current.filter((id) => id !== asset.id))}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Destino</p>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-2">
                        <Label required className={fieldErrors.includes("formDestinoSec") ? "text-destructive" : ""}>Secretaria de Destino</Label>
                        <Select value={formDestinoSec} onValueChange={(v) => {
                          setFormDestinoSec(v)
                          setFormDestinoDep("")
                          setFormDestinoSala("")
                          if (fieldErrors.includes("formDestinoSec")) setFieldErrors((prev) => prev.filter((item) => item !== "formDestinoSec"))
                        }} disabled={secretariasLoading}>
                          <SelectTrigger className={fieldErrors.includes("formDestinoSec") ? "border-destructive ring-offset-destructive" : ""}>
                            <SelectValue placeholder={secretariasLoading ? "Carregando..." : "Selecione"} />
                          </SelectTrigger>
                          <SelectContent>
                            {secretarias.map((s: any) => (
                              <SelectItem key={s.nome} value={s.nome}>{s.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-2">
                          <Label required className={fieldErrors.includes("formDestinoDep") ? "text-destructive" : ""}>Departamento</Label>
                          <SearchableSelect
                            value={formDestinoDep}
                            onValueChange={(v) => {
                              setFormDestinoDep(v)
                              setFormDestinoSala("")
                              if (fieldErrors.includes("formDestinoDep")) setFieldErrors((prev) => prev.filter((item) => item !== "formDestinoDep"))
                            }}
                            items={deptos.map((d: any) => ({
                              value: d.nome,
                              label: d.nome,
                              searchTerms: d.nome,
                            }))}
                            placeholder="Selecione"
                            searchPlaceholder="Buscar departamento..."
                            className={fieldErrors.includes("formDestinoDep") ? "border-destructive ring-offset-destructive" : ""}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label required className={fieldErrors.includes("formDestinoSala") ? "text-destructive" : ""}>Sala</Label>
                          <SearchableSelect
                            value={formDestinoSala}
                            onValueChange={(v) => {
                              setFormDestinoSala(v)
                              if (fieldErrors.includes("formDestinoSala")) setFieldErrors((prev) => prev.filter((item) => item !== "formDestinoSala"))
                            }}
                            items={salas.map((s: any) => ({
                              value: s.nome,
                              label: s.nome,
                              searchTerms: s.nome,
                            }))}
                            placeholder="Selecione"
                            searchPlaceholder="Buscar sala..."
                            className={fieldErrors.includes("formDestinoSala") ? "border-destructive ring-offset-destructive" : ""}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label required className={fieldErrors.includes("formResponsavel") ? "text-destructive" : ""}>Responsavel pela Movimentacao</Label>
                    <ResponsavelSelect
                      value={formResponsavel}
                      onValueChange={(v) => {
                        setFormResponsavel(v)
                        if (fieldErrors.includes("formResponsavel")) setFieldErrors((prev) => prev.filter((item) => item !== "formResponsavel"))
                      }}
                      placeholder="Selecione ou cadastre o responsavel"
                      className={fieldErrors.includes("formResponsavel") ? "border-destructive ring-offset-destructive" : ""}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label required className={fieldErrors.includes("formMotivo") ? "text-destructive" : ""}>Motivo</Label>
                    <Textarea
                      placeholder="Descreva o motivo da transferencia..."
                      className={cn("min-h-20", fieldErrors.includes("formMotivo") && "border-destructive focus-visible:ring-destructive")}
                      value={formMotivo}
                      onChange={(e) => {
                        setFormMotivo(e.target.value)
                        if (fieldErrors.includes("formMotivo")) setFieldErrors((prev) => prev.filter((item) => item !== "formMotivo"))
                      }}
                    />
                  </div>
                  {saved && (
                    <div className="flex items-center gap-2 text-sm text-success">
                      <CheckCircle2 className="h-4 w-4" />
                      Movimentacao registrada com sucesso!
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setNewMovOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSaveMov} disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                      Registrar Movimentacao
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {activeTab === "solicitacoes" && isAssistantRequester && (
            <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" />Nova Solicitacao</Button>
              </DialogTrigger>
              <DialogContent className="w-[min(96vw,980px)] max-w-[980px]">
                <DialogHeader>
                  <DialogTitle>Solicitar Mudanca de Patrimonio</DialogTitle>
                  <DialogDescription>
                    Selecione os bens da sua unidade e envie a solicitacao para aprovacao do patrimonio.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-5 mt-2">
                  <div className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-2">
                        <Label className={requestFieldErrors.includes("requestAssetIds") ? "text-destructive" : ""}>Selecionar bens</Label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <div className="flex-1">
                            <SearchableSelect
                              value={requestAssetPicker}
                              onValueChange={setRequestAssetPicker}
                              items={requestableAssetOptions}
                              placeholder={bensLoading ? "Carregando..." : "Buscar bem da unidade"}
                              searchPlaceholder="Buscar por patrimonio, descricao ou local atual..."
                              disabled={bensLoading}
                              className={requestFieldErrors.includes("requestAssetIds") ? "border-destructive ring-offset-destructive" : ""}
                            />
                          </div>
                          <Button type="button" variant="outline" onClick={handleAddRequestAsset} disabled={!requestAssetPicker}>
                            Adicionar bem
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        {requestSelectedAssets.length === 0 && (
                          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                            Nenhum bem selecionado.
                          </div>
                        )}
                        {requestSelectedAssets.map((asset: any) => (
                          <div key={asset.id} className="flex items-start justify-between gap-3 rounded-md border bg-muted/40 p-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium break-words">{asset.descricao}</p>
                              <p className="text-xs font-mono text-muted-foreground">{asset.patrimonio}</p>
                              <p className="mt-1 text-xs text-muted-foreground break-words">
                                Atual: {asset.localizacao?.departamento || "Nao informado"} / {asset.localizacao?.sala || "Nao informado"}
                              </p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveRequestAsset(asset.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Destino solicitado</p>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="flex flex-col gap-2">
                        <Label className={requestFieldErrors.includes("requestDestinoSec") ? "text-destructive" : ""}>Secretaria</Label>
                        <Select value={requestDestinoSec} onValueChange={(value) => {
                          setRequestDestinoSec(value)
                          setRequestDestinoDep("")
                          setRequestDestinoSala("")
                        }}>
                          <SelectTrigger className={requestFieldErrors.includes("requestDestinoSec") ? "border-destructive ring-offset-destructive" : ""}>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {secretarias.map((sec: any) => (
                              <SelectItem key={sec.nome} value={sec.nome}>{sec.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className={requestFieldErrors.includes("requestDestinoDep") ? "text-destructive" : ""}>Departamento</Label>
                        <SearchableSelect
                          value={requestDestinoDep}
                          onValueChange={(value) => {
                            setRequestDestinoDep(value)
                            setRequestDestinoSala("")
                          }}
                          items={requestDeptos.map((dep: any) => ({
                            value: dep.nome,
                            label: dep.nome,
                            searchTerms: dep.nome,
                          }))}
                          placeholder="Selecione"
                          searchPlaceholder="Buscar departamento..."
                          className={requestFieldErrors.includes("requestDestinoDep") ? "border-destructive ring-offset-destructive" : ""}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className={requestFieldErrors.includes("requestDestinoSala") ? "text-destructive" : ""}>Sala</Label>
                        <SearchableSelect
                          value={requestDestinoSala}
                          onValueChange={setRequestDestinoSala}
                          items={requestSalas.map((room: any) => ({
                            value: room.nome,
                            label: room.nome,
                            searchTerms: room.nome,
                          }))}
                          placeholder="Selecione"
                          searchPlaceholder="Buscar sala..."
                          className={requestFieldErrors.includes("requestDestinoSala") ? "border-destructive ring-offset-destructive" : ""}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className={requestFieldErrors.includes("requestMotivo") ? "text-destructive" : ""}>Motivo da solicitacao</Label>
                    <Textarea
                      value={requestMotivo}
                      onChange={(e) => {
                        setRequestMotivo(e.target.value)
                        if (requestFieldErrors.includes("requestMotivo")) {
                          setRequestFieldErrors((current) => current.filter((item) => item !== "requestMotivo"))
                        }
                      }}
                      placeholder="Explique por que esses bens precisam ser mudados de local..."
                      className={cn("min-h-24", requestFieldErrors.includes("requestMotivo") && "border-destructive focus-visible:ring-destructive")}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setRequestOpen(false)}>Cancelar</Button>
                    <Button onClick={handleCreateRequest} disabled={requestSaving} className="gap-2">
                      {requestSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                      Enviar solicitacao
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="historico">Historico</TabsTrigger>
          <TabsTrigger value="solicitacoes">
            Solicitacoes
            {canApproveRequests && requestSummary.pending > 0 && (
              <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-warning/15 px-1.5 text-[10px] font-semibold text-warning">
                {requestSummary.pending}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="historico" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(280px,1.4fr)_180px_1fr_1fr_1fr_1fr]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                              placeholder="Patrimonio completo, ultimos numeros, descricao, origem ou destino..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Periodo</Label>
                  <Select value={periodo} onValueChange={(v) => { setPeriodo(v); setPage(1) }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Periodo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Ultimos 7 dias</SelectItem>
                      <SelectItem value="30">Ultimos 30 dias</SelectItem>
                      <SelectItem value="90">Ultimos 90 dias</SelectItem>
                      <SelectItem value="mes_atual">Este mes</SelectItem>
                      <SelectItem value="todos">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Secretaria</Label>
                  <Select value={secretariaFiltro} onValueChange={(v) => { setSecretariaFiltro(v); setDepartamentoFiltro("todos"); setSalaFiltro("todos"); setPage(1) }} disabled={secretariasLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as secretarias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as secretarias</SelectItem>
                      {secretarias.map((s: any) => (
                        <SelectItem key={s.nome} value={s.nome}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Departamento</Label>
                  <SearchableSelect
                    value={departamentoFiltro}
                    onValueChange={(v) => { setDepartamentoFiltro(v || "todos"); setSalaFiltro("todos"); setPage(1) }}
                    placeholder="Todos os departamentos"
                    searchPlaceholder="Buscar departamento..."
                    items={[
                      { value: "todos", label: "Todos os departamentos", searchTerms: "todos" },
                      ...availableDepartamentos.map((dep: any) => ({
                        value: dep.nome,
                        label: dep.nome,
                        searchTerms: dep.nome,
                      })),
                    ]}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Sala</Label>
                  <SearchableSelect
                    value={salaFiltro}
                    onValueChange={(v) => { setSalaFiltro(v || "todos"); setPage(1) }}
                    placeholder="Todas as salas"
                    searchPlaceholder="Buscar sala..."
                    items={[
                      { value: "todos", label: "Todas as salas", searchTerms: "todos" },
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
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Responsavel</Label>
                  <SearchableSelect
                    value={responsavelFiltro}
                    onValueChange={(v) => { setResponsavelFiltro(v || "todos"); setPage(1) }}
                    placeholder="Todos os responsaveis"
                    searchPlaceholder="Buscar responsavel..."
                    items={[
                      { value: "todos", label: "Todos os responsaveis", searchTerms: "todos" },
                      ...responsaveis.map((r: any) => ({
                        value: r.nome,
                        label: r.nome,
                        searchTerms: `${r.nome} ${r.cargo || ""}`,
                      })),
                    ]}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            {movements.map((mov: any) => (
              <Card key={mov.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">
                    <div className="flex items-center gap-4 border-b border-border p-4 lg:w-72 lg:border-b-0 lg:border-r">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-muted overflow-hidden">
                        {mov.assetImagem ? (
                          <img src={mov.assetImagem} alt={mov.assetDescricao} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-6 w-6 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{mov.assetDescricao}</p>
                        <p className="text-xs font-mono text-muted-foreground">{mov.patrimonio}</p>
                      </div>
                    </div>
                    <div className="flex-1 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex-1 rounded-lg bg-destructive/5 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive mb-1">Origem</p>
                          <p className="text-sm font-medium">{mov.de?.departamento}</p>
                          <p className="text-xs text-muted-foreground">{mov.de?.sala}</p>
                          <p className="text-xs text-muted-foreground truncate">{mov.de?.secretaria}</p>
                        </div>
                        <div className="flex items-center justify-center shrink-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                            <ArrowRight className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                        <div className="flex-1 rounded-lg bg-success/5 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-success mb-1">Destino</p>
                          <p className="text-sm font-medium">{mov.para?.departamento}</p>
                          <p className="text-xs text-muted-foreground">{mov.para?.sala}</p>
                          <p className="text-xs text-muted-foreground truncate">{mov.para?.secretaria}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{mov.responsavel}</div>
                        <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{formatDate(mov.data)}</div>
                        <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{mov.motivo}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {movements.length === 0 && (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma movimentacao encontrada.</CardContent></Card>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="text-muted-foreground">
                Mostrando <strong className="text-foreground">{meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1}</strong>
                {" - "}
                <strong className="text-foreground">{Math.min(meta.page * meta.limit, meta.total)}</strong>
                {" de "}
                <strong className="text-foreground">{meta.total}</strong> movimentacoes
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Itens por pagina</Label>
                <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1) }}>
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {meta.totalPages > 1 && (
              <div className="flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {Array.from({ length: meta.totalPages }, (_, index) => index + 1).map((value) => {
                      if (value === 1 || value === meta.totalPages || (value >= page - 1 && value <= page + 1)) {
                        return (
                          <PaginationItem key={value}>
                            <PaginationLink isActive={page === value} onClick={() => setPage(value)} className="cursor-pointer">
                              {value}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      }

                      if ((value === page - 2 && value > 1) || (value === page + 2 && value < meta.totalPages)) {
                        return (
                          <PaginationItem key={value}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )
                      }
                      return null
                    })}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage((current) => Math.min(meta.totalPages, current + 1))}
                        className={page === meta.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="solicitacoes" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {isAssistantRequester ? "Minhas solicitacoes de mudanca" : "Fila de solicitacoes de mudanca"}
              </CardTitle>
              <CardDescription>
                {isAssistantRequester
                  ? "Envie pedidos de transferencia para aprovacao e acompanhe o retorno."
                  : "Analise os pedidos enviados pelas unidades antes de aplicar a movimentacao definitiva."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
                <div className="flex flex-col gap-2">
                  <Label>Status</Label>
                  <Select value={requestStatusFilter} onValueChange={(value) => { setRequestStatusFilter(value); setRequestsPage(1) }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todos os status</SelectItem>
                      <SelectItem value="pendente">Pendentes</SelectItem>
                      <SelectItem value="aprovada">Aprovadas</SelectItem>
                      <SelectItem value="rejeitada">Rejeitadas</SelectItem>
                      <SelectItem value="cancelada">Canceladas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Secretaria</Label>
                  <Select value={requestSecretariaFilter} onValueChange={(value) => { setRequestSecretariaFilter(value); setRequestsPage(1) }} disabled={secretariasLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as secretarias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as secretarias</SelectItem>
                      {secretarias.map((sec: any) => (
                        <SelectItem key={sec.nome} value={sec.nome}>{sec.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!isAssistantRequester && (
                  <div className="flex flex-col gap-2 md:col-span-2 xl:col-span-2">
                    <Label>Solicitante</Label>
                    <Input
                      value={requestSolicitanteFilter === "todos" ? "" : requestSolicitanteFilter}
                      placeholder="Buscar por nome do solicitante..."
                      onChange={(e) => {
                        setRequestSolicitanteFilter(e.target.value.trim() || "todos")
                        setRequestsPage(1)
                      }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Solicitacoes listadas</p>
                <p className="mt-1 text-2xl font-semibold">{requestSummary.count}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="mt-1 text-2xl font-semibold">{requestSummary.pending}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Escopo</p>
                <p className="mt-1 text-sm font-medium">
                  {isAssistantRequester ? "Somente minhas solicitacoes" : "Fila de aprovacao do patrimonio"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            {requests.map((item: any) => {
              const canCancel = isAssistantRequester && item.status === "pendente"
              const canDecide = canApproveRequests && item.status === "pendente"
              return (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold">Solicitacao #{item.id}</p>
                          <Badge variant="outline" className={cn("capitalize", requestStatusClasses[item.status] || requestStatusClasses.pendente)}>
                            {requestStatusLabels[item.status] || item.status}
                          </Badge>
                          <Badge variant="secondary">{item.totalItens} bem(ns)</Badge>
                        </div>

                        <div className="mt-2 grid gap-3 lg:grid-cols-2">
                          <div className="rounded-lg border bg-muted/40 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Origem da solicitacao</p>
                            <p className="mt-1 text-sm font-medium">{item.secretariaOrigem}</p>
                            <p className="text-xs text-muted-foreground">Solicitante: {item.solicitanteNome}</p>
                          </div>
                          <div className="rounded-lg border bg-muted/40 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Destino solicitado</p>
                            <p className="mt-1 text-sm font-medium">{item.departamentoDestino}</p>
                            <p className="text-xs text-muted-foreground">{item.salaDestino} • {item.secretariaDestino}</p>
                          </div>
                        </div>

                        <div className="mt-3 rounded-lg border p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Motivo</p>
                          <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{item.motivo}</p>
                        </div>

                        <div className="mt-3 rounded-lg border p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bens incluidos</p>
                          <div className="mt-2 grid gap-2">
                            {item.itens.map((requestItem: any) => (
                              <div key={requestItem.id} className="rounded-md bg-muted/40 p-3">
                                <p className="text-sm font-medium break-words">{requestItem.bemDescricao}</p>
                                <p className="text-xs font-mono text-muted-foreground">{requestItem.patrimonio}</p>
                                <p className="mt-1 text-xs text-muted-foreground break-words">
                                  Origem atual na solicitacao: {requestItem.de?.departamento || "Nao informado"} / {requestItem.de?.sala || "Nao informado"}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{formatDate(item.criadoEm)}</div>
                          {item.aprovadoPorNome && <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Aprovado por {item.aprovadoPorNome}</div>}
                          {item.rejeitadoPorNome && <div className="flex items-center gap-1.5"><ShieldX className="h-3.5 w-3.5" />Rejeitado por {item.rejeitadoPorNome}</div>}
                        </div>

                        {item.motivoRejeicao && (
                          <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-destructive">Motivo da rejeicao</p>
                            <p className="mt-1 text-sm text-destructive whitespace-pre-wrap">{item.motivoRejeicao}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col gap-2 xl:w-[220px]">
                        <Button variant="outline" className="gap-2" onClick={() => handleGerarPdfSolicitacao(item)}>
                          <Printer className="h-4 w-4" />
                          Gerar PDF
                        </Button>
                        {canDecide && (
                          <>
                            <Button className="gap-2" onClick={() => openDecisionDialog("aprovar", item)}>
                              <ShieldCheck className="h-4 w-4" />
                              Aprovar e mover
                            </Button>
                            <Button variant="destructive" className="gap-2" onClick={() => openDecisionDialog("rejeitar", item)}>
                              <ShieldX className="h-4 w-4" />
                              Rejeitar
                            </Button>
                          </>
                        )}
                        {canCancel && (
                          <Button variant="outline" onClick={() => openDecisionDialog("cancelar", item)}>
                            Cancelar solicitacao
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {requests.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhuma solicitacao encontrada para os filtros atuais.
                </CardContent>
              </Card>
            )}
          </div>

          {requestsMeta.totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setRequestsPage((current) => Math.max(1, current - 1))}
                      className={requestsPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {Array.from({ length: requestsMeta.totalPages }, (_, index) => index + 1).map((value) => {
                    if (value === 1 || value === requestsMeta.totalPages || (value >= requestsPage - 1 && value <= requestsPage + 1)) {
                      return (
                        <PaginationItem key={value}>
                          <PaginationLink isActive={requestsPage === value} onClick={() => setRequestsPage(value)} className="cursor-pointer">
                            {value}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    }
                    if ((value === requestsPage - 2 && value > 1) || (value === requestsPage + 2 && value < requestsMeta.totalPages)) {
                      return (
                        <PaginationItem key={value}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )
                    }
                    return null
                  })}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setRequestsPage((current) => Math.min(requestsMeta.totalPages, current + 1))}
                      className={requestsPage === requestsMeta.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {decisionAction === "aprovar"
                ? "Aprovar solicitacao"
                : decisionAction === "rejeitar"
                  ? "Rejeitar solicitacao"
                  : "Cancelar solicitacao"}
            </DialogTitle>
            <DialogDescription>
              {decisionAction === "aprovar"
                ? "Ao confirmar, os bens serao transferidos automaticamente para o destino solicitado."
                : decisionAction === "rejeitar"
                  ? "Informe o motivo da rejeicao para que o solicitante entenda o retorno."
                  : "A solicitacao sera cancelada e deixara de aguardar aprovacao."}
            </DialogDescription>
          </DialogHeader>
          {decisionTarget && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p className="font-medium">Solicitacao #{decisionTarget.id}</p>
                <p className="mt-1 text-muted-foreground">
                  {decisionTarget.totalItens} bem(ns) • Destino: {decisionTarget.departamentoDestino} / {decisionTarget.salaDestino}
                </p>
              </div>

              {decisionAction === "rejeitar" && (
                <div className="flex flex-col gap-2">
                  <Label>Motivo da rejeicao</Label>
                  <Textarea
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    placeholder="Explique por que a solicitacao nao foi aprovada..."
                    className="min-h-24"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDecisionDialogOpen(false)}>Voltar</Button>
                <Button
                  onClick={handleDecision}
                  disabled={decisionSaving}
                  variant={decisionAction === "rejeitar" ? "destructive" : "default"}
                  className="gap-2"
                >
                  {decisionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {decisionAction === "aprovar"
                    ? "Confirmar aprovacao"
                    : decisionAction === "rejeitar"
                      ? "Confirmar rejeicao"
                      : "Confirmar cancelamento"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
