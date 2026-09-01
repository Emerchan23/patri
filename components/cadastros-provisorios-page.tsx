"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import { api, fetcher, getApiErrorMessage } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"

type CadastroStatus =
  | "rascunho"
  | "enviado_pela_unidade"
  | "em_ajuste_almoxarifado"
  | "em_analise_patrimonio"
  | "devolvido_para_ajuste"
  | "rejeitado"
  | "definitivado"

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

interface Categoria {
  id: string
  nome: string
  slug: string
}

interface CadastroRecord {
  id: string
  codigo: string | null
  status: CadastroStatus
  solicitante: {
    id: string
    nome: string
  }
  localizacao: {
    secretaria: string
    departamento: string
    sala: string
  }
  descricao: string
  categoria: string
  grupo: string
  marca: string
  modelo: string
  fornecedor: string
  numeroSerie: string
  quantidade: number
  valor: number | null
  estadoConservacao: string
  responsavel: {
    nome: string
    cargo: string
  }
  observacoes: string
  imagem: string | null
  notaFiscal: string | null
  emendaParlamentar: string
  tipoEntrada: string
  fluxo: {
    ajustadoPor: string | null
    ajustadoEm: string | null
    encaminhadoPatrimonioEm: string | null
    aprovadoPor: string | null
    aprovadoEm: string | null
    rejeitadoPor: string | null
    rejeitadoEm: string | null
    motivoRejeicao: string
    devolvidoPor: string | null
    devolvidoEm: string | null
    motivoDevolucao: string
    bemDefinitivoId: string | null
  }
  criadoEm: string
  atualizadoEm: string
}

interface HistoricoRecord {
  id: string
  acao: string
  statusAnterior: string | null
  statusNovo: string | null
  usuario: {
    id: string
    nome: string
    role: string
  }
  observacao: string
  criadoEm: string
}

interface FormState {
  descricao: string
  categoria: string
  grupo: string
  marca: string
  modelo: string
  fornecedor: string
  numeroSerie: string
  quantidade: string
  valor: string
  estadoConservacao: string
  secretaria: string
  departamento: string
  sala: string
  responsavelNome: string
  responsavelCargo: string
  observacoes: string
  emendaParlamentar: string
  tipoEntrada: string
}

const emptyForm: FormState = {
  descricao: "",
  categoria: "",
  grupo: "",
  marca: "",
  modelo: "",
  fornecedor: "",
  numeroSerie: "",
  quantidade: "1",
  valor: "",
  estadoConservacao: "novo",
  secretaria: "",
  departamento: "",
  sala: "",
  responsavelNome: "",
  responsavelCargo: "",
  observacoes: "",
  emendaParlamentar: "",
  tipoEntrada: "compra",
}

const statusLabel: Record<CadastroStatus, string> = {
  rascunho: "Rascunho",
  enviado_pela_unidade: "Enviado pela unidade",
  em_ajuste_almoxarifado: "Em ajuste no almoxarifado",
  em_analise_patrimonio: "Em análise do patrimônio",
  devolvido_para_ajuste: "Devolvido para ajuste",
  rejeitado: "Rejeitado",
  definitivado: "Definitivado",
}

const statusClass: Record<CadastroStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado_pela_unidade: "bg-primary/10 text-primary",
  em_ajuste_almoxarifado: "bg-warning/10 text-warning",
  em_analise_patrimonio: "bg-accent/10 text-accent",
  devolvido_para_ajuste: "bg-orange-100 text-orange-700",
  rejeitado: "bg-destructive/10 text-destructive",
  definitivado: "bg-success/10 text-success",
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("pt-BR")
}

function currencyToNumber(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function numberToCurrency(value: number | null) {
  if (value === null || value === undefined) return ""
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CadastrosProvisoriosPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const isAssistant = user?.role === "assistente"
  const canCreate = Boolean(user?.permissions?.acessarCadastrosProvisorios && isAssistant)
  const canManage = Boolean(user?.role === "administrador" || user?.role === "gestor")

  const [statusFilter, setStatusFilter] = useState<string>("todos")
  const [search, setSearch] = useState("")
  const [secretariaFilter, setSecretariaFilter] = useState<string>("todas")
  const [departamentoFilter, setDepartamentoFilter] = useState<string>("todos")
  const [salaFilter, setSalaFilter] = useState<string>("todas")
  const [formOpen, setFormOpen] = useState(false)
  const [editingCadastro, setEditingCadastro] = useState<CadastroRecord | null>(null)
  const [detailsCadastro, setDetailsCadastro] = useState<CadastroRecord | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyTarget, setHistoryTarget] = useState<CadastroRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const query = new URLSearchParams()
  if (statusFilter !== "todos") query.set("status", statusFilter)
  if (search.trim()) query.set("search", search.trim())
  if (secretariaFilter !== "todas") query.set("secretaria", secretariaFilter)
  if (departamentoFilter !== "todos") query.set("departamento", departamentoFilter)
  if (salaFilter !== "todas") query.set("sala", salaFilter)

  const { data, isLoading, mutate } = useSWR<{ data: CadastroRecord[] }>(
    `/cadastros-provisorios?${query.toString()}`,
    fetcher
  )
  const cadastros = data?.data || []

  const { data: secretariasData } = useSWR("/secretarias?all=true", fetcher)
  const secretarias = (Array.isArray(secretariasData) ? secretariasData : secretariasData?.data || []) as Secretaria[]

  const { data: categoriasData } = useSWR("/categorias?all=true", fetcher)
  const categorias = (Array.isArray(categoriasData) ? categoriasData : categoriasData?.data || []) as Categoria[]

  const { data: historyData, isLoading: historyLoading } = useSWR<{ data: HistoricoRecord[] }>(
    historyOpen && historyTarget ? `/cadastros-provisorios/${historyTarget.id}/historico` : null,
    fetcher
  )

  const selectedSecretaria = useMemo(
    () => secretarias.find((item) => item.nome === form.secretaria),
    [secretarias, form.secretaria]
  )
  const selectedDepartamento = useMemo(
    () => selectedSecretaria?.departamentos.find((item) => item.nome === form.departamento),
    [selectedSecretaria, form.departamento]
  )

  const filterSecretaria = useMemo(
    () => secretarias.find((item) => item.nome === secretariaFilter),
    [secretarias, secretariaFilter]
  )
  const filterDepartamento = useMemo(
    () => filterSecretaria?.departamentos.find((item) => item.nome === departamentoFilter),
    [filterSecretaria, departamentoFilter]
  )

  const stats = useMemo(() => ({
    total: cadastros.length,
    enviados: cadastros.filter((item) => item.status === "enviado_pela_unidade").length,
    ajustes: cadastros.filter((item) => item.status === "em_ajuste_almoxarifado" || item.status === "devolvido_para_ajuste").length,
    finalizados: cadastros.filter((item) => item.status === "definitivado").length,
  }), [cadastros])

  const openCreate = () => {
    const firstDepartment = user?.unidade?.departamentos?.[0] || user?.unidade?.departamento || ""
    setEditingCadastro(null)
    setForm({
      ...emptyForm,
      secretaria: user?.unidade?.secretaria || "",
      departamento: firstDepartment,
      sala: "",
    })
    setFormOpen(true)
  }

  const openEdit = (cadastro: CadastroRecord) => {
    setEditingCadastro(cadastro)
    setForm({
      descricao: cadastro.descricao,
      categoria: cadastro.categoria,
      grupo: cadastro.grupo,
      marca: cadastro.marca,
      modelo: cadastro.modelo,
      fornecedor: cadastro.fornecedor,
      numeroSerie: cadastro.numeroSerie,
      quantidade: String(cadastro.quantidade || 1),
      valor: numberToCurrency(cadastro.valor),
      estadoConservacao: cadastro.estadoConservacao,
      secretaria: cadastro.localizacao.secretaria,
      departamento: cadastro.localizacao.departamento,
      sala: cadastro.localizacao.sala,
      responsavelNome: cadastro.responsavel.nome,
      responsavelCargo: cadastro.responsavel.cargo,
      observacoes: cadastro.observacoes,
      emendaParlamentar: cadastro.emendaParlamentar,
      tipoEntrada: cadastro.tipoEntrada || "compra",
    })
    setFormOpen(true)
  }

  const submitForm = async () => {
    if (!form.descricao || !form.categoria || !form.secretaria || !form.departamento || !form.sala) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha descrição, categoria, secretaria, departamento e sala.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        quantidade: Number(form.quantidade || 1),
        valor: currencyToNumber(form.valor),
      }

      if (editingCadastro) {
        await api.updateCadastroProvisorio(editingCadastro.id, payload)
      } else {
        await api.createCadastroProvisorio(payload)
      }

      await mutate()
      setFormOpen(false)
      setEditingCadastro(null)
      setForm(emptyForm)
      toast({
        title: editingCadastro ? "Cadastro atualizado" : "Cadastro enviado",
        description: editingCadastro
          ? "As alterações foram salvas no fluxo provisório."
          : "O item foi enviado para conferência do almoxarifado/patrimônio.",
      })
    } catch (error) {
      toast({
        title: "Não foi possível salvar",
        description: getApiErrorMessage(error, "Erro ao salvar cadastro provisório."),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (id: string, type: "encaminhar" | "devolver" | "rejeitar" | "aprovar") => {
    let reason = ""
    if (type === "devolver") {
      reason = window.prompt("Informe o motivo da devolução:")?.trim() || ""
      if (!reason) return
    }
    if (type === "rejeitar") {
      reason = window.prompt("Informe o motivo da rejeição:")?.trim() || ""
      if (!reason) return
    }

    setActionLoadingId(`${type}-${id}`)
    try {
      if (type === "encaminhar") await api.encaminharCadastroProvisorio(id)
      if (type === "devolver") await api.devolverCadastroProvisorio(id, reason)
      if (type === "rejeitar") await api.rejeitarCadastroProvisorio(id, reason)
      if (type === "aprovar") await api.aprovarCadastroProvisorio(id)
      await mutate()
      toast({
        title: "Fluxo atualizado",
        description: "A ação foi concluída com sucesso.",
      })
    } catch (error) {
      toast({
        title: "Ação não concluída",
        description: getApiErrorMessage(error, "Erro ao executar a ação no cadastro provisório."),
        variant: "destructive",
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isAssistant ? "Cadastro Provisório da Unidade" : "Fila de Cadastros Provisórios"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAssistant
              ? "Envie bens da unidade para conferência do almoxarifado e aprovação final do patrimônio."
              : "Ajuste operacional do almoxarifado e aprovação fiscalizada do patrimônio."}
          </p>
        </div>
        {canCreate && (
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Novo Cadastro Provisório
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3 p-4"><ClipboardList className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Total na fila</p><p className="text-xl font-bold">{stats.total}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Send className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Enviados</p><p className="text-xl font-bold">{stats.enviados}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><RefreshCw className="h-5 w-5 text-warning" /><div><p className="text-xs text-muted-foreground">Em ajuste</p><p className="text-xl font-bold">{stats.ajustes}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><ShieldCheck className="h-5 w-5 text-success" /><div><p className="text-xs text-muted-foreground">Definitivados</p><p className="text-xl font-bold">{stats.finalizados}</p></div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Label>Buscar</Label>
              <Input placeholder="Código, descrição, série ou solicitante..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(statusLabel).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Secretaria</Label>
              <Select value={secretariaFilter} onValueChange={(value) => { setSecretariaFilter(value); setDepartamentoFilter("todos"); setSalaFilter("todas") }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {secretarias.map((secretaria) => (
                    <SelectItem key={secretaria.nome} value={secretaria.nome}>{secretaria.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Departamento</Label>
              <Select value={departamentoFilter} onValueChange={(value) => { setDepartamentoFilter(value); setSalaFilter("todas") }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(filterSecretaria?.departamentos || []).map((departamento) => (
                    <SelectItem key={departamento.nome} value={departamento.nome}>{departamento.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sala</Label>
              <Select value={salaFilter} onValueChange={setSalaFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {(filterDepartamento?.salas || []).map((sala) => (
                    <SelectItem key={sala.nome} value={sala.nome}>{sala.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isAssistant ? "Meus registros enviados" : "Registros aguardando tratamento"}
          </CardTitle>
          <CardDescription>
            {isAssistant
              ? "Acompanhe o que já foi enviado, ajustado, devolvido ou aprovado."
              : "Use esta fila para ajustar livremente, devolver para a unidade ou aprovar a entrada no patrimônio oficial."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando cadastros provisórios...
            </div>
          ) : cadastros.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum cadastro provisório encontrado com os filtros atuais.
            </div>
          ) : (
            cadastros.map((cadastro) => {
              const canAssistantEdit = isAssistant && (cadastro.status === "enviado_pela_unidade" || cadastro.status === "devolvido_para_ajuste")
              return (
                <div key={cadastro.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{cadastro.codigo || `CPU-${cadastro.id}`}</p>
                        <Badge className={`text-xs ${statusClass[cadastro.status]}`}>{statusLabel[cadastro.status]}</Badge>
                        <Badge variant="outline" className="text-xs">{cadastro.quantidade} item(ns)</Badge>
                      </div>
                      <p className="text-base font-medium">{cadastro.descricao}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Solicitante: {cadastro.solicitante.nome}</span>
                        <span>Categoria: {cadastro.categoria}</span>
                        {cadastro.numeroSerie && <span>Série: {cadastro.numeroSerie}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{cadastro.localizacao.secretaria} / {cadastro.localizacao.departamento} / {cadastro.localizacao.sala}</span>
                      </div>
                      {cadastro.fluxo.motivoDevolucao && (
                        <div className="rounded-lg bg-orange-50 p-2 text-xs text-orange-700">
                          Motivo da devolução: {cadastro.fluxo.motivoDevolucao}
                        </div>
                      )}
                      {cadastro.fluxo.motivoRejeicao && (
                        <div className="rounded-lg bg-destructive/5 p-2 text-xs text-destructive">
                          Motivo da rejeição: {cadastro.fluxo.motivoRejeicao}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => setDetailsCadastro(cadastro)}>
                        <Eye className="h-4 w-4" />
                        Ver
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => { setHistoryTarget(cadastro); setHistoryOpen(true) }}>
                        <ClipboardList className="h-4 w-4" />
                        Histórico
                      </Button>
                      {(canAssistantEdit || canManage) && cadastro.status !== "definitivado" && cadastro.status !== "rejeitado" && (
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => openEdit(cadastro)}>
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Button>
                      )}
                      {canManage && cadastro.status !== "em_analise_patrimonio" && cadastro.status !== "definitivado" && cadastro.status !== "rejeitado" && (
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => runAction(cadastro.id, "encaminhar")} disabled={actionLoadingId === `encaminhar-${cadastro.id}`}>
                          {actionLoadingId === `encaminhar-${cadastro.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          Encaminhar
                        </Button>
                      )}
                      {canManage && cadastro.status !== "definitivado" && cadastro.status !== "rejeitado" && (
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => runAction(cadastro.id, "devolver")} disabled={actionLoadingId === `devolver-${cadastro.id}`}>
                          {actionLoadingId === `devolver-${cadastro.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                          Devolver
                        </Button>
                      )}
                      {canManage && cadastro.status !== "definitivado" && cadastro.status !== "rejeitado" && (
                        <Button size="sm" variant="destructive" className="gap-2" onClick={() => runAction(cadastro.id, "rejeitar")} disabled={actionLoadingId === `rejeitar-${cadastro.id}`}>
                          {actionLoadingId === `rejeitar-${cadastro.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                          Rejeitar
                        </Button>
                      )}
                      {canManage && cadastro.status !== "definitivado" && cadastro.status !== "rejeitado" && (
                        <Button size="sm" className="gap-2" onClick={() => runAction(cadastro.id, "aprovar")} disabled={actionLoadingId === `aprovar-${cadastro.id}`}>
                          {actionLoadingId === `aprovar-${cadastro.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Aprovar e entrar no sistema
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCadastro ? "Editar Cadastro Provisório" : "Novo Cadastro Provisório da Unidade"}</DialogTitle>
            <DialogDescription>
              {editingCadastro
                ? "Ajuste os dados para manter o fluxo da unidade organizado."
                : "Este registro ainda não entra no patrimônio oficial. Ele seguirá para conferência do almoxarifado e aprovação do patrimônio."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(value) => setForm((prev) => ({ ...prev, categoria: value }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categorias.map((categoria) => (
                    <SelectItem key={categoria.slug} value={categoria.slug}>{categoria.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Grupo</Label><Input value={form.grupo} onChange={(e) => setForm((prev) => ({ ...prev, grupo: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Marca</Label><Input value={form.marca} onChange={(e) => setForm((prev) => ({ ...prev, marca: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Modelo</Label><Input value={form.modelo} onChange={(e) => setForm((prev) => ({ ...prev, modelo: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Fornecedor</Label><Input value={form.fornecedor} onChange={(e) => setForm((prev) => ({ ...prev, fornecedor: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Número de Série</Label><Input value={form.numeroSerie} onChange={(e) => setForm((prev) => ({ ...prev, numeroSerie: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Quantidade</Label><Input type="number" min="1" value={form.quantidade} onChange={(e) => setForm((prev) => ({ ...prev, quantidade: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Valor</Label><Input value={form.valor} onChange={(e) => setForm((prev) => ({ ...prev, valor: e.target.value }))} placeholder="0,00" /></div>
            <div className="space-y-2">
              <Label>Estado de Conservação</Label>
              <Select value={form.estadoConservacao} onValueChange={(value) => setForm((prev) => ({ ...prev, estadoConservacao: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="bom">Bom</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="ruim">Ruim</SelectItem>
                  <SelectItem value="inoperante">Inoperante</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Secretaria</Label>
              <Select value={form.secretaria} onValueChange={(value) => setForm((prev) => ({ ...prev, secretaria: value, departamento: "", sala: "" }))} disabled={isAssistant}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {secretarias.map((secretaria) => (
                    <SelectItem key={secretaria.nome} value={secretaria.nome}>{secretaria.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={form.departamento} onValueChange={(value) => setForm((prev) => ({ ...prev, departamento: value, sala: "" }))} disabled={isAssistant}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(selectedSecretaria?.departamentos || []).map((departamento) => (
                    <SelectItem key={departamento.nome} value={departamento.nome}>{departamento.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sala</Label>
              <Select value={form.sala} onValueChange={(value) => setForm((prev) => ({ ...prev, sala: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(selectedDepartamento?.salas || []).map((sala) => (
                    <SelectItem key={sala.nome} value={sala.nome}>{sala.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Responsável</Label><Input value={form.responsavelNome} onChange={(e) => setForm((prev) => ({ ...prev, responsavelNome: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Cargo do Responsável</Label><Input value={form.responsavelCargo} onChange={(e) => setForm((prev) => ({ ...prev, responsavelCargo: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Tipo de Entrada</Label><Input value={form.tipoEntrada} onChange={(e) => setForm((prev) => ({ ...prev, tipoEntrada: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Emenda/Processo</Label><Input value={form.emendaParlamentar} onChange={(e) => setForm((prev) => ({ ...prev, emendaParlamentar: e.target.value }))} /></div>
            <div className="space-y-2 lg:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))} className="min-h-24" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={submitForm} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <SaveIcon />}
              {editingCadastro ? "Salvar ajustes" : "Enviar cadastro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsCadastro} onOpenChange={(open) => !open && setDetailsCadastro(null)}>
        <DialogContent className="max-w-2xl">
          {detailsCadastro && (
            <>
              <DialogHeader>
                <DialogTitle>{detailsCadastro.codigo}</DialogTitle>
                <DialogDescription>{detailsCadastro.descricao}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
                <div><strong>Status:</strong> {statusLabel[detailsCadastro.status]}</div>
                <div><strong>Solicitante:</strong> {detailsCadastro.solicitante.nome}</div>
                <div><strong>Categoria:</strong> {detailsCadastro.categoria}</div>
                <div><strong>Quantidade:</strong> {detailsCadastro.quantidade}</div>
                <div><strong>Série:</strong> {detailsCadastro.numeroSerie || "-"}</div>
                <div><strong>Fornecedor:</strong> {detailsCadastro.fornecedor || "-"}</div>
                <div className="md:col-span-2"><strong>Localização:</strong> {detailsCadastro.localizacao.secretaria} / {detailsCadastro.localizacao.departamento} / {detailsCadastro.localizacao.sala}</div>
                <div className="md:col-span-2"><strong>Observações:</strong> {detailsCadastro.observacoes || "-"}</div>
                <div className="md:col-span-2"><strong>Fluxo:</strong> Ajustado por {detailsCadastro.fluxo.ajustadoPor || "-"} em {formatDateTime(detailsCadastro.fluxo.ajustadoEm)}</div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico do Cadastro</DialogTitle>
            <DialogDescription>{historyTarget?.codigo || historyTarget?.descricao}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {historyLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando histórico...</div>
            ) : (historyData?.data || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
            ) : (
              (historyData?.data || []).map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{item.acao}</p>
                    <span className="text-xs text-muted-foreground">{formatDateTime(item.criadoEm)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{item.usuario.nome} ({item.usuario.role})</p>
                  {item.observacao && <p className="text-sm mt-2">{item.observacao}</p>}
                  {(item.statusAnterior || item.statusNovo) && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {item.statusAnterior || "-"} → {item.statusNovo || "-"}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SaveIcon() {
  return <Pencil className="h-4 w-4" />
}
