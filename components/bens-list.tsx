"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Filter,
  Eye,
  Edit,
  ArrowRightLeft,
  Clock,
  CheckCircle2,
  MapPin,
  User,
  Tag,
  Calendar,
  DollarSign,
  Save,
  Upload,
  ImageIcon,
  X,
  Loader2,
  Trash2,
  Copy,
  Download,
  Send,
} from "lucide-react"
import {
  getStatusLabel,
  getStatusColor,
  getCategoryLabel,
  getEtiquetaStatusColor,
  getEtiquetaStatusLabel,
  formatCurrency,
  formatDate,
} from "@/lib/data"
import { api, getApiErrorMessage, isApiError } from "@/lib/api-client"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/components/ui/use-toast"
import { GroupSelector } from "@/components/group-selector"
import { MarcaSelector } from "@/components/marca-selector"
import { FornecedorSelector } from "@/components/fornecedor-selector"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Checkbox } from "@/components/ui/checkbox"

export function BensList() {
  const { toast } = useToast()
  const { user, hasPermission } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Fetch locations for edit/duplicate form
  const { data: locationsResult } = useSWR("/secretarias?all=true", () => api.getSecretarias("all=true"))
  const secretariasList = (Array.isArray(locationsResult) ? locationsResult : (locationsResult?.data || []))

  // Fetch categories dynamically
  const { data: categoriasResult } = useSWR("/categorias?all=true", () => api.getCategorias("all=true"))
  const categoriasList = (Array.isArray(categoriasResult) ? categoriasResult : (categoriasResult?.data || []))

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [bulkDeleteReason, setBulkDeleteReason] = useState("")
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [workflowLoadingId, setWorkflowLoadingId] = useState<string | null>(null)

  const [search, setSearch] = useState(searchParams.get("busca") || "")
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "todos")
  const [grupoFilter, setGrupoFilter] = useState<string>(searchParams.get("grupo") || "")
  const [categoriaFilter, setCategoriaFilter] = useState<string>(searchParams.get("categoria") || "todos")
  const [tipoFilter, setTipoFilter] = useState<string>(searchParams.get("tipo") || "todos")
  const [warrantyFilter, setWarrantyFilter] = useState<string>(searchParams.get("em_garantia") === "true" ? "em_garantia" : searchParams.get("em_garantia") === "false" ? "fora_garantia" : "todos")
  const [emendaFilter, setEmendaFilter] = useState<string>(searchParams.get("emenda") || "")
  
  // Location filters from URL (sidebar navigation)
  const [secretariaFilter, setSecretariaFilter] = useState<string>(searchParams.get("secretaria") || "")
  const [departamentoFilter, setDepartamentoFilter] = useState<string>(searchParams.get("departamento") || "")
  const [salaFilter, setSalaFilter] = useState<string>(searchParams.get("sala") || "")

  const [selectedAsset, setSelectedAsset] = useState<any | null>(null)
  
  // Update filters when URL params change (e.g. from global search or sidebar)
  useEffect(() => {
    const busca = searchParams.get("busca") || ""
    if (busca !== search) setSearch(busca)
    
    const status = searchParams.get("status") || "todos"
    if (status !== statusFilter) setStatusFilter(status)

    const grupo = searchParams.get("grupo") || ""
    if (grupo !== grupoFilter) setGrupoFilter(grupo)

    const categoria = searchParams.get("categoria") || "todos"
    if (categoria !== categoriaFilter) setCategoriaFilter(categoria)

    const tipo = searchParams.get("tipo") || "todos"
    if (tipo !== tipoFilter) setTipoFilter(tipo)

    const garantia = searchParams.get("em_garantia")
    if (garantia === "true") setWarrantyFilter("em_garantia")
    else if (garantia === "false") setWarrantyFilter("fora_garantia")
    else setWarrantyFilter("todos")

    const emenda = searchParams.get("emenda") || ""
    if (emenda !== emendaFilter) setEmendaFilter(emenda)

    const sec = searchParams.get("secretaria") || ""
    if (sec !== secretariaFilter) setSecretariaFilter(sec)

    const dep = searchParams.get("departamento") || ""
    if (dep !== departamentoFilter) setDepartamentoFilter(dep)

    const sala = searchParams.get("sala") || ""
    if (sala !== salaFilter) setSalaFilter(sala)
  }, [searchParams])

  const [showEditDialog, setShowEditDialog] = useState(false)
  const [isCloning, setIsCloning] = useState(false)
  const [patrimonioGeneratedBySystem, setPatrimonioGeneratedBySystem] = useState(false)
  const [editForm, setEditForm] = useState({
    patrimonio: "",
    descricao: "",
    categoria: "",
    grupo: "",
    status: "",
    marca: "",
    modelo: "",
    valor: "",
    imagem: null as string | null,
    notaFiscal: null as string | null,
    motivo_baixa: "",
    tempo_garantia: "",
    numero_serie: "",
    fornecedor: "",
    secretaria: "",
    departamento: "",
    sala: "",
    dataAquisicao: "",
    observacoes: "",
    emendaParlamentar: "",
  })
  
  // Logic for location filtering in edit form
  const selectedSec = secretariasList.find((s: any) => s.nome === editForm.secretaria)
  const departamentosList = selectedSec?.departamentos || []
  const selectedDep = departamentosList.find((d: any) => d.nome === editForm.departamento)
  const salasList = selectedDep?.salas || []

  // Logic for location filtering in search filters
  const availableDepartamentos = useMemo(() => {
    if (secretariaFilter) {
      const sec = secretariasList.find((s: any) => s.nome === secretariaFilter);
      return sec?.departamentos || [];
    }
    return secretariasList.flatMap((s: any) => s.departamentos || []);
  }, [secretariasList, secretariaFilter]);

  const availableSalas = useMemo(() => {
    if (departamentoFilter) {
      const dep = availableDepartamentos.find((d: any) => d.nome === departamentoFilter);
      return dep?.salas || [];
    }
    return availableDepartamentos.flatMap((d: any) => d.salas || []);
  }, [availableDepartamentos, departamentoFilter]);

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)

  const formatCurrencyInput = (value: string) => {
    const onlyDigits = value.replace(/\D/g, "")
    if (onlyDigits === "") return ""
    const numberValue = Number(onlyDigits) / 100
    return numberValue.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  const parseCurrencyInput = (value: string) => {
    return Number(value.replace(/\D/g, "")) / 100
  }
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<any>(null)
  const [deleteReason, setDeleteReason] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  // Construct query params
  const queryParams = new URLSearchParams()
  queryParams.set("page", page.toString())
  queryParams.set("limit", limit.toString())
  if (search) queryParams.set("busca", search)
  if (statusFilter !== "todos") queryParams.set("status", statusFilter)
  if (grupoFilter) queryParams.set("grupo", grupoFilter)
  if (categoriaFilter !== "todos") queryParams.set("categoria", categoriaFilter)
  if (tipoFilter !== "todos") queryParams.set("tipo", tipoFilter)
  if (warrantyFilter !== "todos") queryParams.set("em_garantia", warrantyFilter === "em_garantia" ? "true" : "false")
  if (emendaFilter) queryParams.set("emenda", emendaFilter)
  if (secretariaFilter) queryParams.set("secretaria", secretariaFilter)
  if (departamentoFilter) queryParams.set("departamento", departamentoFilter)
  if (salaFilter) queryParams.set("sala", salaFilter)

  const { data: result, isLoading, mutate } = useSWR(
    ["bens-list", queryParams.toString()], 
    () => api.getBens(queryParams.toString()),
    { keepPreviousData: true }
  )
  
  const bens = result?.data || []
  const meta = result?.meta || { total: 0, page: 1, limit: 20, totalPages: 1 }

  // Fetch movements for selected asset only
  const { data: movementsResult } = useSWR(
    selectedAsset ? ["movimentacoes", selectedAsset.id] : null, 
    () => api.getMovimentacoes(`bem_id=${selectedAsset.id}&limit=100`)
  )
  const assetMovements = movementsResult?.data || []

  const handleGenerateProvisional = async () => {
    try {
      let year = new Date().getFullYear().toString()
      
      // Tenta usar o ano da data de aquisicao se disponivel
      if (editForm.dataAquisicao) {
        const date = new Date(editForm.dataAquisicao)
        if (!isNaN(date.getTime())) {
          year = date.getFullYear().toString()
        }
      }

      const response = await api.get(`/etiquetas-provisorias/next-sequence?ano=${year}`)
      if (response && response.formatted) {
        setEditForm(prev => ({ ...prev, patrimonio: response.formatted }))
        setPatrimonioGeneratedBySystem(true)
        toast({
          title: "Patrimônio Gerado",
          description: `Novo código provisório: ${response.formatted}`,
        })
      }
    } catch (error) {
      console.error("Erro ao gerar provisório:", error)
      toast({
        title: "Erro",
        description: "Não foi possível gerar o código provisório.",
        variant: "destructive",
      })
    }
  }

  const handleEditClick = (asset: any) => {
    setIsCloning(false)
    setPatrimonioGeneratedBySystem(false)
    setSelectedAsset(asset)
    setEditForm({
      patrimonio: asset.patrimonio,
      descricao: asset.descricao,
      categoria: asset.categoria,
      grupo: asset.grupo || "",
      status: asset.status,
      marca: asset.marca || "",
      modelo: asset.modelo || "",
      valor: asset.valor ? asset.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "",
      imagem: asset.imagem || null,
      notaFiscal: asset.notaFiscal || null,
      motivo_baixa: asset.motivo_baixa || "",
      tempo_garantia: asset.tempoGarantia ? String(asset.tempoGarantia) : "",
      numero_serie: asset.numeroSerie || asset.numero_serie || "",
      fornecedor: asset.fornecedor || "",
      secretaria: asset.localizacao?.secretaria || "",
      departamento: asset.localizacao?.departamento || "",
      sala: asset.localizacao?.sala || "",
      dataAquisicao: asset.dataAquisicao || "",
      observacoes: asset.observacoes || "",
      emendaParlamentar: asset.emendaParlamentar || "",
    })
    setShowEditDialog(true)
  }

  const handleDuplicateClick = (asset: any) => {
    setIsCloning(true)
    setPatrimonioGeneratedBySystem(false)
    setSelectedAsset(asset)
    setEditForm({
      patrimonio: "", // Clear patrimonio for new asset
      descricao: asset.descricao, // Keep description
      categoria: asset.categoria,
      grupo: asset.grupo || "",
      status: "ativo", // Reset status to active
      marca: asset.marca || "",
      modelo: asset.modelo || "",
      valor: asset.valor ? asset.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "",
      imagem: asset.imagem || null,
      notaFiscal: asset.notaFiscal || null,
      motivo_baixa: "",
      tempo_garantia: asset.tempoGarantia ? String(asset.tempoGarantia) : "",
      numero_serie: "", // Clear serial number
      fornecedor: asset.fornecedor || "",
      secretaria: asset.localizacao?.secretaria || "",
      departamento: asset.localizacao?.departamento || "",
      sala: asset.localizacao?.sala || "",
      dataAquisicao: asset.dataAquisicao || "",
      observacoes: asset.observacoes || "",
      emendaParlamentar: asset.emendaParlamentar || "",
    })
    setShowEditDialog(true)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setEditForm(prev => ({ ...prev, imagem: ev.target?.result as string }))
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== "application/pdf") {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo PDF.",
        variant: "destructive",
      })
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setEditForm(prev => ({ ...prev, notaFiscal: ev.target?.result as string }))
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleSaveEdit = async () => {
    if (!selectedAsset) return
    const patrimonioDigitado = editForm.patrimonio.trim()
    
    // Validation
    if (!editForm.descricao.trim()) {
      toast({
        title: "Erro de validação",
        description: "A descrição do bem não pode ficar vazia.",
        variant: "destructive",
      })
      return
    }

    if (!editForm.categoria) {
      toast({
        title: "Erro de validação",
        description: "Selecione uma categoria.",
        variant: "destructive",
      })
      return
    }

    if (!isCloning && !patrimonioDigitado) {
      toast({
        title: "Erro de validação",
        description: "Informe um número de patrimônio para salvar o bem.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      if (isCloning) {
        // If patrimonio is empty, generate a provisional one automatically
        let finalPatrimonio = patrimonioDigitado;
        let finalPatrimonioTipo = patrimonioDigitado
          ? (patrimonioDigitado.startsWith("PROV-") || patrimonioDigitado.includes("AUTO") ? "provisorio" : "definitivo")
          : "provisorio";
        let patrimonioAutoGerado = patrimonioGeneratedBySystem

        if (!finalPatrimonio) {
            // Generate provisional code
            let year = new Date().getFullYear().toString()
            if (editForm.dataAquisicao) {
                const date = new Date(editForm.dataAquisicao)
                if (!isNaN(date.getTime())) {
                    year = date.getFullYear().toString()
                }
            }
            
            try {
                const response = await api.get(`/etiquetas-provisorias/next-sequence?ano=${year}`)
                if (response && response.formatted) {
                    finalPatrimonio = response.formatted;
                    patrimonioAutoGerado = true
                } else {
                    throw new Error("Falha ao gerar sequencia provisoria");
                }
            } catch (err) {
                console.error("Erro ao gerar sequencia automatica na duplicacao:", err);
                toast({
                    title: "Erro",
                    description: "Nao foi possivel gerar o codigo provisorio automatico.",
                    variant: "destructive"
                });
                setSaving(false);
                return;
            }
        } else {
          // Check if user manually typed a patrimonio that already exists
          try {
             // We use a specific check for existence before trying to create
             const checkRes = await api.getBens(`patrimonio=${finalPatrimonio}`);
             if (checkRes && checkRes.data && checkRes.data.length > 0) {
                 toast({
                    title: "Patrimônio Já Existe",
                    description: "Este número de patrimônio já está cadastrado no sistema. Por favor, verifique se digitou corretamente ou utilize um outro número.",
                    variant: "destructive",
                    duration: 5000
                 });
                 setSaving(false);
                 return;
             }
          } catch (e) {
             // If check fails, we proceed and let the backend validation catch it
             console.log("Pre-check failed, relying on backend validation", e);
          }
        }

        // Create new asset
        await api.createBem({
          descricao: editForm.descricao,
          categoria: editForm.categoria,
          grupo: editForm.grupo,
          status: editForm.status,
          marca: editForm.marca,
          modelo: editForm.modelo,
          valor: parseCurrencyInput(editForm.valor),
          imagem: editForm.imagem,
          notaFiscal: editForm.notaFiscal,
          tempoGarantia: editForm.tempo_garantia ? parseInt(editForm.tempo_garantia) : undefined,
          numeroSerie: editForm.numero_serie,
          fornecedor: editForm.fornecedor,
          localizacao: {
            secretaria: editForm.secretaria,
            departamento: editForm.departamento,
            sala: editForm.sala
          },
          responsavel: selectedAsset.responsavel, // Inherit responsible
          dataAquisicao: editForm.dataAquisicao || new Date().toISOString().split('T')[0],
          observacoes: editForm.observacoes,
          patrimonioTipo: finalPatrimonioTipo,
          patrimonio: finalPatrimonio,
          emendaParlamentar: editForm.emendaParlamentar,
          patrimonioAutoGerado,
          ...(finalPatrimonioTipo === "provisorio" ? { patrimonioProvisorio: finalPatrimonio } : {})
        })
        
        toast({
            title: "Sucesso",
            description: `Bem duplicado com sucesso! Codigo: ${finalPatrimonio}`,
        })
      } else {
        // Update existing asset
        const isProvisional = patrimonioDigitado.startsWith("PROV-") || patrimonioDigitado.includes("AUTO");
        const isDefinitive = !isProvisional && patrimonioDigitado.length > 0;

        await api.updateBem(selectedAsset.id, {
          patrimonio: patrimonioDigitado,
          ...(isProvisional
            ? {
                patrimonioTipo: "provisorio",
                patrimonioProvisorio: patrimonioDigitado,
              }
            : {
                patrimonioTipo: "definitivo",
              }),
          descricao: editForm.descricao,
          categoria: editForm.categoria,
          grupo: editForm.grupo,
          status: editForm.status,
          marca: editForm.marca,
          modelo: editForm.modelo,
          valor: parseCurrencyInput(editForm.valor),
          imagem: editForm.imagem,
          notaFiscal: editForm.notaFiscal,
          motivo_baixa: editForm.status === "baixado" ? editForm.motivo_baixa : null,
          tempoGarantia: editForm.tempo_garantia ? parseInt(editForm.tempo_garantia) : null,
          numeroSerie: editForm.numero_serie,
          fornecedor: editForm.fornecedor,
          observacoes: editForm.observacoes,
          emendaParlamentar: editForm.emendaParlamentar,
          dataAquisicao: editForm.dataAquisicao || selectedAsset.dataAquisicao || null,
          responsavel: {
            nome: selectedAsset.responsavel?.nome || "",
            cargo: selectedAsset.responsavel?.cargo || "",
          },
          localizacao: {
            secretaria: editForm.secretaria,
            departamento: editForm.departamento,
            sala: editForm.sala,
          },
        })
      }

      setShowEditDialog(false)
      setSelectedAsset(null)
      setIsCloning(false)

      if (!isCloning) {
        toast({
          title: "Sucesso",
          description: "Bem atualizado com sucesso!",
        })
      }

      void mutate().catch((refreshError) => {
        console.error("Erro ao atualizar lista de bens apos salvar:", refreshError)
      })
      void globalMutate("/api/bens/grupos").catch((refreshError) => {
        console.error("Erro ao atualizar grupos apos salvar bem:", refreshError)
      })
    } catch (err: any) {
      console.error("Erro ao salvar bem:", err)
      toast({
        title: isApiError(err) && err.status === 409 ? "Patrimônio em uso" : "Erro ao salvar",
        description:
          isApiError(err) && err.status === 409 && err.body?.conflictingCode
            ? `O patrimônio ${err.body.conflictingCode} já está em uso. Ajuste o número informado para salvar.`
            : getApiErrorMessage(err, "Não foi possível salvar o bem. Tente novamente."),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (asset: any) => {
    setItemToDelete(asset)
    setDeleteReason("")
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!itemToDelete) return
    
    if (!deleteReason.trim()) {
        toast({
            title: "Erro de validação",
            description: "O motivo da exclusão é obrigatório.",
            variant: "destructive",
        })
        return
    }

    setIsDeleting(true)
    try {
      await api.deleteBem(itemToDelete.id, deleteReason)
      await mutate()
      
      toast({
        title: "Sucesso",
        description: "Bem excluído com sucesso!",
      })
      
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    } catch (err) {
      console.error("Erro ao excluir bem:", err)
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o bem. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEtiquetaWorkflow = async (
    asset: any,
    action: "marcar_enviada" | "reabrir_pendente"
  ) => {
    setWorkflowLoadingId(String(asset.id))
    try {
      await api.updateBemEtiquetaFluxo(asset.id, action)
      await mutate()

      if (selectedAsset?.id === asset.id) {
        const refreshedAsset = await api.getBem(asset.id)
        setSelectedAsset(refreshedAsset)
      }

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

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = bens.map((item: any) => item.id)
      setSelectedIds(allIds)
    } else {
      setSelectedIds([])
    }
  }

  const toggleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id])
    } else {
      setSelectedIds(prev => prev.filter(itemId => itemId !== id))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    
    if (!bulkDeleteReason.trim()) {
        toast({
            title: "Erro de validação",
            description: "O motivo da exclusão é obrigatório.",
            variant: "destructive",
        })
        return
    }

    setIsBulkDeleting(true)
    try {
      // Executa exclusão em paralelo para todos os itens selecionados
      await Promise.all(selectedIds.map(id => api.deleteBem(id, bulkDeleteReason)))
      
      await mutate()
      
      toast({
        title: "Sucesso",
        description: `${selectedIds.length} bens excluídos com sucesso!`,
      })
      
      setShowBulkDeleteDialog(false)
      setSelectedIds([])
      setBulkDeleteReason("")
    } catch (err) {
      console.error("Erro ao excluir bens em massa:", err)
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir alguns bens. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsBulkDeleting(false)
    }
  }

  /* Removed early return to prevent unmounting input
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  */

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">Bens Patrimoniais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {meta.total} bens encontrados
          </p>
        </div>
      </div>

      {(secretariaFilter || departamentoFilter || salaFilter) && (
        <div className="flex items-center gap-2 bg-accent/20 p-2 rounded-md border border-accent/50 text-sm">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="font-medium">Filtrado por:</span>
          {secretariaFilter && <Badge variant="outline" className="bg-background">{secretariaFilter}</Badge>}
          {departamentoFilter && (
            <>
              {secretariaFilter && <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />}
              <Badge variant="outline" className="bg-background">{departamentoFilter}</Badge>
            </>
          )}
          {salaFilter && (
            <>
              {(secretariaFilter || departamentoFilter) && <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />}
              <Badge variant="outline" className="bg-background">{salaFilter}</Badge>
            </>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 ml-auto text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSearch("")
              setStatusFilter("todos")
              setGrupoFilter("")
              setCategoriaFilter("todos")
              setTipoFilter("todos")
              setWarrantyFilter("todos")
              setEmendaFilter("")
              setSecretariaFilter("")
              setDepartamentoFilter("")
              setSalaFilter("")
              setPage(1)
              router.push("/bens")
            }}
          >
            <X className="h-3 w-3 mr-1" />
            Limpar Filtros
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por patrimonio, descricao, responsavel..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            
            {selectedIds.length > 0 && hasPermission("excluirBem") && (
              <Button 
                variant="destructive" 
                onClick={() => setShowBulkDeleteDialog(true)}
                className="gap-2 animate-in fade-in zoom-in duration-200"
              >
                <Trash2 className="h-4 w-4" />
                Excluir Selecionados ({selectedIds.length})
              </Button>
            )}

            <div className="flex flex-wrap gap-3">
              <div className="w-40">
                <GroupSelector
                  value={grupoFilter}
                  onValueChange={(v) => { setGrupoFilter(v); setPage(1); }}
                  placeholder="Filtrar Grupo"
                />
              </div>

              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="em_manutencao">Em Manutencao</SelectItem>
                  <SelectItem value="baixado">Baixado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoriaFilter} onValueChange={(v) => { setCategoriaFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas Categorias</SelectItem>
                  {categoriasList.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.slug}>
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={tipoFilter} onValueChange={(v) => { setTipoFilter(v); setPage(1); }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Tipo Patrimonio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  <SelectItem value="provisorio">Provisorio</SelectItem>
                  <SelectItem value="definitivo">Definitivo</SelectItem>
                </SelectContent>
              </Select>

              <Select value={warrantyFilter} onValueChange={(v) => { setWarrantyFilter(v); setPage(1); }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Garantia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas Garantias</SelectItem>
                  <SelectItem value="em_garantia">Em Garantia</SelectItem>
                  <SelectItem value="fora_garantia">Fora de Garantia</SelectItem>
                </SelectContent>
              </Select>

              <div className="w-56">
                <SearchableSelect
                  items={availableDepartamentos.map((d: any) => ({ value: d.nome, label: d.nome }))}
                  value={departamentoFilter}
                  onValueChange={(v) => { setDepartamentoFilter(v); setSalaFilter(""); setPage(1); }}
                  placeholder="Filtrar Departamento"
                />
              </div>

              <div className="w-56">
                <SearchableSelect
                  items={availableSalas.map((s: any) => ({ value: s.nome, label: s.nome }))}
                  value={salaFilter}
                  onValueChange={(v) => { setSalaFilter(v); setPage(1); }}
                  placeholder="Filtrar Sala"
                />
              </div>

              <div className="w-48">
                <Input 
                    placeholder="Filtrar Emenda..." 
                    value={emendaFilter}
                    onChange={(e) => { setEmendaFilter(e.target.value); setPage(1); }}
                    className="h-10"
                />
              </div>

              {(search || statusFilter !== "todos" || grupoFilter || categoriaFilter !== "todos" || tipoFilter !== "todos" || warrantyFilter !== "todos" || emendaFilter || secretariaFilter || departamentoFilter || salaFilter) ? (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearch("")
                    setStatusFilter("todos")
                    setGrupoFilter("")
                    setCategoriaFilter("todos")
                    setTipoFilter("todos")
                    setWarrantyFilter("todos")
                    setEmendaFilter("")
                    setSecretariaFilter("")
                    setDepartamentoFilter("")
                    setSalaFilter("")
                    setPage(1)
                    router.push("/bens")
                  }}
                  className="h-10 gap-2"
                >
                  <X className="h-4 w-4" />
                  Limpar Filtros
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading && bens.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox 
                      checked={bens.length > 0 && selectedIds.length === bens.length}
                      onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <TableHead className="w-[80px]">Foto</TableHead>
                  <TableHead>Patrimonio</TableHead>
                  <TableHead>Descricao</TableHead>
                  <TableHead className="hidden md:table-cell">Grupo</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden lg:table-cell">Localizacao</TableHead>
                  <TableHead className="hidden md:table-cell">Responsavel</TableHead>
                  <TableHead>Status</TableHead>
                  {statusFilter === "baixado" && <TableHead>Motivo da Baixa</TableHead>}
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bens.map((asset: any) => (
                  <TableRow key={asset.id} data-state={selectedIds.includes(asset.id) && "selected"}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.includes(asset.id)}
                        onCheckedChange={(checked) => toggleSelectOne(asset.id, !!checked)}
                        aria-label={`Selecionar ${asset.descricao}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="h-12 w-12 rounded-md border bg-muted flex items-center justify-center overflow-hidden">
                        {asset.imagem ? (
                          <img 
                            src={asset.imagem} 
                            alt={asset.descricao}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-mono font-medium">{asset.patrimonio}</span>
                        {asset.patrimonioTipo === "provisorio" && (
                          <Badge
                            variant="outline"
                            className="w-fit text-[10px] px-1.5 py-0 border-warning/50 text-warning"
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            Provisorio
                          </Badge>
                        )}
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
                      <Badge variant="outline" className="text-xs">
                        {asset.grupo || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="secondary" className="text-xs">
                        {getCategoryLabel(asset.categoria)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">
                          {asset.localizacao?.departamento}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {asset.localizacao?.sala}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm">{asset.responsavel?.nome}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge className={`text-xs ${getStatusColor(asset.status)}`}>
                          {getStatusLabel(asset.status)}
                        </Badge>
                        {asset.etiquetaStatus === "enviada" && (
                          <Badge variant="outline" className={`text-[10px] ${getEtiquetaStatusColor(asset.etiquetaStatus)}`}>
                            {getEtiquetaStatusLabel(asset.etiquetaStatus)}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {statusFilter === "baixado" && (
                      <TableCell>
                        <span className="text-sm text-muted-foreground truncate max-w-[200px] block" title={asset.motivo_baixa}>
                          {asset.motivo_baixa || "-"}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setSelectedAsset(asset)}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">Ver detalhes</span>
                        </Button>
                        {hasPermission("cadastrarBem") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => handleDuplicateClick(asset)}
                            title="Duplicar Bem"
                          >
                            <Copy className="h-4 w-4" />
                            <span className="sr-only">Duplicar Bem</span>
                          </Button>
                        )}
                        {hasPermission("atribuirPatrimonioDefinitivo") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => handleEditClick(asset)}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Editar bem</span>
                          </Button>
                        )}
                        {hasPermission("excluirBem") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteClick(asset)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Excluir bem</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {bens.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      Nenhum bem encontrado com os filtros selecionados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </div>
          )}
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

      {/* Asset Detail Dialog */}
      <Dialog open={!!selectedAsset && !showEditDialog} onOpenChange={(open) => !open && setSelectedAsset(null)}>
        <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0 gap-0">
          {selectedAsset && (
            <>
              <div className="p-6 pb-2">
                <DialogHeader>
                  <DialogTitle className="text-lg pr-8">{selectedAsset.descricao}</DialogTitle>
                  <DialogDescription className="sr-only">Detalhes do bem patrimonial</DialogDescription>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge className={`${getStatusColor(selectedAsset.status)} text-xs`}>
                      {getStatusLabel(selectedAsset.status)}
                    </Badge>
                    {selectedAsset.etiquetaStatus && (
                      <Badge variant="outline" className={`text-xs ${getEtiquetaStatusColor(selectedAsset.etiquetaStatus)}`}>
                        {getEtiquetaStatusLabel(selectedAsset.etiquetaStatus)}
                      </Badge>
                    )}
                  </div>
                </DialogHeader>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                <Tabs defaultValue="detalhes" className="w-full">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                    <TabsTrigger value="historico">Historico</TabsTrigger>
                  </TabsList>

                  <TabsContent value="detalhes" className="mt-4">
                    {/* Asset Image Banner */}
                    <div className="mb-6 rounded-lg border bg-muted/30 p-2 flex justify-center">
                      {selectedAsset.imagem ? (
                      <img 
                        src={selectedAsset.imagem} 
                        alt={selectedAsset.descricao}
                        className="max-h-[300px] w-auto rounded-md object-contain shadow-sm"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                        <ImageIcon className="h-16 w-16 mb-2" />
                        <p className="text-sm">Sem imagem cadastrada</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start gap-3">
                        <Tag className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Patrimonio</p>
                          <p className="text-sm font-mono font-semibold">{selectedAsset.patrimonio}</p>
                          {selectedAsset.patrimonioTipo === "provisorio" && (
                            <Badge variant="outline" className="mt-1 border-warning/50 text-warning text-[10px]">
                              <Clock className="h-3 w-3 mr-1" />
                              Aguardando definitivo
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Localizacao</p>
                          <p className="text-sm font-medium">{selectedAsset.localizacao?.secretaria}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedAsset.localizacao?.departamento} - {selectedAsset.localizacao?.sala}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Responsavel</p>
                          <p className="text-sm font-medium">{selectedAsset.responsavel?.nome}</p>
                          <p className="text-sm text-muted-foreground">{selectedAsset.responsavel?.cargo}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start gap-3">
                        <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Data de Aquisicao</p>
                          <p className="text-sm font-medium">{formatDate(selectedAsset.dataAquisicao)}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <DollarSign className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Valor</p>
                          <p className="text-sm font-medium">{formatCurrency(selectedAsset.valor)}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Garantia</p>
                          {selectedAsset.tempoGarantia ? (
                             <div className="flex flex-col">
                               <p className="text-sm font-medium">{selectedAsset.tempoGarantia} meses</p>
                               {selectedAsset.dataAquisicao && (
                                  <p className="text-xs text-muted-foreground">
                                    Vence em: {new Date(new Date(selectedAsset.dataAquisicao).setMonth(new Date(selectedAsset.dataAquisicao).getMonth() + selectedAsset.tempoGarantia)).toLocaleDateString('pt-BR')}
                                  </p>
                               )}
                             </div>
                          ) : (
                             <p className="text-sm font-medium">-</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Upload className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Nota Fiscal</p>
                          {selectedAsset.notaFiscal ? (
                             <a 
                                href={selectedAsset.notaFiscal} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                             >
                               <Download className="h-3 w-3" />
                               Baixar PDF
                             </a>
                          ) : (
                             <p className="text-sm font-medium text-muted-foreground">-</p>
                          )}
                        </div>
                      </div>
                      {selectedAsset.marca && (
                        <div className="flex items-start gap-3">
                          <Tag className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Marca / Modelo</p>
                            <p className="text-sm font-medium">{selectedAsset.marca} {selectedAsset.modelo}</p>
                          </div>
                        </div>
                      )}
                      {selectedAsset.numeroSerie && (
                        <div>
                          <p className="text-xs text-muted-foreground">Numero de Serie</p>
                          <p className="text-sm font-mono">{selectedAsset.numeroSerie}</p>
                        </div>
                      )}
                      {selectedAsset.estadoConservacao && (
                        <div>
                          <p className="text-xs text-muted-foreground">Conservacao</p>
                          <p className="text-sm font-medium">{selectedAsset.estadoConservacao}</p>
                        </div>
                      )}
                      {selectedAsset.emendaParlamentar && (
                        <div>
                          <p className="text-xs text-muted-foreground">Emenda Parlamentar</p>
                          <p className="text-sm font-medium">{selectedAsset.emendaParlamentar}</p>
                        </div>
                      )}
                      {selectedAsset.etiquetaStatus && (
                        <div>
                          <p className="text-xs text-muted-foreground">Fluxo da Etiqueta</p>
                          <div className="mt-1 space-y-1">
                            <Badge variant="outline" className={`text-[10px] ${getEtiquetaStatusColor(selectedAsset.etiquetaStatus)}`}>
                              {getEtiquetaStatusLabel(selectedAsset.etiquetaStatus)}
                            </Badge>
                            {selectedAsset.etiquetaEnviadaPor && (
                              <p className="text-xs text-muted-foreground">
                                Enviada por {selectedAsset.etiquetaEnviadaPor}
                                {selectedAsset.etiquetaEnviadaEm ? ` em ${formatDate(selectedAsset.etiquetaEnviadaEm)}` : ""}
                              </p>
                            )}
                            {selectedAsset.etiquetaColadaPor && (
                              <p className="text-xs text-muted-foreground">
                                Colagem confirmada por {selectedAsset.etiquetaColadaPor}
                                {selectedAsset.etiquetaColadaEm ? ` em ${formatDate(selectedAsset.etiquetaColadaEm)}` : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      {(user?.role === "gestor" || user?.role === "administrador") && selectedAsset.patrimonioTipo !== "provisorio" && !selectedAsset.etiquetaStatus && (
                        <div className="rounded-lg border border-info/30 bg-info/5 p-3">
                          <p className="text-xs text-muted-foreground">
                            Inicie este fluxo apenas quando a etiqueta for enviada para a unidade colar e confirmar.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 gap-2"
                            onClick={() => handleEtiquetaWorkflow(selectedAsset, "marcar_enviada")}
                            disabled={workflowLoadingId === String(selectedAsset.id)}
                          >
                            {workflowLoadingId === String(selectedAsset.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Enviar etiqueta para unidade
                          </Button>
                        </div>
                      )}
                      {(user?.role === "gestor" || user?.role === "administrador") && selectedAsset.etiquetaStatus && (
                        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground">
                            Se este bem nao depende mais da unidade, voce pode remover este fluxo de confirmacao.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 gap-2"
                            onClick={() => handleEtiquetaWorkflow(selectedAsset, "reabrir_pendente")}
                            disabled={workflowLoadingId === String(selectedAsset.id)}
                          >
                            {workflowLoadingId === String(selectedAsset.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                            Limpar fluxo de etiqueta
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedAsset.observacoes && (
                    <div className="mt-6">
                      <p className="text-xs text-muted-foreground mb-1">Observações</p>
                      <div className="rounded-md bg-muted/50 p-3 text-sm">
                        {selectedAsset.observacoes}
                      </div>
                    </div>
                  )}

                  {selectedAsset.patrimonioTipo === "provisorio" && hasPermission("atribuirPatrimonioDefinitivo") && (
                    <div className="mt-6 rounded-lg border border-warning/30 bg-warning/5 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-warning" />
                        <p className="text-sm font-semibold">Patrimonio Provisorio</p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Este bem esta com numero provisorio. Quando receber o patrimonio definitivo
                        da prefeitura, clique no botao abaixo para atualizar.
                      </p>
                      <Button size="sm" className="gap-2" onClick={() => handleEditClick(selectedAsset)}>
                        <CheckCircle2 className="h-4 w-4" />
                        Atribuir Patrimonio Definitivo
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="historico" className="mt-4">
                  {assetMovements.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {assetMovements.map((mov: any) => (
                        <div key={mov.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                          <ArrowRightLeft className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{mov.motivo}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {mov.de_departamento} ({mov.de_sala}) {"->"}  {mov.para_departamento} ({mov.para_sala})
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Por: {mov.responsavel} em {formatDate(mov.data_movimentacao)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-sm text-muted-foreground">
                      Nenhuma movimentacao registrada para este bem.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Asset Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        if (!open) { setShowEditDialog(false); }
      }}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
          <div className="p-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle>{isCloning ? "Duplicar Bem Patrimonial" : "Editar Bem Patrimonial"}</DialogTitle>
              <DialogDescription>
                {isCloning 
                  ? "Crie uma cópia deste bem. O número de patrimônio deve ser único." 
                  : "Faça as alterações necessárias nos dados do bem."}
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {selectedAsset && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-4">
                   
                   {/* Linha 1: Patrimonio e Descricao */}
                   <div className="grid grid-cols-12 gap-4">
                     <div className="col-span-12 md:col-span-5 flex flex-col gap-2">
                       <Label htmlFor="edit-patrimonio">Patrimonio</Label>
                       <div className="flex gap-2">
                         <Input 
                           id="edit-patrimonio" 
                           value={editForm.patrimonio} 
                           onChange={(e) => {
                             setEditForm({...editForm, patrimonio: e.target.value})
                             setPatrimonioGeneratedBySystem(false)
                           }}
                           placeholder={isCloning ? "Deixe vazio para gerar provisório automático" : "Informe o patrimônio do bem"}
                         />
                         <Button 
                           type="button" 
                           variant="outline" 
                           size="icon" 
                           onClick={handleGenerateProvisional}
                           title="Gerar Provisório"
                         >
                           <Clock className="h-4 w-4" />
                         </Button>
                       </div>
                       <p className="text-xs text-muted-foreground">
                         {isCloning
                           ? "Se deixar em branco, o sistema cria a cópia com patrimônio provisório automático. Se preencher, o número precisa ser único."
                           : "Você pode alterar o número do patrimônio, desde que ele não esteja em uso por outro bem."}
                       </p>
                     </div>
                     <div className="col-span-12 md:col-span-7 flex flex-col gap-2">
                       <Label htmlFor="edit-descricao">Descricao</Label>
                       <Input 
                         id="edit-descricao" 
                         value={editForm.descricao} 
                         onChange={(e) => setEditForm({...editForm, descricao: e.target.value})}
                       />
                     </div>
                   </div>
                   
                   {/* Linha 2: Marca e Modelo */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="flex flex-col gap-2">
                       <Label htmlFor="edit-marca">Marca</Label>
                       <MarcaSelector
                         value={editForm.marca}
                         onValueChange={(v) => setEditForm({...editForm, marca: v})}
                         placeholder="Selecione a marca"
                         className="w-full"
                       />
                     </div>
                     <div className="flex flex-col gap-2">
                       <Label htmlFor="edit-modelo">Modelo</Label>
                       <Input 
                         id="edit-modelo" 
                         value={editForm.modelo} 
                         onChange={(e) => setEditForm({...editForm, modelo: e.target.value})}
                       />
                     </div>
                   </div>

                   {/* Linha 3: Numero de Serie e Fornecedor */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="flex flex-col gap-2">
                       <Label htmlFor="edit-numero-serie">Numero de Serie</Label>
                       <Input 
                         id="edit-numero-serie" 
                         value={editForm.numero_serie} 
                         onChange={(e) => setEditForm({...editForm, numero_serie: e.target.value})}
                         placeholder="Numero de serie"
                       />
                     </div>
                     <div className="flex flex-col gap-2">
                       <Label htmlFor="edit-fornecedor">Fornecedor</Label>
                       <FornecedorSelector
                         value={editForm.fornecedor}
                         onValueChange={(v) => setEditForm({...editForm, fornecedor: v})}
                         placeholder="Selecione o fornecedor"
                         className="w-full"
                       />
                     </div>
                   </div>

                   {/* Linha 4: Valor e Garantia */}
                   <div className="grid grid-cols-2 gap-4">
                     <div className="flex flex-col gap-2">
                       <Label htmlFor="edit-valor">Valor</Label>
                       <Input 
                         id="edit-valor" 
                         value={editForm.valor} 
                         onChange={(e) => setEditForm({...editForm, valor: formatCurrencyInput(e.target.value)})}
                       />
                     </div>
                     <div className="flex flex-col gap-2">
                       <Label htmlFor="edit-garantia">Garantia (meses)</Label>
                       <Input 
                         id="edit-garantia" 
                         type="number"
                         value={editForm.tempo_garantia} 
                         onChange={(e) => setEditForm({...editForm, tempo_garantia: e.target.value})}
                       />
                     </div>
                   </div>

                   {/* Linha 5: Categoria e Grupo */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="flex flex-col gap-2">
                       <Label htmlFor="edit-categoria">Categoria</Label>
                       <Select 
                        value={editForm.categoria} 
                        onValueChange={(v) => setEditForm({...editForm, categoria: v})}
                      >
                        <SelectTrigger id="edit-categoria">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                           {categoriasList.map((cat: any) => (
                             <SelectItem key={cat.id} value={cat.slug}>
                               {cat.nome}
                             </SelectItem>
                           ))}
                        </SelectContent>
                      </Select>
                     </div>

                     <div className="flex flex-col gap-2">
                       <Label htmlFor="edit-grupo">Grupo</Label>
                       <GroupSelector
                         value={editForm.grupo}
                         onValueChange={(v) => setEditForm({...editForm, grupo: v})}
                         placeholder="Selecione ou crie um grupo"
                       />
                     </div>
                   </div>

                   {/* Linha 6: Status */}
                   <div className="flex flex-col gap-2">
                     <Label htmlFor="edit-status">Status</Label>
                     <Select 
                       value={editForm.status} 
                       onValueChange={(v) => setEditForm({...editForm, status: v})}
                     >
                       <SelectTrigger id="edit-status">
                         <SelectValue placeholder="Selecione" />
                       </SelectTrigger>
                       <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="em_manutencao">Em Manutencao</SelectItem>
                          <SelectItem value="baixado">Baixado</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                   
                   {editForm.status === "baixado" && (
                     <div className="flex flex-col gap-2 col-span-2">
                       <Label htmlFor="edit-motivo-baixa">Motivo da Baixa</Label>
                       <Input 
                         id="edit-motivo-baixa" 
                         value={editForm.motivo_baixa} 
                         onChange={(e) => setEditForm({...editForm, motivo_baixa: e.target.value})}
                         placeholder="Descreva o motivo da baixa..."
                       />
                     </div>
                   )}

                   {/* Linha 7: Observações e Emenda */}
                   <div className="flex flex-col gap-2 col-span-1 md:col-span-2">
                     <Label htmlFor="edit-observacoes">Observações</Label>
                     <Textarea
                       id="edit-observacoes"
                       value={editForm.observacoes}
                       onChange={(e) => setEditForm({...editForm, observacoes: e.target.value})}
                       placeholder="Observações adicionais..."
                       className="min-h-[80px]"
                     />
                   </div>
                   
                   <div className="flex flex-col gap-2 col-span-1 md:col-span-2">
                     <Label htmlFor="edit-emenda">Emenda Parlamentar</Label>
                     <Input
                       id="edit-emenda"
                       value={editForm.emendaParlamentar}
                       onChange={(e) => setEditForm({...editForm, emendaParlamentar: e.target.value})}
                       placeholder="Ex: Emenda nº 123/2025"
                     />
                   </div>

                   {/* Linha 8: Localização (Apenas na Duplicação) */}
                   {isCloning && (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                       <div className="flex flex-col gap-2 col-span-1 md:col-span-2">
                         <Label>Secretaria</Label>
                         <SearchableSelect
                           items={secretariasList.map((s: any) => ({ value: s.nome, label: s.nome }))}
                           value={editForm.secretaria}
                           onValueChange={(v) => setEditForm({ ...editForm, secretaria: v, departamento: "", sala: "" })}
                           placeholder="Selecione a secretaria"
                         />
                       </div>
                       <div className="flex flex-col gap-2 col-span-1">
                         <Label>Departamento</Label>
                         <SearchableSelect
                           items={departamentosList.map((d: any) => ({ value: d.nome, label: d.nome }))}
                           value={editForm.departamento}
                           onValueChange={(v) => setEditForm({ ...editForm, departamento: v, sala: "" })}
                           placeholder="Selecione o departamento"
                           disabled={!editForm.secretaria}
                         />
                       </div>
                       <div className="flex flex-col gap-2 col-span-1">
                         <Label>Sala</Label>
                         <SearchableSelect
                           items={salasList.map((s: any) => ({ value: s.nome, label: s.nome }))}
                           value={editForm.sala}
                           onValueChange={(v) => setEditForm({ ...editForm, sala: v })}
                           placeholder="Selecione a sala"
                           disabled={!editForm.departamento}
                         />
                       </div>
                     </div>
                   )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Imagem</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center gap-4 min-h-[200px]">
                    {editForm.imagem ? (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <img 
                          src={editForm.imagem} 
                          alt="Preview" 
                          className="max-h-[200px] max-w-full object-contain rounded-md" 
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-0 right-0 h-6 w-6"
                          onClick={() => setEditForm({...editForm, imagem: null})}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-10 w-10 mb-2 opacity-50" />
                        <p className="text-sm">Nenhuma imagem</p>
                      </div>
                    )}
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageChange}
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Alterar Foto
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2 mt-2">
                    <Label>Anexar Nota Fiscal (PDF)</Label>
                    <div className="flex items-center gap-2">
                         <input 
                            ref={pdfInputRef}
                            type="file" 
                            accept="application/pdf" 
                            className="hidden" 
                            onChange={handlePdfChange}
                         />
                         <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => pdfInputRef.current?.click()}
                         >
                            <Upload className="h-4 w-4 mr-2" />
                            {editForm.notaFiscal ? "Alterar PDF" : "Selecionar PDF"}
                         </Button>
                         {editForm.notaFiscal && (
                            <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => setEditForm({...editForm, notaFiscal: null})}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                         )}
                    </div>
                    {editForm.notaFiscal && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            PDF Anexado
                        </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>

          <div className="p-4 border-t bg-background mt-auto flex justify-end gap-2 z-10">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isCloning ? "Criar Cópia" : "Salvar Alteracoes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Bem Patrimonial</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este bem? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="delete-reason">Motivo da Exclusão</Label>
              <Input
                id="delete-reason"
                placeholder="Informe o motivo..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                O motivo será registrado no histórico de atividades.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={isDeleting || !deleteReason.trim()}
              className="gap-2"
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar Exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {selectedIds.length} Bens Selecionados</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir os {selectedIds.length} itens selecionados? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bulk-delete-reason">Motivo da Exclusão em Massa</Label>
              <Input
                id="bulk-delete-reason"
                placeholder="Informe o motivo da exclusão..."
                value={bulkDeleteReason}
                onChange={(e) => setBulkDeleteReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                O motivo será registrado no histórico de atividades para todos os itens.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete}
              disabled={isBulkDeleting || !bulkDeleteReason.trim()}
              className="gap-2"
            >
              {isBulkDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar Exclusão ({selectedIds.length})
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
