"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tag,
  Printer,
  Plus,
  Save,
  Trash2,
  Eye,
  Settings2,
  QrCode,
  Calendar,
  Hash,
  RefreshCw,
  ImageIcon,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Filter,
  Type,
  MapPin,
} from "lucide-react"
import useSWR from "swr"
import { fetcher } from "@/lib/api-client"
import type { Asset } from "@/lib/data"
import { useToast } from "@/components/ui/use-toast"

import { QRCodeCanvas, generateQRCodeDataURL } from "@/components/ui/qr-code"

// ============================
// Label generator
// ============================

function generateProvNumber(ano: string, seq: number): string {
  return `PROV-${ano}-${String(seq).padStart(5, "0")}`
}

function normalizeLabelText(value?: string) {
  return (value || "").replace(/\s+/g, " ").trim()
}

function fitTextWithEllipsis(
  doc: { getTextWidth: (text: string) => number },
  text: string,
  maxWidth: number
) {
  const normalized = normalizeLabelText(text)
  if (!normalized) return ""
  if (doc.getTextWidth(normalized) <= maxWidth) return normalized

  let trimmed = normalized
  while (trimmed.length > 1 && doc.getTextWidth(`${trimmed}...`) > maxWidth) {
    trimmed = trimmed.slice(0, -1).trimEnd()
  }

  return `${trimmed}...`
}

function splitLabelTextLines(
  doc: { splitTextToSize: (text: string, size: number) => string[]; getTextWidth: (text: string) => number },
  text: string,
  maxWidth: number,
  maxLines: number
) {
  const normalized = normalizeLabelText(text)
  if (!normalized) return []

  const rawLines = doc
    .splitTextToSize(normalized, maxWidth)
    .map((line) => normalizeLabelText(String(line)))
    .filter(Boolean)

  if (rawLines.length <= maxLines) return rawLines

  const clipped = rawLines.slice(0, maxLines)
  clipped[maxLines - 1] = fitTextWithEllipsis(doc, clipped[maxLines - 1], maxWidth)
  return clipped
}

interface LabelItem {
  id: string
  numero: string
  descricao: string
  assetId?: string | number
  loteId?: number
  emenda?: string
  localizacao?: {
    departamento: string
    sala: string
  }
}

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

interface LoteReserva {
  id: number
  ano: string
  quantidade: number
  origem_reserva?: "automatico" | "faixa_manual"
  faixa_inicial: string
  faixa_final: string
  status: string
  observacao?: string
  emenda_parlamentar?: string
  criado_por_nome?: string
  criado_em: string
  usadas: number
  pendentes: number
  reutilizaveis: number
}

interface FaixaLivre {
  id: number
  ano: string
  seq_inicial: number
  seq_final: number
  quantidade_registrada: number
  observacao?: string | null
  criado_por_nome?: string | null
  criado_em: string
}

interface RealignSummary {
  nextSeq: number
  formatted: string
  source: string
  gapsDetected: number
  reusableCount: number
}

interface ZebraPrintConfig {
  title: string
  subtitle: string
  showDescription: boolean
  showEmenda: boolean
  showLocation: boolean
  showFooter: boolean
  qrSizeMm: number
  offsetXMm: number
  offsetYMm: number
  offsetColuna2Mm: number
  alturaExtraMm: number
  innerPaddingMm: number
}

export function EtiquetasProvisoriasGenerator() {
  const { toast } = useToast()
  
  // States for search and pagination
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  // Filters
  const [secretaria, setSecretaria] = useState<string>("")
  const [departamento, setDepartamento] = useState<string>("")
  const [sala, setSala] = useState<string>("")

  // Fetch locations
  const { data: secretariasData } = useSWR("/secretarias?all=true", fetcher)
  const secretarias = (Array.isArray(secretariasData) ? secretariasData : (secretariasData?.data || [])) as Secretaria[]

  // Helper to find selected location objects
  const selectedSecretaria = secretarias.find(s => s.nome === secretaria)
  const selectedDepartamento = selectedSecretaria?.departamentos.find(d => d.nome === departamento)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1) // Reset to page 1 on new search
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch paginated data with filters
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    busca: debouncedSearch,
    provisorios: "true",
  })
  
  if (secretaria) queryParams.append("secretaria", secretaria)
  if (departamento) queryParams.append("departamento", departamento)
  if (sala) queryParams.append("sala", sala)

  const { data: bensResult, isLoading } = useSWR(
    `/bens?${queryParams.toString()}`, 
    fetcher,
    {
      keepPreviousData: true, // Keep data while loading new page
    }
  )

  const bens = bensResult?.data || []
  const meta = bensResult?.meta || {}
  const totalPages = meta.totalPages || 1
  const nextSeqFromBackend = meta.nextProvisionalSeq || 1

  const currentYear = new Date().getFullYear().toString()
  const [ano, setAno] = useState(currentYear)
  const [nextSeq, setNextSeq] = useState(1)
  const [nextSeqFormatted, setNextSeqFormatted] = useState("")
  const [manualNextSeq, setManualNextSeq] = useState("")
  const [sequenceSource, setSequenceSource] = useState<string>("sequencia_normal")
  const [columns, setColumns] = useState<string>("2")
  const [labels, setLabels] = useState<LabelItem[]>([])
  const [savingSettings, setSavingSettings] = useState(false)
  const [zebraConfig, setZebraConfig] = useState<ZebraPrintConfig>({
    title: "",
    subtitle: "",
    showDescription: true,
    showEmenda: true,
    showLocation: false,
    showFooter: true,
    qrSizeMm: 16,
    offsetXMm: 0,
    offsetYMm: 1,
    offsetColuna2Mm: 3,
    alturaExtraMm: 20,
    innerPaddingMm: 1.5,
  })
  
  // Customization settings
  const [customTitle, setCustomTitle] = useState("")
  const [showLocation, setShowLocation] = useState(false)
  
  // Carregar preferências salvas ao iniciar
  useEffect(() => {
    const savedTitle = localStorage.getItem("etiquetas_customTitle")
    const savedShowLocation = localStorage.getItem("etiquetas_showLocation")
    
    if (savedTitle) setCustomTitle(savedTitle)
    if (savedShowLocation !== null) setShowLocation(savedShowLocation === "true")
  }, [])

  // Salvar preferências quando alteradas
  useEffect(() => {
    localStorage.setItem("etiquetas_customTitle", customTitle)
  }, [customTitle])

  useEffect(() => {
    localStorage.setItem("etiquetas_showLocation", String(showLocation))
  }, [showLocation])
  
  // Store full asset objects to persist selection across pages
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([])
  
  const [showPreview, setShowPreview] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false)
  const [isGapDialogOpen, setIsGapDialogOpen] = useState(false)
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false)
  const [isRealignDialogOpen, setIsRealignDialogOpen] = useState(false)
  const [lotPendingCancellation, setLotPendingCancellation] = useState<LoteReserva | null>(null)
  const [batchMode, setBatchMode] = useState<"automatico" | "faixa">("automatico")
  const [batchRangeMode, setBatchRangeMode] = useState<"quantidade" | "final">("quantidade")
  const [batchQuantity, setBatchQuantity] = useState(10)
  const [batchRangeStart, setBatchRangeStart] = useState("")
  const [batchRangeEnd, setBatchRangeEnd] = useState("")
  const [batchObservation, setBatchObservation] = useState("")
  const [batchEmenda, setBatchEmenda] = useState("")
  const [manualDescricao, setManualDescricao] = useState("")
  const [manualEmenda, setManualEmenda] = useState("")
  const [gapStart, setGapStart] = useState("")
  const [gapEnd, setGapEnd] = useState("")
  const [gapObservation, setGapObservation] = useState("")
  const [realignSummary, setRealignSummary] = useState<RealignSummary | null>(null)
  const [lotStatusFilter, setLotStatusFilter] = useState("pendentes")
  const [loadingLotId, setLoadingLotId] = useState<number | null>(null)
  
  // Track printed labels (by label number)
  const [printedLabels, setPrintedLabels] = useState<string[]>([])
  const [hidePrinted, setHidePrinted] = useState(false)
  const lotsUrl = lotStatusFilter === "todos" ? "/etiquetas-provisorias" : `/etiquetas-provisorias?status=${lotStatusFilter}`
  const { data: lotesResult, mutate: mutateLotes } = useSWR(lotsUrl, fetcher)
  const lotes = (lotesResult?.data || []) as LoteReserva[]
  const { data: settingsResult, mutate: mutateSettings } = useSWR(`/etiquetas-provisorias/settings?ano=${ano}`, fetcher)
  const faixasLivres = (settingsResult?.faixasLivres || []) as FaixaLivre[]

  // Load printed labels from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("printedLabels")
    if (saved) {
      try {
        setPrintedLabels(JSON.parse(saved))
      } catch (e) {
        console.error("Error loading printed labels", e)
      }
    }
  }, [])

  // Save printed labels to localStorage
  useEffect(() => {
    localStorage.setItem("printedLabels", JSON.stringify(printedLabels))
  }, [printedLabels])

  useEffect(() => {
    if (!settingsResult) return
    if (settingsResult.sequence) {
      setNextSeq(settingsResult.sequence.nextSeq || 1)
      setNextSeqFormatted(settingsResult.sequence.formatted || "")
      setSequenceSource(settingsResult.sequence.source || "sequencia_normal")
      setManualNextSeq(settingsResult.sequence.manualSetting ? String(settingsResult.sequence.manualSetting) : "")
    }
    if (settingsResult.printConfig) {
      setZebraConfig({
        title: String(settingsResult.layoutConfig?.title ?? settingsResult.printConfig.title ?? ""),
        subtitle: String(settingsResult.layoutConfig?.subtitle ?? settingsResult.printConfig.subtitle ?? ""),
        showDescription: Boolean(settingsResult.layoutConfig?.showDescription ?? true),
        showEmenda: Boolean(settingsResult.layoutConfig?.showEmenda ?? true),
        showLocation: Boolean(settingsResult.layoutConfig?.showLocation ?? false),
        showFooter: Boolean(settingsResult.layoutConfig?.showFooter ?? true),
        qrSizeMm: Number(settingsResult.layoutConfig?.qrSizeMm ?? 16),
        offsetXMm: Number(settingsResult.printConfig.offsetXMm ?? 0),
        offsetYMm: Number(settingsResult.printConfig.offsetYMm ?? 1),
        offsetColuna2Mm: Number(settingsResult.printConfig.offsetColuna2Mm ?? 3),
        alturaExtraMm: Number(settingsResult.printConfig.alturaExtraMm ?? 20),
        innerPaddingMm: Number(settingsResult.printConfig.innerPaddingMm ?? 1.5),
      })
      if (settingsResult.layoutConfig?.title !== undefined) {
        setCustomTitle(String(settingsResult.layoutConfig.title || ""))
      }
      if (settingsResult.layoutConfig?.showLocation !== undefined) {
        setShowLocation(Boolean(settingsResult.layoutConfig.showLocation))
      }
    }
  }, [settingsResult])

  // Fetch next sequence when year changes
  useEffect(() => {
    const fetchNextSeq = async () => {
        try {
            const res = await fetch(`/api/etiquetas-provisorias/next-sequence?ano=${ano}`)
            const data = await res.json()
            if (data.nextSeq) {
                setNextSeq(data.nextSeq)
                setNextSeqFormatted(data.formatted)
                setSequenceSource(data.source || "sequencia_normal")
            }
        } catch (e) {
            console.error("Failed to fetch next sequence", e)
        }
    }
    if (!settingsResult) {
      fetchNextSeq()
    }
  }, [ano, isBatchDialogOpen, settingsResult]) // Refresh when dialog opens too

  // Removed old client-side calculation effect since we now use backend logic
  // but we keep the state to allow manual override

  const handleAddFromAsset = useCallback(() => {
    if (selectedAssets.length === 0) {
      toast({
        title: "Seleção vazia",
        description: "Selecione pelo menos um bem para gerar etiquetas.",
        variant: "destructive",
      })
      return
    }
    const newLabels: LabelItem[] = []
    let seq = nextSeq
    for (const asset of selectedAssets) {
      // Check if already added
      if (labels.some((l) => l.assetId === asset.id)) continue
      
      // Use existing provisional number if it matches pattern, otherwise generate new
      // Actually, for existing assets, we usually want to print THEIR number if it exists
      // But if it's "AUTO" or something, we might want to generate?
      // The requirement says "Generate provisional tags". 
      // If the asset already has a provisional number, we should use it.
      
      let numero = asset.patrimonioProvisorio || asset.patrimonio
      
      // If no valid number, generate one (though this updates the label, not the asset in DB)
      if (!numero || numero === "AUTO" || !numero.includes("PROV")) {
         numero = generateProvNumber(ano, seq)
         seq++
      }

      newLabels.push({
        id: `label-${Date.now()}-${asset.id}`,
        numero: numero,
        descricao: asset.descricao,
        assetId: asset.id,
        emenda: asset.emendaParlamentar,
        localizacao: {
            departamento: asset.localizacao?.departamento || "",
            sala: asset.localizacao?.sala || ""
        }
      })
    }
    setLabels((prev) => [...prev, ...newLabels])
    if (seq > nextSeq) setNextSeq(seq)
    setSelectedAssets([])
    
    toast({
      title: "Sucesso",
      description: `${newLabels.length} etiquetas geradas com sucesso!`,
    })
  }, [selectedAssets, nextSeq, ano, labels])


  const handleAddManual = useCallback(() => {
    const num = generateProvNumber(ano, nextSeq)
    setLabels((prev) => [
      ...prev,
      {
        id: `label-manual-${Date.now()}`,
        numero: num,
        descricao: manualDescricao.trim(),
        emenda: manualEmenda.trim() || undefined,
      },
    ])
    setNextSeq(nextSeq + 1)
    setManualDescricao("")
    setManualEmenda("")
    setIsManualDialogOpen(false)
    toast({
      title: "Sucesso",
      description: "Etiqueta manual adicionada.",
    })
  }, [ano, nextSeq, manualDescricao, manualEmenda])

  const parsedRangeStart = Number(batchRangeStart)
  const parsedRangeEnd = Number(batchRangeEnd)
  const isRangeByQuantity = batchRangeMode === "quantidade"
  const calculatedRangeStart = parsedRangeStart > 0 ? parsedRangeStart : 0
  const calculatedRangeQuantity = batchMode === "faixa"
    ? (isRangeByQuantity
        ? Math.max(0, batchQuantity)
        : (parsedRangeStart > 0 && parsedRangeEnd >= parsedRangeStart ? parsedRangeEnd - parsedRangeStart + 1 : 0))
    : batchQuantity
  const calculatedRangeEnd = batchMode === "faixa"
    ? (parsedRangeStart > 0
        ? (isRangeByQuantity
            ? parsedRangeStart + Math.max(0, batchQuantity) - 1
            : parsedRangeEnd)
        : 0)
    : nextSeq + batchQuantity - 1

  const handleBatchGenerate = async () => {
    if (batchMode === "automatico") {
      if (batchQuantity <= 0) {
        toast({
          title: "Quantidade invalida",
          description: "A quantidade deve ser maior que zero.",
          variant: "destructive",
        })
        return
      }
    } else {
      if (!calculatedRangeStart || calculatedRangeStart < 1) {
        toast({
          title: "Faixa invalida",
          description: "Informe um numero inicial valido para a faixa.",
          variant: "destructive",
        })
        return
      }
      if (!calculatedRangeQuantity || calculatedRangeQuantity < 1 || !calculatedRangeEnd || calculatedRangeEnd < calculatedRangeStart) {
        toast({
          title: "Faixa invalida",
          description: "Informe uma faixa valida para reservar.",
          variant: "destructive",
        })
        return
      }
    }

    setIsGenerating(true)
    try {
      const payload = batchMode === "automatico"
        ? {
            mode: "automatico",
            quantidade: batchQuantity,
            ano,
            observacao: batchObservation,
            emendaParlamentar: batchEmenda,
          }
        : {
            mode: "faixa",
            ano,
            seqInicial: calculatedRangeStart,
            observacao: batchObservation,
            emendaParlamentar: batchEmenda,
            strict: true,
            ...(isRangeByQuantity
              ? { quantidade: batchQuantity }
              : { seqFinal: calculatedRangeEnd }),
          }

      const response = await fetch("/api/etiquetas-provisorias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 409 && Array.isArray(errorData.conflitos) && errorData.conflitos.length > 0) {
          const preview = errorData.conflitos.slice(0, 3).map((item: { codigo: string }) => item.codigo).join(", ")
          throw new Error(`A faixa escolhida possui conflitos: ${preview}${errorData.conflitos.length > 3 ? "..." : ""}`)
        }
        throw new Error(errorData.error || "Erro ao gerar etiquetas")
      }

      const data = await response.json()
      setIsBatchDialogOpen(false)
      setBatchMode("automatico")
      setBatchRangeMode("quantidade")
      setBatchRangeStart("")
      setBatchRangeEnd("")
      setBatchObservation("")
      setBatchEmenda("")
      mutateLotes()
      mutateSettings()
      
      toast({
        title: "Sucesso",
        description: `${data.countReservadas || data.count} etiquetas reservadas com sucesso${data.faixaInicial && data.faixaFinal ? ` (${data.faixaInicial} ate ${data.faixaFinal})` : ""}. Use "Adicionar a impressao" quando quiser imprimir esse lote.`,
      })
    } catch (error: any) {
      console.error(error)
      toast({
        title: "Erro",
        description: error.message || "Nao foi possivel gerar as etiquetas. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCancelLot = async (loteId: number) => {
    try {
      const response = await fetch("/api/etiquetas-provisorias", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loteId, action: "cancelar_saldo" }),
      })

      if (!response.ok) throw new Error("Erro ao atualizar lote")
      await mutateLotes()
      await mutateSettings()
      setLabels((prev) => prev.filter((label) => label.loteId !== loteId))
      toast({
        title: "Lote atualizado",
        description: "Saldo nao usado liberado para reuso com historico preservado.",
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "Erro",
        description: "Nao foi possivel atualizar o lote.",
        variant: "destructive",
      })
    }
  }

  const handleAddLotToPrint = async (lote: LoteReserva) => {
    setLoadingLotId(lote.id)
    try {
      const response = await fetch(`/api/etiquetas-provisorias?loteId=${lote.id}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel carregar as etiquetas do lote.")
      }

      const lotTags = Array.isArray(data.data) ? data.data : []
      const existingCodes = new Set(labels.map((label) => label.numero))
      const newLabels = lotTags
        .filter((tag: { codigo: string }) => !existingCodes.has(tag.codigo))
        .map((tag: { id: number; codigo: string; observacao?: string | null; emenda_parlamentar?: string | null }) => ({
          id: `label-lote-${lote.id}-${tag.id}`,
          loteId: lote.id,
          numero: tag.codigo,
          descricao: tag.observacao || "",
          emenda: tag.emenda_parlamentar || lote.emenda_parlamentar || undefined,
        })) as LabelItem[]

      if (newLabels.length === 0) {
        toast({
          title: "Fila ja atualizada",
          description: "As etiquetas pendentes desse lote ja estao na fila de impressao atual.",
        })
        return
      }

      setLabels((prev) => [...prev, ...newLabels])
      toast({
        title: "Lote adicionado a impressao",
        description: `${newLabels.length} etiqueta(s) pendente(s) adicionada(s) a fila de impressao.`,
      })
    } catch (error: any) {
      console.error(error)
      toast({
        title: "Erro",
        description: error.message || "Nao foi possivel adicionar o lote a impressao.",
        variant: "destructive",
      })
    } finally {
      setLoadingLotId(null)
    }
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const response = await fetch("/api/etiquetas-provisorias/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preset: "patrimonio_provisorio",
          ano,
          proximoNumeroManual: manualNextSeq ? Number(manualNextSeq) : null,
          layoutConfig: {
            ...zebraConfig,
            title: customTitle,
            showLocation,
          },
        }),
      })

      if (!response.ok) throw new Error("Erro ao salvar configuracoes")
      await mutateSettings()
      toast({
        title: "Configuracoes salvas",
        description: "Sequencia manual e preset global da Zebra foram atualizados.",
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "Erro",
        description: "Nao foi possivel salvar as configuracoes das etiquetas.",
        variant: "destructive",
      })
    } finally {
      setSavingSettings(false)
    }
  }

  const handleRegisterGapRange = async () => {
    const seqInicial = Number(gapStart)
    const seqFinal = Number(gapEnd)
    if (!seqInicial || !seqFinal || seqInicial < 1 || seqFinal < seqInicial) {
      toast({
        title: "Faixa invalida",
        description: "Informe um numero inicial e final validos para a faixa livre.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/etiquetas-provisorias", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "registrar_faixa_livre",
          ano,
          seqInicial,
          seqFinal,
          observacao: gapObservation,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Erro ao registrar faixa livre")

      setGapStart("")
      setGapEnd("")
      setGapObservation("")
      setIsGapDialogOpen(false)
      await mutateSettings()
      toast({
        title: "Faixa livre registrada",
        description: `${data.inserted || 0} numero(s) adicionados, ${data.updated || 0} reaproveitados e ${data.skipped || 0} ignorados por conflito.`,
      })
    } catch (error: any) {
      console.error(error)
      toast({
        title: "Erro",
        description: error.message || "Nao foi possivel registrar a faixa livre.",
        variant: "destructive",
      })
    }
  }

  const handleSafeRealign = async () => {
    try {
      const response = await fetch("/api/etiquetas-provisorias", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "realinhar_patrimonios",
          ano,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Erro ao realinhar patrimonios")

      setIsRealignDialogOpen(false)
      setRealignSummary(data.summary || null)
      await mutateSettings()
      toast({
        title: "Patrimonios realinhados",
        description: `Proximo numero: ${data.formatted}. Lacunas detectadas: ${data.gapsDetected || 0}. Reutilizaveis: ${data.reusableCount || 0}.`,
      })
    } catch (error: any) {
      console.error(error)
      toast({
        title: "Erro",
        description: error.message || "Nao foi possivel realinhar a sequencia.",
        variant: "destructive",
      })
    }
  }


  const handleRemoveLabel = (id: string) => {
    setLabels((prev) => prev.filter((l) => l.id !== id))
    toast({
      title: "Removido",
      description: "Etiqueta removida da lista.",
    })
  }

  const handleRegenerateNumbers = () => {
    let seq = 1
    setLabels((prev) =>
      prev.map((l) => ({
        ...l,
        numero: generateProvNumber(ano, seq++),
      }))
    )
    setNextSeq(seq)
    toast({
      title: "Renumerado",
      description: "Todas as etiquetas foram renumeradas sequencialmente.",
    })
  }

  const handleDownloadPDF = async () => {
    if (labels.length === 0) {
      toast({
        title: "Lista vazia",
        description: "Adicione etiquetas antes de baixar.",
        variant: "destructive",
      })
      return
    }

    try {
        const { jsPDF } = await import("jspdf")
        const effectiveTitle = customTitle || zebraConfig.title
        const effectiveSubtitle = zebraConfig.subtitle
        const shouldShowDescription = zebraConfig.showDescription
        const shouldShowEmenda = zebraConfig.showEmenda
        const shouldShowFooter = zebraConfig.showFooter
        const shouldShowLocation = showLocation || zebraConfig.showLocation

        const cols = parseInt(columns) || 2
        const labelWidth = 50
        // Aumentamos a altura da página PDF para enganar a impressora.
        // Se a impressora "come" 14mm do topo, vamos criar uma página maior (25mm + 14mm = 39mm).
        // Mas o conteúdo nós desenhamos no topo absoluto dessa página maior.
        // Assim, quando a impressora pular os 14mm, ela vai começar a imprimir onde queremos.
        // Usuário pediu +0,6cm (6mm) de altura extra -> Total 14mm + 6mm = 20mm
        const extraHeight = zebraConfig.alturaExtraMm
        const labelHeight = 25 + extraHeight 
        const pageWidth = labelWidth * cols
        
        // Configuração da página
        const doc = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: [pageWidth, labelHeight] 
        })

        for (let i = 0; i < labels.length; i++) {
            const label = labels[i]
            
            if (i > 0 && i % cols === 0) {
                doc.addPage([pageWidth, labelHeight], "landscape")
            }

            const colIndex = i % cols
            
            // Ajuste horizontal individual por coluna
            // Coluna 1: 0mm (Perfeito segundo usuário)
            // Coluna 2: +3mm (Era 5mm, usuário pediu para mover 0,2cm = 2mm para ESQUERDA)
            const marginLeft = zebraConfig.offsetXMm + (colIndex === 1 ? zebraConfig.offsetColuna2Mm : 0)
            
            // O conteúdo começa no TOPO da página (0), mas como a página é maior e a impressora tem offset,
            // esperamos que o conteúdo "caia" no lugar certo.
            const marginTop = zebraConfig.offsetYMm
            
            const xOffset = (colIndex * labelWidth) + marginLeft

            const qrDataUrl = await generateQRCodeDataURL(label.numero)
            
            // --- LAYOUT ---
            // Reduzido QR para 16mm para dar mais espaço
            const qrSize = zebraConfig.qrSizeMm
            doc.addImage(qrDataUrl, 'PNG', xOffset + zebraConfig.innerPaddingMm, marginTop + zebraConfig.innerPaddingMm, qrSize, qrSize) 

            // Área de texto
            const textX = xOffset + zebraConfig.innerPaddingMm + qrSize + 2
            const maxTextWidth = 26 
            
            // Cursor vertical dinâmico para evitar sobreposição
            let currentY = marginTop + zebraConfig.innerPaddingMm

            // Título (Aumentado e Negrito)
            doc.setFont("helvetica", "bold")
            if (effectiveTitle) {
                doc.setFontSize(6.5) 
                currentY += 2.0; // Reduzido de 2.5
                doc.text(effectiveTitle.toUpperCase().substring(0, 25), textX, currentY) 
                
                currentY += 0.8; // Reduzido de 1
                doc.setLineWidth(0.2) 
                doc.line(textX, currentY, xOffset + 45, currentY)
                
                currentY += 0.8; // Reduzido de 1
                if (effectiveSubtitle) {
                    doc.setFont("helvetica", "normal")
                    doc.setFontSize(5)
                    currentY += 1.8
                    doc.text(effectiveSubtitle.toUpperCase().substring(0, 28), textX, currentY)
                    doc.setFont("helvetica", "bold")
                }
            } else if (shouldShowFooter) {
                currentY += 2.0; // Reduzido de 3
            }

            // Número (Mantém negrito e tamanho adaptável)
            currentY += 2.5; // Reduzido de 3
            let fontSize = 9
            doc.setFontSize(fontSize)
            let textWidth = doc.getTextWidth(label.numero)
            while (textWidth > maxTextWidth && fontSize > 5) {
                fontSize -= 0.5
                doc.setFontSize(fontSize)
                textWidth = doc.getTextWidth(label.numero)
            }
            doc.text(label.numero, textX, currentY) 
            
            // Descrição (Aumentado e Negrito)
            if (shouldShowDescription && label.descricao) {
                currentY += 3.0; 
                doc.setFont("helvetica", "bold") 
                doc.setFontSize(6) 
                
                // Limita a 2 linhas conforme solicitado pelo usuário
                // Se mostrar emenda, limita a 1 linha
                const maxLines = shouldShowEmenda && label.emenda ? 1 : 2
                const lines = splitLabelTextLines(doc, label.descricao.toUpperCase(), maxTextWidth, maxLines)
                
                doc.text(lines, textX, currentY)
                
                // Calcula altura ocupada pela descrição para mover o cursor
                // Ajustando line height para evitar sobreposição
                const lineHeight = 2.5
                // Se tiver mais de uma linha, precisa descer o cursor
                const descHeight = (lines.length - 1) * lineHeight
                currentY += descHeight
            }

            // Emenda Parlamentar (automatica quando existir)
            if (shouldShowEmenda && label.emenda) {
                 currentY += 2.2
                 doc.setFont("helvetica", "normal")
                 doc.setFontSize(5.6)
                 const emendaLines = splitLabelTextLines(doc, label.emenda, maxTextWidth, 2)
                 doc.text(emendaLines, textX, currentY)
                 currentY += (emendaLines.length - 1) * 2.6
            }

            // Localização removida a pedido do usuário
            // if (showLocation && label.localizacao) { ... }
            
            // Rodapé fixo (Aumentado e Negrito)
            if (shouldShowLocation && label.localizacao && (label.localizacao.departamento || label.localizacao.sala)) {
                 currentY += 2.3;
                 doc.setFont("helvetica", "normal")
                 doc.setFontSize(4.8)
                 const locationText = [label.localizacao.departamento, label.localizacao.sala].filter(Boolean).join(" - ")
                 const locationLines = doc.splitTextToSize(locationText.toUpperCase(), maxTextWidth).slice(0, 2)
                 doc.text(locationLines, textX, currentY)
                 currentY += (locationLines.length - 1) * 2.2;
            }

            doc.setFont("helvetica", "bold") 
            doc.setFontSize(5) 
            // Garante que fique no final (23mm), mas se o conteúdo empurrou muito, desce um pouco
            // O limite físico é ~25mm. Margem top 1mm.
            const footerY = Math.max(marginTop + 22, currentY + 2.5);
            
            // Verifica se estourou a etiqueta (25mm)
            if (shouldShowFooter && footerY > 25) {
                // Se estourou, tenta imprimir em 24mm mesmo que sobreponha levemente, ou não imprime
                doc.text("SISPATRIMONIO", xOffset + 45, 24, { align: "right" }) 
            } else {
                doc.text("SISPATRIMONIO", xOffset + 45, footerY, { align: "right" }) 
            } 
        }

        doc.save(`etiquetas_zebra_${cols}col_${new Date().toISOString().slice(0,10)}.pdf`)
        
        toast({
            title: "PDF Gerado",
            description: `Arquivo com ${cols} coluna(s) gerado com sucesso.`,
        })

    } catch (error) {
        console.error("Erro ao gerar PDF", error)
        toast({
            title: "Erro",
            description: "Falha ao gerar o arquivo PDF.",
        })
    }
  }

  const handlePrint = async () => {
    if (labels.length === 0) {
      toast({
        title: "Lista vazia",
        description: "Adicione etiquetas antes de imprimir.",
        variant: "destructive",
      })
      return
    }
    const cols = parseInt(columns)
    const effectiveTitle = customTitle || zebraConfig.title
    const effectiveSubtitle = zebraConfig.subtitle
    const shouldShowDescription = zebraConfig.showDescription
    const shouldShowEmenda = zebraConfig.showEmenda
    const shouldShowFooter = zebraConfig.showFooter
    const shouldShowLocation = showLocation || zebraConfig.showLocation
    // Label size: 5cm width x 2.5cm height
    const labelWidthMm = 50
    const labelHeightMm = 25
    const pageWidthMm = cols * labelWidthMm
    
    // Determine if we should force a specific page size (best for Zebra)
    // If we set height in @page, it forces pagination per label/row
    const pageHeightMm = labelHeightMm + zebraConfig.alturaExtraMm

    let labelsHtml = ""
    
    // If single column, simple list. If multi-column, we rely on flex-wrap but 
    // it's safer to group if we want strict page breaking. 
    // However, for simplicity and existing logic, we'll keep the flat list 
    // but ensure the container and page size are strict.
    
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i]
      const qrDataUrl = await generateQRCodeDataURL(label.numero)

      // Calculate if we need a page break after this item (only for last item in a "row")
      // But with fixed page size in CSS, the browser usually handles it.
      // We will add a class that can be targeted.
      
      labelsHtml += `
        <div class="label-item" style="
          width: ${labelWidthMm}mm;
          height: ${labelHeightMm}mm;
          border: 0.5px dashed #ccc; /* Border helps visualization but might want to remove for final print */
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          gap: 2mm;
          padding: ${zebraConfig.innerPaddingMm}mm;
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
          left: ${zebraConfig.offsetXMm + (i % cols === 1 ? zebraConfig.offsetColuna2Mm : 0)}mm;
          top: ${zebraConfig.offsetYMm}mm;
        ">
          <img src="${qrDataUrl}" style="width: ${zebraConfig.qrSizeMm}mm; height: ${zebraConfig.qrSizeMm}mm; flex-shrink: 0;" alt="QR" />
          <div style="flex: 1; min-width: 0; text-align: left; display: flex; flex-direction: column; justify-content: center; height: 100%;">
            ${effectiveTitle ? `<div style="font-size: 5pt; font-weight: bold; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 0.5mm; border-bottom: 0.5px solid #000;">${effectiveTitle}</div>` : ""}
            ${effectiveSubtitle ? `<div style="font-size: 4.4pt; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 0.4mm;">${effectiveSubtitle}</div>` : ""}
            
            <div style="font-size: 7.5pt; font-weight: bold; font-family: monospace; letter-spacing: -0.2px; line-height: 1; margin-top: 0.5mm;">
              ${label.numero}
            </div>
            
            ${shouldShowDescription && label.descricao ? `<div style="font-size: 5.5pt; color: #000; margin-top: 0.5mm; overflow: hidden; text-overflow: ellipsis; white-space: ${shouldShowEmenda && label.emenda ? "nowrap" : "normal"}; display: ${shouldShowEmenda && label.emenda ? "block" : "-webkit-box"}; -webkit-line-clamp: ${shouldShowEmenda && label.emenda ? "1" : "2"}; -webkit-box-orient: vertical; font-weight: 600; line-height: 1.1;">${label.descricao}</div>` : ""}
            ${shouldShowEmenda && label.emenda ? `<div style="font-size: 5.3pt; color: #000; margin-top: 0.45mm; overflow: hidden; line-height: 1.18; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word;">${label.emenda}</div>` : ""}
            ${shouldShowLocation && label.localizacao ? `<div style="font-size: 4.3pt; color: #000; margin-top: 0.4mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.05;">${[label.localizacao.departamento, label.localizacao.sala].filter(Boolean).join(" - ")}</div>` : ""}
            
            ${shouldShowFooter ? `<div style="font-size: 4pt; color: #000; margin-top: auto; text-transform: uppercase; text-align: right;">SisPatrimonio</div>` : ""}
          </div>
        </div>
      `
    }

    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast({
        title: "Pop-up bloqueado",
        description: "Por favor, permita pop-ups para imprimir as etiquetas.",
        variant: "destructive",
      })
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiquetas Provisorias - SisPatrimonio</title>
        <style>
          /* Define the exact page size for the printer driver */
          @page {
            margin: 0;
            size: ${pageWidthMm}mm ${pageHeightMm}mm; 
          }
          
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            width: ${pageWidthMm}mm;
          }
          
          .labels-container {
            display: flex;
            flex-wrap: wrap;
            width: ${pageWidthMm}mm;
            margin: 0;
            padding: 0;
          }
          
          .label-item {
            /* Ensure exact sizing */
            width: ${labelWidthMm}mm !important;
            height: ${labelHeightMm}mm !important;
            /* Optional: Remove border for production if needed, or keep for cutting guide */
            border: 1px solid #ddd; 
            page-break-inside: avoid;
            background: white;
          }

          /* Zebra printers often print better with high contrast black/white */
          @media print {
            body { 
               margin: 0; 
               padding: 0;
               width: ${pageWidthMm}mm;
            }
            .label-item {
               border: none; /* Usually don't want borders on actual thermal labels */
               page-break-inside: avoid;
               break-inside: avoid;
            }
            /* Force page break after every N items if needed, but @page size usually handles it */
          }
        </style>
      </head>
      <body>
        <div class="labels-container">
          ${labelsHtml}
        </div>
        <script>
           // Auto print and close
           window.onload = () => {
             setTimeout(() => {
               window.print();
               // window.close(); // Optional: close after print
             }, 500);
           }
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
    
    // Add to printed labels list
    const printedNums = labels.map(l => l.numero)
    setPrintedLabels(prev => {
        const unique = new Set([...prev, ...printedNums])
        return Array.from(unique)
    })
    
    toast({
      title: "Impressão iniciada",
      description: "A janela de impressão foi aberta.",
    })
  }

  const toggleAssetSelection = (asset: Asset) => {
    setSelectedAssets((prev) =>
      prev.some((a) => a.id === asset.id)
        ? prev.filter((a) => a.id !== asset.id)
        : [...prev, asset]
    )
  }

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
    }
  }

  const filteredBens = bens.filter((asset: Asset) => {
    const num = asset.patrimonioProvisorio || asset.patrimonio
    if (!num) return true
    const isPrinted = printedLabels.includes(num)
    if (hidePrinted && isPrinted) return false
    return true
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">
            Gerar Etiquetas Provisorias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gere etiquetas provisorias com QR Code para impressao na Zebra ZD220
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isGapDialogOpen} onOpenChange={setIsGapDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Hash className="h-4 w-4" />
                Registrar Faixa Livre
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Faixa Livre Antiga</DialogTitle>
                <DialogDescription>
                  Informe a faixa de numeros antigos que ficaram sem uso para que o sistema possa reaproveita-los.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="gap-start">Numero inicial</Label>
                    <Input id="gap-start" type="number" min={1} value={gapStart} onChange={(e) => setGapStart(e.target.value.replace(/\D/g, ""))} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="gap-end">Numero final</Label>
                    <Input id="gap-end" type="number" min={1} value={gapEnd} onChange={(e) => setGapEnd(e.target.value.replace(/\D/g, ""))} />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="gap-observation">Observacao</Label>
                  <Input id="gap-observation" value={gapObservation} onChange={(e) => setGapObservation(e.target.value)} placeholder="Ex: etiquetas antigas nao utilizadas" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsGapDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleRegisterGapRange}>Registrar Faixa</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isRealignDialogOpen} onOpenChange={setIsRealignDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 bg-transparent">
                <RefreshCw className="h-4 w-4" />
                Realinhar Patrimonios
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Realinhar Patrimonios</DialogTitle>
                <DialogDescription>
                  O sistema vai analisar a sequencia de {ano}, priorizar numeros reaproveitaveis e, se nao houver, ajustar o proximo numero para a menor lacuna segura sem tocar em etiquetas ja usadas.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRealignDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSafeRealign}>
                  Confirmar Realinhamento
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {labels.length > 0 && (
            <>
              <Button
                variant="outline"
                className="gap-2 bg-transparent"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-4 w-4" />
                {showPreview ? "Ocultar Preview" : "Preview"}
              </Button>
              <Button className="gap-2" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
                Imprimir (Navegador)
              </Button>
              <Button className="gap-2" variant="outline" onClick={handleDownloadPDF}>
                <Tag className="h-4 w-4" />
                Baixar PDF (Zebra)
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Configuracao das Etiquetas</CardTitle>
            </div>
            <Button className="gap-2" onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Preset
            </Button>
          </div>
          <CardDescription>
            Defina o ano, sequencia e layout de impressao para as etiquetas provisorias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ano-etiqueta" className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Ano
              </Label>
              <Input
                id="ano-etiqueta"
                value={ano}
                onChange={(e) => setAno(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder={currentYear}
                maxLength={4}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Ano atual: {currentYear}. Altere se necessario.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="seq-etiqueta" className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                Proximo Numero (Inicio)
              </Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="seq-etiqueta"
                  value={nextSeqFormatted || generateProvNumber(ano, nextSeq)}
                  readOnly
                  className="bg-muted font-mono"
                />
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  Seq: {nextSeq}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                O sistema detectou que este e o proximo numero disponivel para {ano}.
              </p>
              <p className="text-[10px] font-medium text-muted-foreground">
                Origem: {sequenceSource === "reuso" ? "reuso de numero livre" : sequenceSource === "ajuste_manual" ? "ajuste manual" : sequenceSource === "realinhamento_seguro" ? "realinhamento seguro" : "sequencia normal"}
              </p>
              {realignSummary && (
                <p className="text-[10px] text-muted-foreground">
                  Ultimo realinhamento: {realignSummary.gapsDetected} lacuna(s), {realignSummary.reusableCount} reutilizavel(is), proximo {realignSummary.formatted}.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="manual-seq-etiqueta" className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                Proximo Numero Manual
              </Label>
              <Input
                id="manual-seq-etiqueta"
                type="number"
                min={1}
                value={manualNextSeq}
                onChange={(e) => setManualNextSeq(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex: 245"
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Use para realinhar a sequencia sem perder o reaproveitamento automatico.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1.5">
                <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                Colunas por Linha
              </Label>
              <Select value={columns} onValueChange={setColumns}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 coluna</SelectItem>
                  <SelectItem value="2">2 colunas (Zebra ZD220)</SelectItem>
                  <SelectItem value="3">3 colunas</SelectItem>
                  <SelectItem value="4">4 colunas</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Zebra ZD220: bobina com 2 etiquetas por linha
              </p>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button
                variant="outline"
                type="button"
                className="w-full justify-between bg-transparent"
                onClick={() => setShowAdvancedSettings((prev) => !prev)}
              >
                {showAdvancedSettings ? "Ocultar ajustes avancados" : "Mostrar ajustes avancados"}
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>

            {showAdvancedSettings && (
              <>
                <div className="flex flex-col gap-2">
                  <Label className="flex items-center gap-1.5">
                    <QrCode className="h-3.5 w-3.5 text-muted-foreground" />
                    Tamanho Etiqueta
                  </Label>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-sm font-mono font-medium">5,0cm x 2,5cm</p>
                    <p className="text-xs text-muted-foreground">Largura x Altura</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="titulo-etiqueta" className="flex items-center gap-1.5">
                    <Type className="h-3.5 w-3.5 text-muted-foreground" />
                    Titulo Personalizado
                  </Label>
                  <Input
                    id="titulo-etiqueta"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Ex: Secretaria de Saude"
                    className="text-sm"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="subtitulo-etiqueta">Subtitulo Opcional</Label>
                  <Input
                    id="subtitulo-etiqueta"
                    value={zebraConfig.subtitle}
                    onChange={(e) => setZebraConfig((prev) => ({ ...prev, subtitle: e.target.value }))}
                    placeholder="Ex: Patrimonio Provisorio"
                    className="text-sm"
                  />
                </div>
                 
                <div className="flex flex-col gap-2">
                  <Label className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    Emenda Parlamentar
                  </Label>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-sm font-medium">Impressao automatica</p>
                    <p className="text-xs text-muted-foreground">
                      Sempre que a etiqueta tiver emenda salva, ela sera impressa no PDF e na Zebra.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-lg border p-3 sm:col-span-2">
                  <Label>Campos Visiveis</Label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={zebraConfig.showDescription} onCheckedChange={(checked) => setZebraConfig((prev) => ({ ...prev, showDescription: !!checked }))} />
                      Mostrar descricao
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={zebraConfig.showEmenda} onCheckedChange={(checked) => setZebraConfig((prev) => ({ ...prev, showEmenda: !!checked }))} />
                      Mostrar emenda
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={showLocation || zebraConfig.showLocation} onCheckedChange={(checked) => { setShowLocation(!!checked); setZebraConfig((prev) => ({ ...prev, showLocation: !!checked })) }} />
                      Mostrar localizacao
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={zebraConfig.showFooter} onCheckedChange={(checked) => setZebraConfig((prev) => ({ ...prev, showFooter: !!checked }))} />
                      Mostrar rodape
                    </label>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Tamanho do QR (mm)</Label>
                  <Input type="number" step="0.5" min="8" value={zebraConfig.qrSizeMm} onChange={(e) => setZebraConfig(prev => ({ ...prev, qrSizeMm: Number(e.target.value) }))} />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Offset Horizontal Geral (mm)</Label>
                  <Input type="number" step="0.5" value={zebraConfig.offsetXMm} onChange={(e) => setZebraConfig(prev => ({ ...prev, offsetXMm: Number(e.target.value) }))} />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Offset Vertical Geral (mm)</Label>
                  <Input type="number" step="0.5" value={zebraConfig.offsetYMm} onChange={(e) => setZebraConfig(prev => ({ ...prev, offsetYMm: Number(e.target.value) }))} />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Ajuste Extra da 2a Coluna (mm)</Label>
                  <Input type="number" step="0.5" value={zebraConfig.offsetColuna2Mm} onChange={(e) => setZebraConfig(prev => ({ ...prev, offsetColuna2Mm: Number(e.target.value) }))} />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Altura Extra PDF Zebra (mm)</Label>
                  <Input type="number" step="0.5" value={zebraConfig.alturaExtraMm} onChange={(e) => setZebraConfig(prev => ({ ...prev, alturaExtraMm: Number(e.target.value) }))} />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Margem Interna (mm)</Label>
                  <Input type="number" step="0.5" value={zebraConfig.innerPaddingMm} onChange={(e) => setZebraConfig(prev => ({ ...prev, innerPaddingMm: Number(e.target.value) }))} />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Faixas Livres Registradas</CardTitle>
          <CardDescription>
            Historico das lacunas antigas registradas para reuso controlado.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {faixasLivres.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Faixa</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Observacao</TableHead>
                    <TableHead>Registrado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faixasLivres.map((faixa) => (
                    <TableRow key={faixa.id}>
                      <TableCell className="font-mono text-xs">
                        {generateProvNumber(faixa.ano, faixa.seq_inicial)}
                        <br />
                        {generateProvNumber(faixa.ano, faixa.seq_final)}
                      </TableCell>
                      <TableCell>{faixa.quantidade_registrada}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{faixa.observacao || "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{faixa.criado_por_nome || "Sistema"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">Nenhuma faixa livre registrada para {ano}.</div>
          )}
        </CardContent>
      </Card>

      {/* Add labels from existing provisional assets */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Bens Provisorios Existentes</CardTitle>
              <CardDescription>
                Selecione bens para gerar suas etiquetas provisorias
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-2">
                    <Checkbox 
                        id="hide-printed" 
                        checked={hidePrinted} 
                        onCheckedChange={(c) => setHidePrinted(!!c)} 
                    />
                    <Label htmlFor="hide-printed" className="text-sm font-normal cursor-pointer">
                        Ocultar Impressos
                    </Label>
                </div>
                {selectedAssets.length > 0 && (
                  <Button size="sm" className="gap-1.5" onClick={handleAddFromAsset}>
                    <Tag className="h-4 w-4" />
                    Gerar Etiquetas ({selectedAssets.length})
                  </Button>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 p-4 border-b">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="filtro-secretaria" className="text-xs">Secretaria</Label>
                <Select value={secretaria} onValueChange={(v) => { setSecretaria(v === "all" ? "" : v); setDepartamento(""); setSala(""); }}>
                  <SelectTrigger id="filtro-secretaria" className="h-8">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {secretarias.map((s) => (
                      <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col gap-2">
                <Label htmlFor="filtro-departamento" className="text-xs">Departamento</Label>
                <Select value={departamento} onValueChange={(v) => { setDepartamento(v === "all" ? "" : v); setSala(""); }} disabled={!secretaria}>
                  <SelectTrigger id="filtro-departamento" className="h-8">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {selectedSecretaria?.departamentos.map((d) => (
                      <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="filtro-sala" className="text-xs">Sala</Label>
                <Select value={sala} onValueChange={(v) => setSala(v === "all" ? "" : v)} disabled={!departamento}>
                  <SelectTrigger id="filtro-sala" className="h-8">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {selectedDepartamento?.salas.map((s) => (
                      <SelectItem key={typeof s === 'object' ? s.id : s} value={typeof s === 'object' ? s.nome : s}>
                        {typeof s === 'object' ? s.nome : s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por patrimonio, descricao ou responsavel..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : bens.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="w-[60px]">Foto</TableHead>
                    <TableHead>Patrimonio Prov.</TableHead>
                    <TableHead>Descricao</TableHead>
                    <TableHead className="hidden md:table-cell">Localizacao</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBens.map((asset: Asset) => {
                    const alreadyAdded = labels.some((l) => l.assetId === asset.id)
                    const isSelected = selectedAssets.some((a) => a.id === asset.id)
                    const patNum = asset.patrimonioProvisorio || asset.patrimonio
                    const isPrinted = patNum && printedLabels.includes(patNum)
                    
                    return (
                      <TableRow
                        key={asset.id}
                        className={
                          alreadyAdded
                            ? "opacity-50"
                            : isSelected
                              ? "bg-primary/5"
                              : ""
                        }
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleAssetSelection(asset)}
                            disabled={alreadyAdded}
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
                          <div className="flex flex-col gap-1">
                            <Badge
                                variant="outline"
                                className="font-mono text-[11px] border-warning/50 text-warning w-fit"
                            >
                                {patNum}
                            </Badge>
                            {isPrinted && (
                              <Badge variant="secondary" className="text-[9px] bg-green-100 text-green-800 hover:bg-green-100 w-fit border-green-200">
                                  Impresso
                              </Badge>
                            )}
                          </div>
                          {alreadyAdded && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              Ja adicionado
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{asset.descricao}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {asset.localizacao.departamento} - {asset.localizacao.sala}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {search ? "Nenhum bem encontrado para a busca." : "Nenhum bem com patrimonio provisorio encontrado."}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-4">
              <div className="text-xs text-muted-foreground">
                Pagina {page} de {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages || isLoading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Lotes Reservados</CardTitle>
              <CardDescription>Estoque e historico de numeros reservados. Por padrao, a lista mostra apenas lotes com saldo pendente.</CardDescription>
            </div>
            <Select value={lotStatusFilter} onValueChange={setLotStatusFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendentes">Apenas pendentes</SelectItem>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="reservado">Reservado</SelectItem>
                <SelectItem value="parcialmente_usado">Parcialmente usado</SelectItem>
                <SelectItem value="usado">Usado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          {lotes.length > 0 ? (
            <Accordion type="single" collapsible className="space-y-2">
              {lotes.map((lote) => (
                <AccordionItem key={lote.id} value={`lote-${lote.id}`} className="rounded-lg border bg-card px-4">
                  <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <AccordionTrigger className="flex-1 py-0 hover:no-underline">
                      <div className="grid flex-1 gap-2 text-left md:grid-cols-[minmax(120px,1fr)_minmax(180px,1.2fr)_110px_minmax(180px,1.3fr)]">
                        <div className="flex flex-col">
                          <span className="font-medium">Lote #{lote.id}</span>
                          <span className="text-xs text-muted-foreground">{lote.criado_por_nome || "Sistema"}</span>
                        </div>
                        <div className="font-mono text-xs">
                          <div>{lote.faixa_inicial}</div>
                          <div>{lote.faixa_final}</div>
                        </div>
                        <div>
                          <Badge variant="outline">{lote.status}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {lote.pendentes} pendentes, {lote.usadas} usadas, {lote.reutilizaveis} reutilizaveis
                        </div>
                      </div>
                    </AccordionTrigger>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-transparent"
                        disabled={lote.pendentes === 0 || loadingLotId === lote.id}
                        onClick={() => handleAddLotToPrint(lote)}
                      >
                        {loadingLotId === lote.id ? "Carregando..." : "Adicionar a impressao"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-transparent"
                        disabled={lote.pendentes === 0}
                        onClick={() => setLotPendingCancellation(lote)}
                      >
                        Cancelar Saldo Reservado
                      </Button>
                    </div>
                  </div>
                  <AccordionContent className="pb-4 pt-0">
                    <div className="grid gap-3 rounded-md border bg-muted/20 p-3 text-sm md:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Origem</p>
                        <p>{lote.origem_reserva === "faixa_manual" ? "Reserva por faixa" : "Automatico por quantidade"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Emenda</p>
                        <p>{lote.emenda_parlamentar || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Faixa completa</p>
                        <p className="font-mono text-xs">{lote.faixa_inicial} ate {lote.faixa_final}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Resumo detalhado</p>
                        <p>{lote.quantidade} reservadas, {lote.pendentes} pendentes, {lote.usadas} usadas e {lote.reutilizaveis} reutilizaveis</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">Nenhum lote reservado encontrado para este filtro.</div>
          )}
        </CardContent>
      </Card>

      {/* Manual label creation + generated labels list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Etiquetas a Imprimir ({labels.length})
              </CardTitle>
              <CardDescription>
                Fila temporaria da impressao atual. Aqui voce pode ajustar a descricao antes de imprimir as etiquetas enviadas manualmente, pelos bens acima ou por um lote reservado.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {labels.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 bg-transparent"
                  onClick={handleRegenerateNumbers}
                >
                  <RefreshCw className="h-4 w-4" />
                  Renumerar
                </Button>
              )}
              <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 bg-transparent">
                    <Hash className="h-4 w-4" />
                    Gerar Lote
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Gerar Lote de Etiquetas</DialogTitle>
                    <DialogDescription>
                      Reserve etiquetas automaticas por quantidade ou escolha uma faixa especifica.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Modo de reserva</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={batchMode === "automatico" ? "default" : "outline"}
                          className="justify-start"
                          onClick={() => setBatchMode("automatico")}
                        >
                          Automatico por quantidade
                        </Button>
                        <Button
                          type="button"
                          variant={batchMode === "faixa" ? "default" : "outline"}
                          className="justify-start"
                          onClick={() => setBatchMode("faixa")}
                        >
                          Escolher faixa
                        </Button>
                      </div>
                    </div>

                    {batchMode === "automatico" ? (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="quantity">Quantidade</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min={1}
                        value={batchQuantity}
                        onChange={(e) => setBatchQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                      <p className="text-sm text-muted-foreground">
                        Serao geradas {batchQuantity} etiquetas a partir de {generateProvNumber(ano, nextSeq)}.
                      </p>
                    </div>
                    ) : (
                      <>
                        <div className="grid gap-2">
                          <Label>Formato da faixa</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant={batchRangeMode === "quantidade" ? "default" : "outline"}
                              className="justify-start"
                              onClick={() => setBatchRangeMode("quantidade")}
                            >
                              Numero inicial + quantidade
                            </Button>
                            <Button
                              type="button"
                              variant={batchRangeMode === "final" ? "default" : "outline"}
                              className="justify-start"
                              onClick={() => setBatchRangeMode("final")}
                            >
                              Numero inicial + numero final
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="range-start">Numero inicial</Label>
                            <Input
                              id="range-start"
                              type="number"
                              min={1}
                              value={batchRangeStart}
                              onChange={(e) => setBatchRangeStart(e.target.value)}
                              placeholder={`Ex: ${nextSeq}`}
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="range-end">
                              {batchRangeMode === "quantidade" ? "Quantidade" : "Numero final"}
                            </Label>
                            <Input
                              id="range-end"
                              type="number"
                              min={1}
                              value={batchRangeMode === "quantidade" ? batchQuantity : batchRangeEnd}
                              onChange={(e) => {
                                const value = Math.max(1, parseInt(e.target.value) || 1)
                                if (batchRangeMode === "quantidade") {
                                  setBatchQuantity(value)
                                } else {
                                  setBatchRangeEnd(String(value))
                                }
                              }}
                              placeholder={batchRangeMode === "quantidade" ? "Ex: 50" : "Ex: 245"}
                            />
                          </div>
                        </div>
                        <div className="rounded-md border bg-muted/40 p-3 text-sm">
                          <p className="font-medium">Resumo da reserva por faixa</p>
                          <p className="text-muted-foreground">
                            Ano: {ano} | Faixa: {calculatedRangeStart > 0 && calculatedRangeEnd >= calculatedRangeStart
                              ? `${generateProvNumber(ano, calculatedRangeStart)} ate ${generateProvNumber(ano, calculatedRangeEnd)}`
                              : "Preencha a faixa"}
                          </p>
                          <p className="text-muted-foreground">
                            Quantidade total: {calculatedRangeQuantity || 0} | Modo: estrito
                          </p>
                          <p className="text-muted-foreground">
                            Se algum numero estiver bloqueado por bem ou reserva ativa, o lote nao sera criado.
                          </p>
                        </div>
                      </>
                    )}
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="batch-emenda">Emenda Parlamentar</Label>
                      <Input id="batch-emenda" value={batchEmenda} onChange={(e) => setBatchEmenda(e.target.value)} placeholder="Opcional" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="batch-observation">Observacao do lote</Label>
                      <Input id="batch-observation" value={batchObservation} onChange={(e) => setBatchObservation(e.target.value)} placeholder="Ex: Reserva para unidade X" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsBatchDialogOpen(false)} disabled={isGenerating}>Cancelar</Button>
                    <Button onClick={handleBatchGenerate} disabled={isGenerating}>
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        batchMode === "faixa" ? "Reservar Faixa" : "Gerar Etiquetas"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 bg-transparent">
                    <Plus className="h-4 w-4" />
                    Adicionar Manual
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Etiqueta Manual</DialogTitle>
                    <DialogDescription>
                      Crie uma etiqueta avulsa com descricao e emenda opcional.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="flex flex-col gap-2">
                      <Label>Numero que sera usado</Label>
                      <Input value={generateProvNumber(ano, nextSeq)} readOnly className="bg-muted font-mono" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="manual-descricao">Descricao</Label>
                      <Input
                        id="manual-descricao"
                        value={manualDescricao}
                        onChange={(e) => setManualDescricao(e.target.value)}
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="manual-emenda">Emenda Parlamentar</Label>
                      <Input
                        id="manual-emenda"
                        value={manualEmenda}
                        onChange={(e) => setManualEmenda(e.target.value)}
                        placeholder="Opcional"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsManualDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddManual}>Adicionar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {labels.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">QR</TableHead>
                    <TableHead>Numero</TableHead>
                    <TableHead>Descricao</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labels.map((label) => (
                    <TableRow key={label.id}>
                      <TableCell>
                        <QRCodeCanvas data={label.numero} size={40} className="rounded" />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs border-warning/50 text-warning">
                          {label.numero}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={label.descricao}
                          onChange={(e) =>
                            setLabels((prev) =>
                              prev.map((l) =>
                                l.id === label.id ? { ...l, descricao: e.target.value } : l
                              )
                            )
                          }
                          placeholder="Descricao do bem (opcional)"
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveLabel(label.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remover etiqueta</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center gap-2">
                <Tag className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  Nenhuma etiqueta adicionada
                </p>
                <p className="text-xs text-muted-foreground">
                  Selecione bens acima, adicione etiquetas manualmente ou envie um lote reservado para impressao
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(lotPendingCancellation)} onOpenChange={(open) => !open && setLotPendingCancellation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar saldo reservado deste lote?</AlertDialogTitle>
            <AlertDialogDescription>
              {lotPendingCancellation ? `Ao confirmar, as etiquetas ainda nao usadas do lote #${lotPendingCancellation.id} deixarao de ficar reservadas e voltarao para reuso. Etiquetas ja usadas nao serao alteradas.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (lotPendingCancellation) {
                  void handleCancelLot(lotPendingCancellation.id)
                }
                setLotPendingCancellation(null)
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print preview */}
      {showPreview && labels.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pre-visualizacao de Impressao</CardTitle>
            <CardDescription>
              Layout: {columns} coluna(s) | Tamanho: 5,0cm x 2,5cm | Total: {labels.length} etiquetas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border bg-card p-4 overflow-x-auto">
              <div
                className="flex flex-wrap"
                style={{ maxWidth: `${parseInt(columns) * 200}px` }}
              >
                {labels.map((label) => (
                  <div
                    key={label.id}
                    className="flex items-center gap-2 border border-dashed border-border p-2"
                    style={{
                      width: "189px",
                      height: "94px",
                    }}
                  >
                    <div
                      className="flex items-center gap-2 h-full w-full"
                      style={{
                        transform: `translate(${zebraConfig.offsetXMm + zebraConfig.offsetColuna2Mm}px, ${zebraConfig.offsetYMm}px)`,
                        padding: `${zebraConfig.innerPaddingMm}px`,
                      }}
                    >
                    <QRCodeCanvas data={label.numero} size={Math.max(36, zebraConfig.qrSizeMm * 3.5)} className="rounded shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col justify-center h-full text-left">
                      {(customTitle || zebraConfig.title) && (
                        <p className="text-[8px] font-bold uppercase truncate border-b border-black mb-1">
                          {customTitle || zebraConfig.title}
                        </p>
                      )}
                      {zebraConfig.subtitle && (
                        <p className="text-[7px] uppercase truncate mb-1">
                          {zebraConfig.subtitle}
                        </p>
                      )}
                      <p className="text-[10px] font-mono font-bold tracking-wide leading-none">
                        {label.numero}
                      </p>
                      {zebraConfig.showDescription && label.descricao && (
                        <p className="text-[8px] text-muted-foreground mt-0.5 truncate font-semibold">
                          {label.descricao}
                        </p>
                      )}
                      {zebraConfig.showEmenda && label.emenda && (
                        <p className="text-[7px] text-muted-foreground mt-0.5 truncate">
                          {label.emenda}
                        </p>
                      )}
                      {(showLocation || zebraConfig.showLocation) && label.localizacao && (
                        <p className="text-[6px] text-muted-foreground mt-0.5 truncate">
                          {[label.localizacao.departamento, label.localizacao.sala].filter(Boolean).join(" - ")}
                        </p>
                      )}
                      {zebraConfig.showFooter && (
                        <p className="text-[6px] text-muted-foreground/60 mt-auto text-right uppercase">
                          SisPatrimonio
                        </p>
                      )}
                    </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Escala aproximada. A impressao final sera em 5,0cm x 2,5cm por etiqueta.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
