"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import {
  formatDate,
  getLoanStatusLabel,
  getLoanStatusColor,
  type Loan,
  type LoanStatus,
} from "@/lib/data"
import { fetcher, api, getApiErrorMessage, isApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Repeat2,
  Plus,
  Search,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Package,
  Building2,
  Undo2,
  Loader2,
  Printer,
  ImageIcon,
} from "lucide-react"
import { DatePicker } from "@/components/ui/date-picker"
import { useToast } from "@/components/ui/use-toast"

import { ResponsavelSelect } from "@/components/responsavel-select"

export function Emprestimos() {
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("todos")
  const [secretariaFilter, setSecretariaFilter] = useState<string>("todas")
  const [departamentoFilter, setDepartamentoFilter] = useState<string>("todos")
  const [salaFilter, setSalaFilter] = useState<string>("todos")

  const queryParams = new URLSearchParams()
  queryParams.set("page", page.toString())
  queryParams.set("limit", limit.toString())
  if (searchTerm) queryParams.set("busca", searchTerm)
  if (filterStatus !== "todos") queryParams.set("status", filterStatus)
  if (secretariaFilter !== "todas") queryParams.set("secretaria", secretariaFilter)
  if (departamentoFilter !== "todos") queryParams.set("departamento", departamentoFilter)
  if (salaFilter !== "todos") queryParams.set("sala", salaFilter)

  const { data: result, mutate: mutateLoans } = useSWR(["emprestimos", queryParams.toString()], () => api.getEmprestimos(queryParams.toString()))
  const loans: Loan[] = result?.data || []
  const meta = result?.meta || { total: 0, stats: { ativos: 0, atrasados: 0, devolvidos: 0, total: 0 }, page: 1, limit: 20, totalPages: 1 }
  const stats = meta.stats

  const { data: bensData } = useSWR("/bens?limit=9999", fetcher)
  const { data: veiculosData } = useSWR("/veiculos", fetcher)
  const { data: secretariasData } = useSWR("/secretarias?all=true", fetcher)

  const allAssets = useMemo(() => {
    const b = bensData?.data || bensData || []
    const v = veiculosData || []
    return [...b, ...v]
  }, [bensData, veiculosData])

  const secretarias = Array.isArray(secretariasData) ? secretariasData : (secretariasData?.data || [])

  const [newLoanOpen, setNewLoanOpen] = useState(false)
  const [devolucaoOpen, setDevolucaoOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<string[]>([])

  const [formAssetId, setFormAssetId] = useState("")
  const [formDestinoSec, setFormDestinoSec] = useState("")
  const [formDestinoDep, setFormDestinoDep] = useState("")
  const [formDestinoSala, setFormDestinoSala] = useState("")
  const [formResponsavelEmprestimo, setFormResponsavelEmprestimo] = useState("")
  const [formResponsavelRecebimento, setFormResponsavelRecebimento] = useState("")
  const [formSolicitante, setFormSolicitante] = useState("")
  const [formDataEmprestimo, setFormDataEmprestimo] = useState<Date | undefined>(new Date())
  const [formDataPrevista, setFormDataPrevista] = useState<Date | undefined>(undefined)
  const [semDataPrevista, setSemDataPrevista] = useState(false)
  const [formMotivo, setFormMotivo] = useState("")
  const [formObservacoes, setFormObservacoes] = useState("")
  const [exigirTermo, setExigirTermo] = useState(true)
  const [formDataDevolucao, setFormDataDevolucao] = useState<Date | undefined>(new Date())
  const [formObsDevolucao, setFormObsDevolucao] = useState("")

  const availableAssets = useMemo(
    () => allAssets.filter((a: any) => a.status === "ativo"),
    [allAssets]
  )

  const selectedAsset = useMemo(
    () => allAssets.find((a: any) => a.id === formAssetId),
    [allAssets, formAssetId]
  )

  const destinoSec = useMemo(
    () => secretarias.find((s: any) => s.nome === formDestinoSec),
    [secretarias, formDestinoSec]
  )
  const destinoDeptos = destinoSec?.departamentos || []
  const destinoDep = useMemo(
    () => destinoDeptos.find((d: any) => d.nome === formDestinoDep),
    [destinoDeptos, formDestinoDep]
  )
  const destinoSalas = destinoDep?.salas || []

  const availableDepartamentos = useMemo(() => {
    if (secretariaFilter !== "todas") {
      const sec = secretarias.find((item: any) => item.nome === secretariaFilter)
      return sec?.departamentos || []
    }
    return secretarias.flatMap((item: any) => item.departamentos || [])
  }, [secretarias, secretariaFilter])

  const availableSalas = useMemo(() => {
    if (departamentoFilter !== "todos") {
      const dep = availableDepartamentos.find((item: any) => item.nome === departamentoFilter)
      return dep?.salas || []
    }
    return availableDepartamentos.flatMap((item: any) => item.salas || [])
  }, [availableDepartamentos, departamentoFilter])

  const resetNewLoanForm = () => {
    setFormAssetId(""); setFormDestinoSec(""); setFormDestinoDep(""); setFormDestinoSala("")
    setFormResponsavelEmprestimo(""); setFormResponsavelRecebimento(""); setFormSolicitante("")
    setFormDataEmprestimo(new Date()); setFormDataPrevista(undefined); setSemDataPrevista(false)
    setFormMotivo(""); setFormObservacoes("")
    setExigirTermo(true)
  }

  const handleCreateLoan = async () => {
    // Validation
    const missingFields: string[] = []
    const newFieldErrors: string[] = []

    if (!selectedAsset) { missingFields.push("Bem Patrimonial"); newFieldErrors.push("formAssetId"); }
    if (!formDestinoSec) { missingFields.push("Secretaria de Destino"); newFieldErrors.push("formDestinoSec"); }
    if (!formDestinoDep) { missingFields.push("Departamento"); newFieldErrors.push("formDestinoDep"); }
    if (!formDestinoSala) { missingFields.push("Sala"); newFieldErrors.push("formDestinoSala"); }
    if (!semDataPrevista && !formDataPrevista) { missingFields.push("Data Prevista de Devolução ou opção sem prazo"); newFieldErrors.push("formDataPrevista"); }
    if (!formMotivo.trim()) { missingFields.push("Motivo"); newFieldErrors.push("formMotivo"); }
    if (!formResponsavelEmprestimo.trim()) { missingFields.push("Responsável pelo Empréstimo"); newFieldErrors.push("formResponsavelEmprestimo"); }
    if (!formResponsavelRecebimento.trim()) { missingFields.push("Responsável pelo Recebimento"); newFieldErrors.push("formResponsavelRecebimento"); }
    
    setFieldErrors(newFieldErrors)

    if (missingFields.length > 0) {
      toast({ 
        title: "Campos Obrigatórios Faltando", 
        description: (
            <div className="flex flex-col gap-1">
                <p>Por favor, preencha os seguintes campos:</p>
                <ul className="list-disc pl-4 text-xs">
                    {missingFields.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
            </div>
        ),
        variant: "destructive",
        duration: 5000,
      })
      return
    }

    setSaving(true)
    try {
      await api.createEmprestimo({
        assetId: selectedAsset.id,
        assetDescricao: selectedAsset.descricao,
        patrimonio: selectedAsset.patrimonio,
        origem: selectedAsset.localizacao,
        destino: { secretaria: formDestinoSec, departamento: formDestinoDep, sala: formDestinoSala },
        responsavelEmprestimo: formResponsavelEmprestimo,
        responsavelRecebimento: formResponsavelRecebimento,
        solicitante: formSolicitante,
        dataEmprestimo: formDataEmprestimo?.toISOString().split("T")[0],
        dataPrevistaDevolucao: semDataPrevista ? undefined : formDataPrevista!.toISOString().split("T")[0],
        motivo: formMotivo,
        observacoes: formObservacoes || undefined,
        exigirTermo,
      })
      await mutateLoans()
      
      toast({
        title: "Sucesso",
        description: "Empréstimo registrado com sucesso!",
      })
      
      setNewLoanOpen(false)
      resetNewLoanForm()
    } catch (e) {
      console.error(e)
      toast({
        title: "Erro ao criar empréstimo",
        description:
          isApiError(e) && e.status === 403
            ? "Você não tem permissão para registrar este empréstimo."
            : getApiErrorMessage(e, "Não foi possível registrar o empréstimo. Tente novamente."),
        variant: "destructive",
      })
    }
    setSaving(false)
  }

  const handleDevolucao = async () => {
    if (!selectedLoan) return
    
    if (!formDataDevolucao) {
      toast({ title: "Erro de validação", description: "Informe a data da devolução.", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      await api.devolverEmprestimo(selectedLoan.id, {
        dataDevolucao: formDataDevolucao.toISOString().split("T")[0],
        observacoes: formObsDevolucao || undefined,
      })
      await mutateLoans()
      
      toast({
        title: "Sucesso",
        description: "Devolução registrada com sucesso!",
      })
      
      setDevolucaoOpen(false)
      setSelectedLoan(null)
    } catch (e) {
      console.error(e)
      toast({
        title: "Erro ao registrar devolução",
        description: getApiErrorMessage(e, "Não foi possível registrar a devolução. Tente novamente."),
        variant: "destructive",
      })
    }
    setSaving(false)
  }

  const openDevolucao = (loan: Loan) => {
    setSelectedLoan(loan)
    setFormDataDevolucao(new Date())
    setFormObsDevolucao("")
    setDevolucaoOpen(true)
  }

  const openDetails = async (loan: Loan) => {
    try {
      const completeLoan = await api.getEmprestimo(loan.id)
      setSelectedLoan(completeLoan)
    } catch {
      setSelectedLoan(loan)
    }
    setDetailsOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Emprestimos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controle de emprestimos de equipamentos entre secretarias e departamentos
          </p>
        </div>
        <Button onClick={() => { resetNewLoanForm(); setNewLoanOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Emprestimo
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Repeat2 className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold text-foreground">{stats.total}</p><p className="text-xs text-muted-foreground">Total</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10"><Clock className="h-5 w-5 text-warning" /></div><div><p className="text-2xl font-bold text-foreground">{stats.ativos}</p><p className="text-xs text-muted-foreground">Ativos</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></div><div><p className="text-2xl font-bold text-foreground">{stats.atrasados}</p><p className="text-xs text-muted-foreground">Atrasados</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10"><CheckCircle2 className="h-5 w-5 text-success" /></div><div><p className="text-2xl font-bold text-foreground">{stats.devolvidos}</p><p className="text-xs text-muted-foreground">Devolvidos</p></div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1.4fr)_180px_1fr_1fr_1fr]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Patrimonio completo, numeros, bem, sala ou responsavel..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="atrasado">Atrasados</SelectItem>
              <SelectItem value="devolvido">Devolvidos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={secretariaFilter} onValueChange={(v) => { setSecretariaFilter(v); setDepartamentoFilter("todos"); setSalaFilter("todos"); setPage(1) }}>
            <SelectTrigger><SelectValue placeholder="Todas as secretarias" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as secretarias</SelectItem>
              {secretarias.map((sec: any) => (
                <SelectItem key={sec.nome} value={sec.nome}>{sec.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SearchableSelect
            value={departamentoFilter}
            onValueChange={(v) => { setDepartamentoFilter(v || "todos"); setSalaFilter("todos"); setPage(1) }}
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
          <SearchableSelect
            value={salaFilter}
            onValueChange={(v) => { setSalaFilter(v || "todos"); setPage(1) }}
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
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bem / Patrimonio</TableHead>
                <TableHead className="hidden md:table-cell">Origem</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead className="hidden lg:table-cell">Data Emprestimo</TableHead>
                <TableHead className="hidden lg:table-cell">Devolucao Prevista</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.map((loan) => (
                <TableRow key={loan.id} className="cursor-pointer" onClick={() => openDetails(loan)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-md border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {loan.assetImagem ? (
                          <img 
                            src={loan.assetImagem} 
                            alt={loan.assetDescricao}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground/50" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{loan.assetDescricao}</p>
                        <p className="text-xs text-muted-foreground font-mono">{loan.patrimonio}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="text-sm">
                      <p className="text-muted-foreground">{loan.origem?.secretaria?.replace("Secretaria de ", "Sec. ")}</p>
                      <p className="text-xs text-muted-foreground/70">{loan.origem?.departamento}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="flex items-center gap-1">
                        <ArrowRight className="h-3 w-3 text-primary shrink-0 hidden md:inline-block" />
                        <p className="text-foreground font-medium">{loan.destino?.secretaria?.replace("Secretaria de ", "Sec. ")}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{loan.destino?.departamento}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(loan.dataEmprestimo)}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    <span className={loan.status === "atrasado" ? "text-destructive font-medium" : "text-muted-foreground"}>{formatDate(loan.dataPrevistaDevolucao)}</span>
                  </TableCell>
                  <TableCell><Badge className={getLoanStatusColor(loan.status)}>{getLoanStatusLabel(loan.status)}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Imprimir Termo" onClick={(e) => { e.stopPropagation(); window.open(`/emprestimos/${loan.id}/termo`, "_blank"); }}>
                        <Printer className="h-4 w-4" />
                      </Button>
                      {(loan.status === "ativo" || loan.status === "atrasado") && (
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openDevolucao(loan); }}>
                          <Undo2 className="mr-1.5 h-3.5 w-3.5" />Devolver
                        </Button>
                      )}
                      {loan.status === "devolvido" && (
                        <span className="text-xs text-muted-foreground">{loan.dataDevolucao ? formatDate(loan.dataDevolucao) : "-"}</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {loans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Repeat2 className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    Nenhum emprestimo encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {meta.totalPages > 1 && (
        <div className="flex justify-center mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => {
                 // Show first, last, current, and surrounding pages
                 if (
                   p === 1 ||
                   p === meta.totalPages ||
                   (p >= page - 1 && p <= page + 1)
                 ) {
                   return (
                     <PaginationItem key={p}>
                       <PaginationLink
                         isActive={page === p}
                         onClick={() => setPage(p)}
                         className="cursor-pointer"
                       >
                         {p}
                       </PaginationLink>
                     </PaginationItem>
                   )
                 }
                 
                 // Show ellipsis
                 if (
                   (p === page - 2 && p > 1) ||
                   (p === page + 2 && p < meta.totalPages)
                 ) {
                   return (
                     <PaginationItem key={p}>
                       <PaginationEllipsis />
                     </PaginationItem>
                   )
                 }
                 
                 return null
              })}

              <PaginationItem>
                <PaginationNext 
                  onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                  className={page === meta.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* New Loan Dialog */}
      <Dialog open={newLoanOpen} onOpenChange={setNewLoanOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
          <div className="p-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle>Novo Emprestimo</DialogTitle>
              <DialogDescription>Registre o emprestimo de um equipamento para outra secretaria ou departamento</DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label required className={fieldErrors.includes("formAssetId") ? "text-destructive" : ""}>Bem Patrimonial</Label>
                <SearchableSelect
                value={formAssetId}
                onValueChange={(v) => {
                    setFormAssetId(v)
                    if (fieldErrors.includes("formAssetId")) setFieldErrors(prev => prev.filter(e => e !== "formAssetId"))
                }}
                items={availableAssets.map((a: any) => ({
                  value: a.id,
                  label: `${a.patrimonio} - ${a.descricao}`,
                  searchTerms: `${a.patrimonio} ${a.descricao}`,
                }))}
                placeholder="Selecione o bem a ser emprestado"
                searchPlaceholder="Buscar por nome ou patrimônio..."
                className={fieldErrors.includes("formAssetId") ? "border-destructive ring-offset-destructive" : ""}
              />
            </div>
            {selectedAsset && (
              <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Localizacao Atual (Origem)</p>
                <p className="text-sm font-medium text-foreground break-words">{selectedAsset.descricao}</p>
                <p className="text-xs font-mono text-muted-foreground">{selectedAsset.patrimonio}</p>
                <p className="text-sm text-foreground break-words">{selectedAsset.localizacao?.secretaria} {" > "} {selectedAsset.localizacao?.departamento} {" > "} {selectedAsset.localizacao?.sala}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5" required><Building2 className="h-4 w-4 text-primary" />Destino</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className={`text-xs text-muted-foreground ${fieldErrors.includes("formDestinoSec") ? "text-destructive" : ""}`} required>Secretaria</Label>
                  <Select value={formDestinoSec} onValueChange={(v) => { 
                      setFormDestinoSec(v); setFormDestinoDep(""); setFormDestinoSala(""); 
                      if (fieldErrors.includes("formDestinoSec")) setFieldErrors(prev => prev.filter(e => e !== "formDestinoSec"))
                  }}>
                    <SelectTrigger className={fieldErrors.includes("formDestinoSec") ? "border-destructive ring-offset-destructive" : ""}><SelectValue placeholder="Secretaria" /></SelectTrigger>
                    <SelectContent>{secretarias.map((s: any) => (<SelectItem key={s.nome} value={s.nome}>{s.nome}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className={`text-xs text-muted-foreground ${fieldErrors.includes("formDestinoDep") ? "text-destructive" : ""}`} required>Departamento</Label>
                  <SearchableSelect
                    value={formDestinoDep}
                    onValueChange={(v) => {
                      setFormDestinoDep(v)
                      setFormDestinoSala("")
                      if (fieldErrors.includes("formDestinoDep")) setFieldErrors(prev => prev.filter(e => e !== "formDestinoDep"))
                    }}
                    items={destinoDeptos.map((d: any) => ({
                      value: d.nome,
                      label: d.nome,
                      searchTerms: d.nome,
                    }))}
                    placeholder="Departamento"
                    searchPlaceholder="Buscar departamento..."
                    className={fieldErrors.includes("formDestinoDep") ? "border-destructive ring-offset-destructive" : ""}
                  />
                </div>
                <div className="space-y-1">
                  <Label className={`text-xs text-muted-foreground ${fieldErrors.includes("formDestinoSala") ? "text-destructive" : ""}`} required>Sala</Label>
                  <SearchableSelect
                    value={formDestinoSala}
                    onValueChange={(v) => {
                        setFormDestinoSala(v)
                        if (fieldErrors.includes("formDestinoSala")) setFieldErrors(prev => prev.filter(e => e !== "formDestinoSala"))
                    }}
                    items={destinoSalas.map((s: any) => {
                      const label = typeof s === "string" ? s : s.nome
                      return {
                        value: label,
                        label: label,
                        searchTerms: label,
                      }
                    })}
                    placeholder="Sala"
                    searchPlaceholder="Buscar sala..."
                    className={fieldErrors.includes("formDestinoSala") ? "border-destructive ring-offset-destructive" : ""}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label required className={fieldErrors.includes("formResponsavelEmprestimo") ? "text-destructive" : ""}>Responsavel pelo Emprestimo</Label>
                <ResponsavelSelect 
                  value={formResponsavelEmprestimo} 
                  onValueChange={(v) => {
                      setFormResponsavelEmprestimo(v)
                      if (fieldErrors.includes("formResponsavelEmprestimo")) setFieldErrors(prev => prev.filter(e => e !== "formResponsavelEmprestimo"))
                  }}
                  placeholder="Selecione quem autoriza"
                  className={fieldErrors.includes("formResponsavelEmprestimo") ? "border-destructive ring-offset-destructive" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label required className={fieldErrors.includes("formResponsavelRecebimento") ? "text-destructive" : ""}>Responsavel pelo Recebimento</Label>
                <ResponsavelSelect 
                  value={formResponsavelRecebimento} 
                  onValueChange={(v) => {
                      setFormResponsavelRecebimento(v)
                      if (fieldErrors.includes("formResponsavelRecebimento")) setFieldErrors(prev => prev.filter(e => e !== "formResponsavelRecebimento"))
                  }}
                  placeholder="Selecione quem recebe"
                  className={fieldErrors.includes("formResponsavelRecebimento") ? "border-destructive ring-offset-destructive" : ""}
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>Solicitante / Retirado por</Label>
                <ResponsavelSelect 
                  value={formSolicitante} 
                  onValueChange={setFormSolicitante} 
                  placeholder="Selecione quem retirou"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label required>Data do Emprestimo</Label><DatePicker date={formDataEmprestimo} setDate={setFormDataEmprestimo} /></div>
              <div className="space-y-2">
                  <Label className={fieldErrors.includes("formDataPrevista") ? "text-destructive" : ""}>Data Prevista de Devolucao</Label>
                  <DatePicker 
                    date={semDataPrevista ? undefined : formDataPrevista} 
                    setDate={(d) => {
                        setSemDataPrevista(false)
                        setFormDataPrevista(d)
                        if (fieldErrors.includes("formDataPrevista")) setFieldErrors(prev => prev.filter(e => e !== "formDataPrevista"))
                    }} 
                    disabled={semDataPrevista}
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={semDataPrevista} onChange={(e) => {
                      setSemDataPrevista(e.target.checked)
                      if (e.target.checked) setFormDataPrevista(undefined)
                      setFieldErrors(prev => prev.filter(error => error !== "formDataPrevista"))
                    }} />
                    Devolucao sem data definida
                  </label>
              </div>
            </div>
            <div className="space-y-2">
                <Label required className={fieldErrors.includes("formMotivo") ? "text-destructive" : ""}>Motivo do Emprestimo</Label>
                <Textarea 
                    placeholder="Descreva o motivo do emprestimo..." 
                    value={formMotivo} 
                    onChange={(e) => {
                        setFormMotivo(e.target.value)
                        if (fieldErrors.includes("formMotivo")) setFieldErrors(prev => prev.filter(e => e !== "formMotivo"))
                    }} 
                    rows={2} 
                    className={fieldErrors.includes("formMotivo") ? "border-destructive focus-visible:ring-destructive" : ""}
                />
            </div>
            <div className="space-y-2"><Label>Observacoes (opcional)</Label><Textarea placeholder="Observacoes adicionais..." value={formObservacoes} onChange={(e) => setFormObservacoes(e.target.value)} rows={2} /></div>
            <label className="flex items-start gap-3 rounded-lg border bg-primary/5 p-3 text-sm cursor-pointer">
              <input type="checkbox" checked={exigirTermo} onChange={(e) => setExigirTermo(e.target.checked)} className="mt-1 h-4 w-4" />
              <span><strong>Gerar termo de responsabilidade</strong><span className="block text-xs text-muted-foreground">O PDF terá o timbre configurado e ficará aguardando o upload do documento assinado.</span></span>
            </label>
          </div>
          </div>

          <div className="p-4 border-t bg-background mt-auto z-10">
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewLoanOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateLoan} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar Emprestimo
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Devolucao Dialog */}
      <Dialog open={devolucaoOpen} onOpenChange={setDevolucaoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Devolucao</DialogTitle>
            <DialogDescription>Registre a devolucao de <strong>{selectedLoan?.assetDescricao}</strong> ({selectedLoan?.patrimonio})</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedLoan && (
              <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Emprestado de <strong>{selectedLoan.origem?.departamento}</strong></p>
                <p className="text-xs text-muted-foreground">Para <strong>{selectedLoan.destino?.departamento}</strong></p>
                <p className="text-xs text-muted-foreground">Desde {formatDate(selectedLoan.dataEmprestimo)} - Previsto: {formatDate(selectedLoan.dataPrevistaDevolucao)}</p>
              </div>
            )}
            <div className="space-y-2"><Label required>Data da Devolucao</Label><DatePicker date={formDataDevolucao} setDate={setFormDataDevolucao} /></div>
            <div className="space-y-2"><Label>Observacoes (opcional)</Label><Textarea placeholder="Observacoes sobre a devolucao..." value={formObsDevolucao} onChange={(e) => setFormObsDevolucao(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDevolucaoOpen(false)}>Cancelar</Button>
            <Button onClick={handleDevolucao} disabled={saving || !formDataDevolucao}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirmar Devolucao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Emprestimo</DialogTitle>
            <DialogDescription className="sr-only">Detalhes do empréstimo selecionado.</DialogDescription>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4 py-2">
              {/* Image Banner */}
              <div className="flex justify-center rounded-lg border bg-muted/30 p-2">
                 {selectedLoan.assetImagem ? (
                   <img 
                     src={selectedLoan.assetImagem} 
                     alt={selectedLoan.assetDescricao}
                     className="max-h-[200px] w-auto rounded-md object-contain"
                   />
                 ) : (
                   <div className="flex flex-col items-center justify-center py-6 text-muted-foreground/50">
                     <ImageIcon className="h-10 w-10 mb-2" />
                     <p className="text-xs">Sem foto</p>
                   </div>
                 )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{selectedLoan.assetDescricao}</p>
                  <p className="text-sm font-mono text-muted-foreground">{selectedLoan.patrimonio}</p>
                </div>
                <Badge className={getLoanStatusColor(selectedLoan.status)}>{getLoanStatusLabel(selectedLoan.status)}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Origem</p>
                  <p className="text-sm text-foreground">{selectedLoan.origem?.secretaria}</p>
                  <p className="text-xs text-muted-foreground">{selectedLoan.origem?.departamento} - {selectedLoan.origem?.sala}</p>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Destino</p>
                  <p className="text-sm text-foreground">{selectedLoan.destino?.secretaria}</p>
                  <p className="text-xs text-muted-foreground">{selectedLoan.destino?.departamento} - {selectedLoan.destino?.sala}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">Responsavel Emprestimo</p><p className="text-sm font-medium">{selectedLoan.responsavelEmprestimo}</p></div>
                <div><p className="text-xs text-muted-foreground">Responsavel Recebimento</p><p className="text-sm font-medium">{selectedLoan.responsavelRecebimento}</p></div>
                {selectedLoan.solicitante && (
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Solicitante / Retirado por</p><p className="text-sm font-medium">{selectedLoan.solicitante}</p></div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><p className="text-xs text-muted-foreground">Data Emprestimo</p><p className="text-sm font-medium">{formatDate(selectedLoan.dataEmprestimo)}</p></div>
                <div><p className="text-xs text-muted-foreground">Devolucao Prevista</p><p className={`text-sm font-medium ${selectedLoan.status === "atrasado" ? "text-destructive" : ""}`}>{formatDate(selectedLoan.dataPrevistaDevolucao)}</p></div>
                <div><p className="text-xs text-muted-foreground">Devolucao Real</p><p className="text-sm font-medium">{selectedLoan.dataDevolucao ? formatDate(selectedLoan.dataDevolucao) : "-"}</p></div>
              </div>
              <div><p className="text-xs text-muted-foreground">Motivo</p><p className="text-sm">{selectedLoan.motivo}</p></div>
              {selectedLoan.observacoes && (<div><p className="text-xs text-muted-foreground">Observacoes</p><p className="text-sm">{selectedLoan.observacoes}</p></div>)}
              {selectedLoan.termo && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Termo de responsabilidade</p>
                  <p className="text-sm font-medium">{selectedLoan.termo.status === "assinado" ? "Assinado e anexado" : "Aguardando assinatura"}</p>
                  {selectedLoan.termo.assinadoEm && <p className="text-xs text-muted-foreground">Anexado em {formatDate(selectedLoan.termo.assinadoEm)}</p>}
                  {selectedLoan.termo.arquivoAssinado && <a href={selectedLoan.termo.arquivoAssinado} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary underline">Abrir documento assinado</a>}
                </div>
              )}
              {(selectedLoan.status === "ativo" || selectedLoan.status === "atrasado") && (
                <div className="pt-2 flex gap-2">
                  <Button className="flex-1" onClick={() => { setDetailsOpen(false); openDevolucao(selectedLoan); }}>
                    <Undo2 className="mr-2 h-4 w-4" />Registrar Devolucao
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => window.open(`/emprestimos/${selectedLoan.id}/termo`, "_blank")}>
                    <Printer className="mr-2 h-4 w-4" />Imprimir Termo
                  </Button>
                </div>
              )}
              {selectedLoan.status === "devolvido" && (
                <div className="pt-2">
                  <Button variant="outline" className="w-full" onClick={() => window.open(`/emprestimos/${selectedLoan.id}/termo`, "_blank")}>
                    <Printer className="mr-2 h-4 w-4" />Imprimir Termo
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
