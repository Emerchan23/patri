"use client"

import { SearchableSelect } from "@/components/ui/searchable-select"
import { GroupSelector } from "@/components/group-selector"
import { useState, useCallback, useRef, useEffect } from "react"
import useSWR, { mutate } from "swr"
import { api, fetcher, getApiErrorMessage, isApiError } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { WebcamModal } from "./webcam-modal"
import {
  Camera,
  Upload,
  FileText,
  FileUp,
  Package,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Edit,
  Copy,
  ChevronDown,
  ChevronUp,
  Hash,
  Save,
  X,
  ShoppingCart,
  FileCode2,
  Info,
  ScanBarcode,
  ExternalLink,
  ClipboardCopy,
  ImagePlus,
  ImageIcon,
  Download,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { AssetCategory } from "@/lib/data"
import { CategoriaSelector } from "@/components/categoria-selector"
import { MarcaSelector } from "@/components/marca-selector"
import { AssetSearchSelector } from "./asset-search-selector"
import { PatrimonioTypeSelector, PatrimonioType } from "@/components/patrimonio-type-selector"
import { ResponsavelSelect } from "@/components/responsavel-select"
import { FornecedorSelector } from "@/components/fornecedor-selector"

// Types for nota fiscal items
interface NotaFiscalItem {
  id: string
  descricaoOriginal: string
  descricaoEditada: string
  ncm: string
  cfop: string
  unidade: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  categoria: AssetCategory | ""
  grupo: string
  marca: string
  modelo: string
  tempoGarantia?: number
  emendaParlamentar?: string
  imagem?: string | null
  patrimonioInicial?: string
}

interface PatrimonioGerado {
  id: string
  itemId: string
  numero: string
  descricao: string
  categoria: AssetCategory | ""
  grupo: string
  marca: string
  modelo: string
  tempoGarantia?: number
  emendaParlamentar?: string
  valorUnitario: number
  indice: number
  total: number
  imagem?: string | null
}

interface NfInfo {
  numero: string
  serie: string
  chaveAcesso: string
  dataEmissao: string
  fornecedor: string
  documentoFornecedor: string
  nomeFantasiaFornecedor?: string
  enderecoFornecedor?: string
  cidadeFornecedor?: string
  estadoFornecedor?: string
  telefoneFornecedor?: string
  valorTotal: number
}

interface Fornecedor {
  id: string
  nome: string
  nome_fantasia?: string
  razao_social?: string
  cnpj?: string
  cidade?: string
  estado?: string
  endereco?: string
  telefone?: string
}

type FornecedorResolutionStatus =
  | "idle"
  | "resolving"
  | "reused"
  | "created"
  | "manual_required"
  | "manual_selected"
  | "error"

interface FornecedorResolution {
  status: FornecedorResolutionStatus
  nome: string
  documento: string
  fornecedorId?: string
  source: "xml" | "manual"
  message: string
}

type TipoEntradaBem =
  | "compra"
  | "aquisicao"
  | "doacao"
  | "transferencia"
  | "comodato"
  | "cessao"
  | "permuta"
  | "outro"

interface NotaFiscalSystemSettings {
  linkExtensaoXml?: string
  linkPortalSefaz?: string
}

const tipoEntradaOptions: Array<{ value: TipoEntradaBem; label: string }> = [
  { value: "compra", label: "Compra" },
  { value: "aquisicao", label: "Aquisição" },
  { value: "doacao", label: "Doação" },
  { value: "transferencia", label: "Transferência" },
  { value: "comodato", label: "Comodato" },
  { value: "cessao", label: "Cessão" },
  { value: "permuta", label: "Permuta" },
  { value: "outro", label: "Outro" },
]

const parsePatrimonioSequence = (value: string) => {
  const match = value.trim().match(/^(.*?)(\d+)$/)
  if (!match) return null
  return {
    prefix: match[1],
    nextNumber: parseInt(match[2], 10),
    padding: match[2].length,
  }
}

// XML NF-e parser
function parseNFeXml(xmlText: string): { info: NfInfo; itens: NotaFiscalItem[] } | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, "text/xml")

    // Check for parse errors
    const parseError = doc.querySelector("parsererror")
    if (parseError) return null

    // Helper to get text content from a tag
    const getText = (parent: Element | Document, tag: string): string => {
      const el = parent.getElementsByTagName(tag)[0]
      return el?.textContent?.trim() || ""
    }

    // Get NF info from <ide> and <emit>
    const ide = doc.getElementsByTagName("ide")[0]
    const emit = doc.getElementsByTagName("emit")[0]
    const total = doc.getElementsByTagName("ICMSTot")[0]
    const enderEmit = emit?.getElementsByTagName("enderEmit")[0]

    const supplierName = emit ? (getText(emit, "xFant") || getText(emit, "xNome")) : ""
    const supplierDocument = emit ? (getText(emit, "CNPJ") || getText(emit, "CPF")) : ""
    const supplierAddressParts = [
      enderEmit ? getText(enderEmit, "xLgr") : "",
      enderEmit ? getText(enderEmit, "nro") : "",
      enderEmit ? getText(enderEmit, "xBairro") : "",
    ].filter(Boolean)

    const info: NfInfo = {
      numero: ide ? getText(ide, "nNF") : "",
      serie: ide ? getText(ide, "serie") : "",
      chaveAcesso: "",
      dataEmissao: ide ? (getText(ide, "dhEmi") || getText(ide, "dEmi")) : "",
      fornecedor: supplierName,
      documentoFornecedor: supplierDocument,
      nomeFantasiaFornecedor: emit ? getText(emit, "xFant") : "",
      enderecoFornecedor: supplierAddressParts.join(", "),
      cidadeFornecedor: enderEmit ? getText(enderEmit, "xMun") : "",
      estadoFornecedor: enderEmit ? getText(enderEmit, "UF") : "",
      telefoneFornecedor: emit ? (getText(emit, "fone") || (enderEmit ? getText(enderEmit, "fone") : "")) : "",
      valorTotal: total ? parseFloat(getText(total, "vNF")) || 0 : 0,
    }

    // Try to get chave acesso from infNFe
    const infNFe = doc.getElementsByTagName("infNFe")[0]
    if (infNFe) {
      const id = infNFe.getAttribute("Id") || ""
      info.chaveAcesso = id.replace("NFe", "")
    }

    // Parse items from <det> elements
    const detElements = doc.getElementsByTagName("det")
    const itens: NotaFiscalItem[] = []

    for (let i = 0; i < detElements.length; i++) {
      const det = detElements[i]
      const prod = det.getElementsByTagName("prod")[0]
      if (!prod) continue

      const descOriginal = getText(prod, "xProd")
      const qCom = parseFloat(getText(prod, "qCom")) || 1
      const vUnCom = parseFloat(getText(prod, "vUnCom")) || 0
      const vProd = parseFloat(getText(prod, "vProd")) || qCom * vUnCom

      itens.push({
        id: `xml-item-${i}-${Date.now()}`,
        descricaoOriginal: descOriginal,
        descricaoEditada: smartCleanDescription(descOriginal),
        ncm: getText(prod, "NCM"),
        cfop: getText(prod, "CFOP"),
        unidade: getText(prod, "uCom"),
        quantidade: Math.round(qCom),
        valorUnitario: vUnCom,
        valorTotal: vProd,
        categoria: guessCategory(descOriginal),
        grupo: "",
        marca: "",
        modelo: "",
        emendaParlamentar: "",
        imagem: null,
      })
    }

    if (itens.length === 0) return null
    return { info, itens }
  } catch {
    return null
  }
}

// Smart description cleaning -- removes excessive uppercase and abbreviations
function smartCleanDescription(desc: string): string {
  if (!desc) return ""
  // If all uppercase, convert to title case
  if (desc === desc.toUpperCase()) {
    return desc
      .toLowerCase()
      .split(" ")
      .map((word) => {
        if (["de", "da", "do", "das", "dos", "em", "com", "para", "por", "e"].includes(word))
          return word
        return word.charAt(0).toUpperCase() + word.slice(1)
      })
      .join(" ")
  }
  return desc
}

// Auto-guess category from description
function guessCategory(desc: string): AssetCategory | "" {
  const d = desc.toLowerCase()
  if (
    d.includes("computador") ||
    d.includes("notebook") ||
    d.includes("impressora") ||
    d.includes("monitor") ||
    d.includes("scanner") ||
    d.includes("servidor") ||
    d.includes("mouse") ||
    d.includes("teclado") ||
    d.includes("ssd") ||
    d.includes("hd externo") ||
    d.includes("no-break") ||
    d.includes("nobreak") ||
    d.includes("projetor")
  )
    return "informatica"
  if (
    d.includes("mesa") ||
    d.includes("cadeira") ||
    d.includes("armario") ||
    d.includes("gaveteiro") ||
    d.includes("estante") ||
    d.includes("arquivo") ||
    d.includes("balcao") ||
    d.includes("sofa") ||
    d.includes("poltrona") ||
    d.includes("bancada")
  )
    return "movel"
  if (
    d.includes("ar condicionado") ||
    d.includes("refrigerador") ||
    d.includes("geladeira") ||
    d.includes("microondas") ||
    d.includes("bebedouro") ||
    d.includes("fogao") ||
    d.includes("ventilador") ||
    d.includes("purificador")
  )
    return "equipamento"
  if (
    d.includes("tv") ||
    d.includes("televisor") ||
    d.includes("caixa de som") ||
    d.includes("amplificador") ||
    d.includes("telefone") ||
    d.includes("camera") ||
    d.includes("radio")
  )
    return "eletronico"
  return ""
}

function generateProvId(): string {
  const ano = new Date().getFullYear()
  const seq = String(Math.floor(Math.random() * 99999)).padStart(5, "0")
  return `PROV-${ano}-${seq}`
}

function normalizeDocument(value: string): string {
  return value.replace(/\D/g, "")
}

function formatDocument(document: string): string {
  const normalized = normalizeDocument(document)
  if (normalized.length === 14) {
    return `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5, 8)}/${normalized.slice(8, 12)}-${normalized.slice(12)}`
  }
  if (normalized.length === 11) {
    return `${normalized.slice(0, 3)}.${normalized.slice(3, 6)}.${normalized.slice(6, 9)}-${normalized.slice(9)}`
  }
  return document
}

// Demo XML content removed for production
// const DEMO_XML_1 = ...
// const DEMO_XML_2 = ...

export function EntradaNotaFiscal() {
  const { toast } = useToast()
  const { data: systemSettings } = useSWR<NotaFiscalSystemSettings>("/configuracoes/sistema", fetcher)
  const { data: secretariasData } = useSWR("/secretarias?all=true", fetcher)
  const { data: fornecedoresData } = useSWR("/fornecedores?all=true", fetcher)
  const secretarias = (Array.isArray(secretariasData) ? secretariasData : (secretariasData?.data || [])) as any[]
  const fornecedores = (Array.isArray(fornecedoresData) ? fornecedoresData : (fornecedoresData?.data || [])) as Fornecedor[]
  const fileInputRef = useRef<HTMLInputElement>(null)
  const confirmSubmitLockRef = useRef(false)
  const [loading, setLoading] = useState(false)
  const [parseError, setParseError] = useState("")
  const [fileName, setFileName] = useState("")
  const [notaInfo, setNotaInfo] = useState<NfInfo | null>(null)
  const [itens, setItens] = useState<NotaFiscalItem[]>([])
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [patrimoniosGerados, setPatrimoniosGerados] = useState<PatrimonioGerado[]>([])
  const [step, setStep] = useState<"upload" | "edicao" | "confirmacao" | "concluido">("upload")
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [chaveNfCode, setChaveNfCode] = useState("")
  const [chaveCopied, setChaveCopied] = useState(false)
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const [webcamTarget, setWebcamTarget] = useState<string | null>(null)

  const handleWebcamCapture = (imageSrc: string) => {
    if (webcamTarget) {
      setItens((prev) =>
        prev.map((item) => {
          if (item.id !== webcamTarget) return item
          return { ...item, imagem: imageSrc }
        })
      )
      setWebcamTarget(null)
    }
  }

  // Location state
  const [secretariaSel, setSecretariaSel] = useState("")
  const [departamentoSel, setDepartamentoSel] = useState("")
  const [salaSel, setSalaSel] = useState("")
  const [responsavel, setResponsavel] = useState("")
  const [cargoResponsavel, setCargoResponsavel] = useState("")
  const [isCreatingDept, setIsCreatingDept] = useState(false)
  const [newDeptName, setNewDeptName] = useState("")
  const [isCreatingSala, setIsCreatingSala] = useState(false)
  const [newSalaName, setNewSalaName] = useState("")
  const [patrimonioTipo, setPatrimonioTipo] = useState<PatrimonioType>("provisorio")
  const [tipoEntrada, setTipoEntrada] = useState<TipoEntradaBem>("compra")
  const [patrimonioInicial, setPatrimonioInicial] = useState("")
  const [isManualProvisorio, setIsManualProvisorio] = useState(false)
  const [manualProvisorioStart, setManualProvisorioStart] = useState("")
  const [provAno, setProvAno] = useState(new Date().getFullYear().toString())
  const [notaFiscalPdf, setNotaFiscalPdf] = useState<string | null>(null)
  const [manualFornecedorSel, setManualFornecedorSel] = useState("")
  const [fornecedorResolution, setFornecedorResolution] = useState<FornecedorResolution>({
    status: "idle",
    nome: "",
    documento: "",
    source: "xml",
    message: "",
  })
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const [fieldErrors, setFieldErrors] = useState<string[]>([])
  const [itemFieldErrors, setItemFieldErrors] = useState<string[]>([])
  const [errorSummary, setErrorSummary] = useState<string[]>([])
  const autoCreatedSupplierDocsRef = useRef<Set<string>>(new Set())
  const supplierAttemptRef = useRef<string | null>(null)

  const scrollToFirstError = () => {
    window.setTimeout(() => {
      const firstError = document.querySelector("[data-field-error='true']")
      if (firstError) {
        ;(firstError as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }, 50)
  }

  const resolveSupplierDisplayName = useCallback((supplier?: Partial<Fornecedor> | null) => {
    if (!supplier) return ""
    return (
      supplier.nome_fantasia?.trim() ||
      supplier.nome?.trim() ||
      supplier.razao_social?.trim() ||
      ""
    )
  }, [])

  const getResolvedFornecedorName = useCallback(() => {
    if (fornecedorResolution.status === "manual_selected") {
      return manualFornecedorSel.trim()
    }
    return fornecedorResolution.nome.trim() || notaInfo?.fornecedor?.trim() || ""
  }, [fornecedorResolution.nome, fornecedorResolution.status, manualFornecedorSel, notaInfo?.fornecedor])

  const getResolvedFornecedorDocument = useCallback(() => {
    return fornecedorResolution.documento.trim() || notaInfo?.documentoFornecedor?.trim() || ""
  }, [fornecedorResolution.documento, notaInfo?.documentoFornecedor])

  useEffect(() => {
    if (!notaInfo) {
      setFornecedorResolution({
        status: "idle",
        nome: "",
        documento: "",
        source: "xml",
        message: "",
      })
      setManualFornecedorSel("")
      supplierAttemptRef.current = null
      return
    }

    const supplierName = notaInfo.fornecedor?.trim() || ""
    const normalizedDocument = normalizeDocument(notaInfo.documentoFornecedor || "")

    if (!supplierName) {
      setFornecedorResolution({
        status: "manual_required",
        nome: "",
        documento: normalizedDocument,
        source: "xml",
        message: "O XML não trouxe um nome de fornecedor utilizável. Selecione ou cadastre manualmente.",
      })
      return
    }

    if (manualFornecedorSel.trim()) {
      setFornecedorResolution({
        status: "manual_selected",
        nome: manualFornecedorSel.trim(),
        documento: normalizedDocument,
        source: "manual",
        message: "Fornecedor definido manualmente para esta nota fiscal.",
      })
      return
    }

    if (!normalizedDocument) {
      setFornecedorResolution({
        status: "manual_required",
        nome: supplierName,
        documento: "",
        source: "xml",
        message: "O XML não trouxe um documento válido do fornecedor. Selecione ou cadastre manualmente antes de confirmar.",
      })
      return
    }

    const existingSupplier = fornecedores.find((supplier) => normalizeDocument(supplier.cnpj || "") === normalizedDocument)
    if (existingSupplier) {
      const supplierLabel = resolveSupplierDisplayName(existingSupplier) || supplierName
      setFornecedorResolution({
        status: autoCreatedSupplierDocsRef.current.has(normalizedDocument) ? "created" : "reused",
        nome: supplierLabel,
        documento: normalizedDocument,
        fornecedorId: existingSupplier.id,
        source: "xml",
        message: autoCreatedSupplierDocsRef.current.has(normalizedDocument)
          ? "Fornecedor cadastrado automaticamente a partir do XML e vinculado a esta nota."
          : "Fornecedor já cadastrado no sistema e reaproveitado automaticamente.",
      })
      return
    }

    if (supplierAttemptRef.current === normalizedDocument) {
      return
    }

    supplierAttemptRef.current = normalizedDocument
    setFornecedorResolution({
      status: "resolving",
      nome: supplierName,
      documento: normalizedDocument,
      source: "xml",
      message: "Analisando o fornecedor do XML e verificando cadastro existente...",
    })

    let cancelled = false

    ;(async () => {
      try {
        const created = await api.createFornecedor({
          nome: notaInfo.nomeFantasiaFornecedor?.trim() || supplierName,
          nome_fantasia: notaInfo.nomeFantasiaFornecedor?.trim() || supplierName,
          razao_social: supplierName,
          cnpj: normalizedDocument,
          cidade: notaInfo.cidadeFornecedor?.trim() || undefined,
          estado: notaInfo.estadoFornecedor?.trim() || undefined,
          endereco: notaInfo.enderecoFornecedor?.trim() || undefined,
          telefone: notaInfo.telefoneFornecedor?.trim() || undefined,
        })

        if (cancelled) return

        autoCreatedSupplierDocsRef.current.add(normalizedDocument)
        await mutate("/fornecedores?all=true")
        setFornecedorResolution({
          status: "created",
          nome: String(created?.nome || notaInfo.nomeFantasiaFornecedor || supplierName),
          documento: normalizedDocument,
          fornecedorId: created?.id ? String(created.id) : undefined,
          source: "xml",
          message: "Fornecedor não existia no sistema e foi cadastrado automaticamente com os dados do XML.",
        })
      } catch (error) {
        if (cancelled) return

        if (isApiError(error) && error.status === 409) {
          const existingName =
            error.body?.existingSupplier?.nome?.toString().trim() ||
            notaInfo?.fornecedor?.trim()
          await mutate("/fornecedores?all=true")
          setFornecedorResolution({
            status: "reused",
            nome: existingName || supplierName,
            documento: normalizedDocument,
            fornecedorId: error.body?.existingSupplier?.id ? String(error.body.existingSupplier.id) : undefined,
            source: "xml",
            message: "Fornecedor já existia no sistema e foi reaproveitado automaticamente pelo documento.",
          })
          return
        }

        const fallbackMessage = normalizedDocument
          ? "Não foi possível resolver automaticamente o fornecedor do XML. Selecione ou cadastre manualmente para continuar."
          : "O fornecedor do XML não possui documento suficiente para cadastro automático."

        setFornecedorResolution({
          status: normalizedDocument ? "error" : "manual_required",
          nome: supplierName,
          documento: normalizedDocument,
          source: "xml",
          message: getApiErrorMessage(error, fallbackMessage),
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    fornecedores,
    manualFornecedorSel,
    notaInfo,
    resolveSupplierDisplayName,
  ])

  const validateCodeAvailability = async (
    codes: Array<{ code: string; field?: "patrimonio" | "patrimonioProvisorio"; itemIndex?: number }>,
    contextLabel: string
  ) => {
    if (codes.length === 0) return true

    const result = await api.validateBemCodes(codes)
    if (result.available) return true

    const firstConflict = result.conflicts?.[0]
    const code = firstConflict?.conflictingCode || firstConflict?.code
    const itemLabel =
      typeof firstConflict?.itemIndex === "number" && codes.length > 1
        ? ` no item ${Number(firstConflict.itemIndex) + 1}`
        : ""
    const message = code
      ? `O patrimônio ${code} já está em uso${itemLabel}. Ajuste a numeração antes de continuar.`
      : `${contextLabel} contém um patrimônio já utilizado.`

    setErrorSummary([message])
    toast({
      title: "Patrimônio já em uso",
      description: message,
      variant: "destructive",
      duration: 8000,
    })

    return false
  }

  const getDefinitivePrefix = (dateValue?: string | null) => {
    if (!dateValue) return `PAT-${new Date().getFullYear()}-`
    const parsed = new Date(dateValue)
    const year = Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear()
    return `PAT-${year}-`
  }

  const getAutomaticDefinitiveStart = async (prefix?: string) => {
    const effectivePrefix = prefix || getDefinitivePrefix(notaInfo?.dataEmissao || "")
    const res = await api.get(`/bens/next-number?prefix=${encodeURIComponent(effectivePrefix)}`)
    const nextNumber = Number(res?.nextNumber || 1)
    return `${effectivePrefix}${String(nextNumber).padStart(5, "0")}`
  }

  useEffect(() => {
    if (patrimonioTipo === "definitivo") {
      setPatrimonioInicial("")
    }
  }, [patrimonioTipo])

  const selectedSecretaria = secretarias.find((s: any) => s.nome === secretariaSel)
  const selectedDepartamento = selectedSecretaria?.departamentos.find(
    (d: any) => d.nome === departamentoSel
  )

  const supplierStatusBadge = (() => {
    switch (fornecedorResolution.status) {
      case "reused":
        return <Badge className="bg-success text-success-foreground">Fornecedor encontrado no sistema</Badge>
      case "created":
        return <Badge className="bg-primary text-primary-foreground">Fornecedor cadastrado automaticamente</Badge>
      case "manual_selected":
        return <Badge variant="secondary">Fornecedor definido manualmente</Badge>
      case "manual_required":
        return <Badge variant="outline" className="border-warning/60 text-warning">Ação manual necessária</Badge>
      case "error":
        return <Badge variant="destructive">Erro ao resolver fornecedor</Badge>
      case "resolving":
        return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Resolvendo fornecedor</Badge>
      default:
        return null
    }
  })()

  const handleCreateDept = async () => {
    if (!newDeptName.trim() || !selectedSecretaria) return
    try {
      const res = await api.createDepartamento(selectedSecretaria.id, { nome: newDeptName })
      if (res && res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      } else {
        toast({ title: "Sucesso", description: "Departamento criado!" })
        setNewDeptName("")
        setIsCreatingDept(false)
        mutate("/secretarias?all=true")
      }
    } catch (e) {
      toast({ title: "Erro", description: "Erro ao criar departamento", variant: "destructive" })
    }
  }

  const handleCreateSala = async () => {
    if (!newSalaName.trim() || !selectedDepartamento) return
    try {
      const res = await api.createSala(selectedDepartamento.id, { nome: newSalaName })
      if (res && res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      } else {
        toast({ title: "Sucesso", description: "Sala criada!" })
        setNewSalaName("")
        setIsCreatingSala(false)
        mutate("/secretarias?all=true")
      }
    } catch (e) {
      toast({ title: "Erro", description: "Erro ao criar sala", variant: "destructive" })
    }
  }

  const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0)
  const valorTotal = itens.reduce((sum, item) => sum + item.valorTotal, 0)

  const processXmlContent = useCallback((content: string, name: string) => {
    setLoading(true)
    setParseError("")

    // Small delay to show loading state
    setTimeout(() => {
      const result = parseNFeXml(content)
      if (!result) {
        setParseError(
          "Nao foi possivel ler o XML. Verifique se o arquivo e um XML de NF-e valido (padrao SEFAZ)."
        )
        setLoading(false)
        return
      }
      if (result.itens.length === 0) {
        setParseError("O XML foi lido mas nenhum item de produto foi encontrado.")
        setLoading(false)
        return
      }
      setFileName(name)
      setNotaInfo(result.info)
      setItens(result.itens)
      setStep("edicao")
      setLoading(false)
    }, 800)
  }, [])

  const handleFileSelect = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".xml")) {
        setParseError("Apenas arquivos .xml sao aceitos. Selecione o arquivo XML da NF-e.")
        return
      }
      setParseError("")
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        if (content) {
          processXmlContent(content, file.name)
        }
      }
      reader.onerror = () => {
        setParseError("Erro ao ler o arquivo. Tente novamente.")
      }
      reader.readAsText(file)
    },
    [processXmlContent]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelect(file)
      // Reset input so same file can be selected again
      e.target.value = ""
    },
    [handleFileSelect]
  )

  const handleDemoXml = useCallback(
    (xml: string, name: string) => {
      processXmlContent(xml, name)
    },
    [processXmlContent]
  )

  const handleUpdateItem = (itemId: string, field: keyof NotaFiscalItem, value: string | number) => {
    setItens((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
        const updated = { ...item, [field]: value }
        // Recalculate total when qty or unit price changes
        if (field === "quantidade" || field === "valorUnitario") {
          updated.valorTotal = updated.quantidade * updated.valorUnitario
        }
        return updated
      })
    )
    const itemFieldKey = `item-${itemId}-${field}`
    if (itemFieldErrors.includes(itemFieldKey)) {
      setItemFieldErrors((prev) => prev.filter((error) => error !== itemFieldKey))
    }
  }

  const handleUpdateItemFromAsset = (itemId: string, asset: any) => {
    setItens((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
        return {
             ...item,
             descricaoEditada: asset.descricao || item.descricaoEditada,
             categoria: asset.categoria || item.categoria,
             grupo: asset.grupo || item.grupo,
             marca: asset.marca || item.marca,
             modelo: asset.modelo || item.modelo,
             tempoGarantia: asset.tempoGarantia ? parseInt(asset.tempoGarantia) : item.tempoGarantia,
             emendaParlamentar: asset.emendaParlamentar || item.emendaParlamentar,
             imagem: asset.imagem || item.imagem
        }
      })
    )
    toast({
        title: "Dados aplicados",
        description: "Os dados do bem selecionado foram aplicados a este item.",
    })
  }

  const handleItemImageChange = (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      setItens((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item
          return { ...item, imagem: result }
        })
      )
      const itemFieldKey = `item-${itemId}-imagem`
      if (itemFieldErrors.includes(itemFieldKey)) {
        setItemFieldErrors((prev) => prev.filter((error) => error !== itemFieldKey))
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleRemoveItemImage = (itemId: string) => {
    setItens((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
        return { ...item, imagem: null }
      })
    )
  }

  const handleRemoveItem = (itemId: string) => {
    setItens((prev) => prev.filter((item) => item.id !== itemId))
  }

  const handleAddItem = () => {
    setItens((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        descricaoOriginal: "",
        descricaoEditada: "",
        ncm: "",
        cfop: "",
        unidade: "UN",
        quantidade: 1,
        valorUnitario: 0,
        valorTotal: 0,
        categoria: "",
        grupo: "",
        marca: "",
        modelo: "",
        tempoGarantia: undefined,
        emendaParlamentar: "",
        imagem: null,
        patrimonioInicial: "",
      },
    ])
  }

  const handleGerarPatrimonios = async () => {
    const newFieldErrors: string[] = []
    const newItemFieldErrors: string[] = []
    const summaryErrors: string[] = []

    if (!secretariaSel) { newFieldErrors.push("secretaria"); summaryErrors.push("Secretaria") }
    if (!departamentoSel) { newFieldErrors.push("departamento"); summaryErrors.push("Departamento") }
    if (!salaSel) { newFieldErrors.push("sala"); summaryErrors.push("Sala") }
    if (!responsavel) { newFieldErrors.push("responsavel"); summaryErrors.push("Responsavel") }
    if (!cargoResponsavel) { newFieldErrors.push("cargoResponsavel"); summaryErrors.push("Cargo do responsavel") }

    itens.forEach((item, index) => {
      const missingItemParts: string[] = []
      if (!item.categoria) { newItemFieldErrors.push(`item-${item.id}-categoria`); missingItemParts.push("categoria") }
      if (!item.grupo) { newItemFieldErrors.push(`item-${item.id}-grupo`); missingItemParts.push("grupo") }
      if (!item.imagem) { newItemFieldErrors.push(`item-${item.id}-imagem`); missingItemParts.push("imagem") }
      if (missingItemParts.length > 0) {
        summaryErrors.push(`Item ${index + 1}: ${missingItemParts.join(", ")}`)
      }
    })

    setFieldErrors(newFieldErrors)
    setItemFieldErrors(newItemFieldErrors)
    setErrorSummary(summaryErrors)

    if (summaryErrors.length > 0) {
      scrollToFirstError()
      toast({
        title: "Pendencias encontradas",
        description: "Corrija os campos destacados antes de gerar os patrimonios.",
        variant: "destructive"
      })
      return
    }

    setFieldErrors([])
    setItemFieldErrors([])
    setErrorSummary([])
    let currentPatNumber = 0
    let currentPatPrefix = ""
    let currentPatPadding = 0

    if (patrimonioTipo === "definitivo") {
      let patrimonioInicialEfetivo = patrimonioInicial.trim()
      if (!patrimonioInicialEfetivo) {
        patrimonioInicialEfetivo = await getAutomaticDefinitiveStart(getDefinitivePrefix(notaInfo?.dataEmissao || ""))
      }

      const match = patrimonioInicialEfetivo.match(/^(.*?)(\d+)$/)
      if (match) {
        currentPatPrefix = match[1]
        currentPatNumber = parseInt(match[2])
        currentPatPadding = match[2].length
      } else {
        toast({ title: "Erro", description: "Formato de patrimonio invalido. Use algo como PAT-001", variant: "destructive" })
        return
      }
    } else if (isManualProvisorio) {
      if (!manualProvisorioStart) {
        toast({ title: "Erro", description: "Informe o numero provisorio inicial.", variant: "destructive" })
        return
      }
      currentPatNumber = parseInt(manualProvisorioStart)
      if (isNaN(currentPatNumber)) {
        toast({ title: "Erro", description: "Numero provisorio invalido.", variant: "destructive" })
        return
      }
      currentPatPadding = manualProvisorioStart.length
    } else {
      try {
        const res = await api.get('/bens?limit=1')
        currentPatNumber = res?.meta?.nextProvisionalSeq || 1
      } catch (e) {
        console.error("Erro ao buscar sequencia provisoria:", e)
        currentPatNumber = 1
      }
      currentPatPadding = 5
    }

    const patrimonios: PatrimonioGerado[] = []
    const generatedCodes = new Map<string, number>()
    for (let itemIndex = 0; itemIndex < itens.length; itemIndex++) {
      const item = itens[itemIndex]
      if (patrimonioTipo === "definitivo" && item.patrimonioInicial) {
        const match = item.patrimonioInicial.match(/^(.*?)(\d+)$/)
        if (match) {
          currentPatPrefix = match[1]
          currentPatNumber = parseInt(match[2])
          currentPatPadding = match[2].length
        }
      }

      for (let i = 0; i < item.quantidade; i++) {
        let numeroPat = ""
        if (patrimonioTipo === "definitivo") {
          const numStr = String(currentPatNumber).padStart(currentPatPadding, '0')
          numeroPat = `${currentPatPrefix}${numStr}`
          currentPatNumber++
        } else {
          const numStr = String(currentPatNumber).padStart(currentPatPadding, '0')
          numeroPat = `PROV-${provAno}-${numStr}`
          currentPatNumber++
        }

        const normalizedCode = numeroPat.trim().toUpperCase()
        const previousItemIndex = generatedCodes.get(normalizedCode)
        if (typeof previousItemIndex === "number") {
          const conflictMessage = `O patrimônio ${numeroPat} foi gerado mais de uma vez entre os itens ${previousItemIndex + 1} e ${itemIndex + 1}. Ajuste os números iniciais antes de confirmar.`
          setErrorSummary([conflictMessage])
          toast({
            title: "Patrimônio duplicado na nota fiscal",
            description: conflictMessage,
            variant: "destructive",
            duration: 8000,
          })
          return
        }
        generatedCodes.set(normalizedCode, itemIndex)

        patrimonios.push({
          id: `pat-${item.id}-${i}`,
          itemId: item.id,
          numero: numeroPat,
          descricao: item.descricaoEditada || item.descricaoOriginal,
          categoria: item.categoria,
          grupo: item.grupo,
          marca: item.marca,
          modelo: item.modelo,
          tempoGarantia: item.tempoGarantia,
          emendaParlamentar: item.emendaParlamentar,
          valorUnitario: item.valorUnitario,
          indice: i + 1,
          total: item.quantidade,
          imagem: item.imagem,
        })
      }
    }

    const explicitCodes = patrimonios.map((pat, index) => ({
      code: pat.numero,
      field: patrimonioTipo === "definitivo" ? "patrimonio" as const : "patrimonioProvisorio" as const,
      itemIndex: index,
    }))

    const canContinue = await validateCodeAvailability(explicitCodes, "A numeração informada para a nota fiscal")
    if (!canContinue) {
      return
    }

    setPatrimoniosGerados(patrimonios)
    setStep("confirmacao")
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
      setNotaFiscalPdf(ev.target?.result as string)
      toast({
          title: "Sucesso",
          description: "PDF da Nota Fiscal anexado com sucesso!",
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleConfirmarEntrada = async () => {
    if (confirmSubmitLockRef.current) return
    const missingFields: string[] = []

    if (!secretariaSel) missingFields.push("Secretaria")
    if (!departamentoSel) missingFields.push("Departamento")
    if (!salaSel) missingFields.push("Sala")
    if (!responsavel) missingFields.push("Responsavel")

    if (missingFields.length > 0) {
      setErrorSummary(missingFields)
      scrollToFirstError()
      toast({
        title: "Campos Obrigatórios Faltando",
        description: `Por favor, preencha os seguintes campos: ${missingFields.join(", ")}.`,
        variant: "destructive",
        duration: 5000,
      })
      return
    }

    const resolvedFornecedor = getResolvedFornecedorName()
    if (!resolvedFornecedor) {
      const supplierMessage =
        fornecedorResolution.status === "manual_required"
          ? "O fornecedor da nota não pôde ser resolvido automaticamente. Selecione ou cadastre manualmente antes de confirmar."
          : fornecedorResolution.status === "error"
            ? "Houve um erro ao resolver o fornecedor da nota. Corrija manualmente antes de confirmar."
            : "A resolução do fornecedor ainda não foi concluída."
      setErrorSummary([supplierMessage])
      toast({
        title: "Fornecedor pendente",
        description: supplierMessage,
        variant: "destructive",
        duration: 6000,
      })
      return
    }

    if (fornecedorResolution.status === "resolving") {
      toast({
        title: "Aguarde a resolução do fornecedor",
        description: "O sistema ainda está validando o fornecedor importado pelo XML.",
        variant: "destructive",
      })
      return
    }

    confirmSubmitLockRef.current = true
    setLoading(true)
    try {
      const payloads = patrimoniosGerados.map((pat) => {
        const itemOrigem = itens.find((item) => item.id === pat.itemId)
        const itemTemInicioManual = Boolean(itemOrigem?.patrimonioInicial?.trim())
        const payload: any = {
          descricao: pat.descricao,
          categoria: pat.categoria || "outros",
          grupo: pat.grupo,
          marca: pat.marca,
          modelo: pat.modelo,
          valor: pat.valorUnitario,
          tempoGarantia: pat.tempoGarantia,
          emendaParlamentar: pat.emendaParlamentar,
          localizacao: {
            secretaria: secretariaSel,
            departamento: departamentoSel,
            sala: salaSel,
          },
          responsavel: {
            nome: responsavel,
            cargo: cargoResponsavel
          },
          dataAquisicao: notaInfo?.dataEmissao ? new Date(notaInfo.dataEmissao).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          estadoConservacao: "novo",
          status: "ativo",
          observacoes: `Importado via NF ${notaInfo?.numero} - Fornecedor: ${resolvedFornecedor}`,
          patrimonioTipo: patrimonioTipo,
          imagem: pat.imagem,
          fornecedor: resolvedFornecedor,
          notaFiscal: notaFiscalPdf,
          tipoEntrada,
        }

        if (patrimonioTipo === "definitivo") {
          if (itemTemInicioManual || patrimonioInicial.trim()) {
            payload.patrimonio = pat.numero
          }
        } else if (isManualProvisorio) {
          payload.patrimonioProvisorio = pat.numero
        } else {
          payload.patrimonioProvisorio = `PROV-${provAno}-AUTO`
          payload.patrimonioAutoGerado = true
        }

        return payload
      })

      await api.createBem(payloads)

      toast({
        title: "Sucesso",
        description: `${patrimoniosGerados.length} bens cadastrados com sucesso.`
      })
      setShowConfirmDialog(false)
      setStep("concluido")
      setErrorSummary([])
    } catch (error) {
      console.error(error)
      const message = isApiError(error) && error.status === 409
        ? (error.body?.conflictingCode
            ? `O patrimônio ${error.body.conflictingCode} já está em uso${typeof error.body?.itemIndex === "number" ? ` no item ${error.body.itemIndex + 1}` : ""}. Ajuste a numeração e tente novamente.`
            : getApiErrorMessage(error, "Erro ao salvar os bens."))
        : getApiErrorMessage(error, "Erro ao salvar os bens. Tente novamente.")
      setErrorSummary([message])
      toast({
        variant: "destructive",
        title: isApiError(error) && error.status === 409 ? "Patrimônio já existe" : "Erro",
        description: message
      })
    } finally {
      setLoading(false)
      confirmSubmitLockRef.current = false
    }
  }

  const handleCopyChave = useCallback(async () => {
    if (!chaveNfCode.trim()) return
    try {
      await navigator.clipboard.writeText(chaveNfCode.replace(/\D/g, ""))
      setChaveCopied(true)
      setTimeout(() => setChaveCopied(false), 2000)
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement("textarea")
      textArea.value = chaveNfCode.replace(/\D/g, "")
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setChaveCopied(true)
      setTimeout(() => setChaveCopied(false), 2000)
    }
  }, [chaveNfCode])

  const handleCopyAndOpenSefaz = useCallback(async () => {
    await handleCopyChave()
    window.open(
      systemSettings?.linkPortalSefaz || "https://www.fsist.com.br/",
      "_blank"
    )
  }, [handleCopyChave, systemSettings?.linkPortalSefaz])

  const handleNovaEntrada = () => {
    setFileName("")
    setNotaInfo(null)
    setItens([])
    setPatrimoniosGerados([])
    setStep("upload")
    setParseError("")
    setSecretariaSel("")
    setDepartamentoSel("")
    setSalaSel("")
    setResponsavel("")
    setCargoResponsavel("")
    setExpandedItem(null)
    setNotaFiscalPdf(null)
    setManualFornecedorSel("")
    setTipoEntrada("compra")
    setFornecedorResolution({
      status: "idle",
      nome: "",
      documento: "",
      source: "xml",
      message: "",
    })
    supplierAttemptRef.current = null
    autoCreatedSupplierDocsRef.current.clear()
  }

  // ========================
  // Step 1: Upload XML
  // ========================
  if (step === "upload") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={() => window.open(systemSettings?.linkExtensaoXml || "https://chromewebstore.google.com/detail/fsist-download-xml-nfe/jclbljmbidghoecicnjofjldjndabajp", "_blank")}
          >
            <Download className="h-4 w-4" />
            Baixar Extensão para Download de XML
          </Button>
        </div>
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Importar XML da Nota Fiscal Eletronica</CardTitle>
            </div>
            <CardDescription>
              Envie o arquivo XML da NF-e (formato SEFAZ) para importar todos os itens
              automaticamente. O sistema ira ler os produtos, quantidades e valores da nota.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {/* Upload area */}
            <div
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml"
                onChange={handleInputChange}
                className="hidden"
                aria-label="Selecionar arquivo XML da NF-e"
              />

              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <Loader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <p className="text-sm font-medium">Processando XML...</p>
                  <p className="text-xs text-muted-foreground">Lendo itens da nota fiscal</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <Upload className="h-7 w-7 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold">
                      Arraste o arquivo XML aqui ou{" "}
                      <button
                        type="button"
                        className="text-primary underline underline-offset-2 hover:text-primary/80"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        clique para selecionar
                      </button>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Aceita arquivos .xml no formato NF-e (padrao SEFAZ)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error message */}
            {parseError && (
              <div className="flex items-start gap-3 rounded-lg bg-destructive/10 p-4">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Erro ao importar XML</p>
                  <p className="text-xs text-destructive/80 mt-0.5">{parseError}</p>
                </div>
              </div>
            )}

            {/* Demo XMLs section removed for production */}
            {/* <div className="rounded-lg bg-muted p-4"> ... </div> */}
          </CardContent>
        </Card>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Como funciona?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                  1
                </div>
                <div>
                  <p className="text-sm font-medium">Importar XML</p>
                  <p className="text-xs text-muted-foreground">
                    Envie o arquivo XML da NF-e recebida do fornecedor
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                  2
                </div>
                <div>
                  <p className="text-sm font-medium">Revisar Itens</p>
                  <p className="text-xs text-muted-foreground">
                    Ajuste descricoes, quantidades, categorias e marcas
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                  3
                </div>
                <div>
                  <p className="text-sm font-medium">Definir Destino</p>
                  <p className="text-xs text-muted-foreground">
                    Selecione secretaria, departamento e responsavel
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                  4
                </div>
                <div>
                  <p className="text-sm font-medium">Gerar Patrimonios</p>
                  <p className="text-xs text-muted-foreground">
                    Cada unidade recebe um numero de patrimonio unico
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alternative: Barcode capture for NF code */}
        <Card className="border-2 border-warning/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ScanBarcode className="h-5 w-5 text-warning" />
              <CardTitle className="text-base">Nao tem o XML da NF-e?</CardTitle>
            </div>
            <CardDescription>
              Capture o codigo de 44 digitos da nota fiscal usando um leitor de codigo de barras,
              copie o codigo e consulte o XML no portal da SEFAZ para depois importar aqui.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="chave-nf" className="text-sm font-medium">
                Chave de Acesso da NF-e (44 digitos)
              </Label>
              <div className="flex gap-2">
                <Input
                  ref={barcodeInputRef}
                  id="chave-nf"
                  placeholder="Escaneie ou digite os 44 digitos da nota fiscal..."
                  value={chaveNfCode}
                  onChange={(e) => setChaveNfCode(e.target.value)}
                  className="font-mono text-sm"
                  maxLength={54}
                  autoFocus={false}
                />
              </div>
              {chaveNfCode.replace(/\D/g, "").length > 0 && chaveNfCode.replace(/\D/g, "").length !== 44 && (
                <p className="text-xs text-warning">
                  Codigo deve ter exatamente 44 digitos. Atual: {chaveNfCode.replace(/\D/g, "").length} digitos.
                </p>
              )}
              {chaveNfCode.replace(/\D/g, "").length === 44 && (
                <p className="text-xs text-success font-medium">
                  Codigo com 44 digitos capturado com sucesso!
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="gap-2 bg-transparent flex-1"
                disabled={chaveNfCode.replace(/\D/g, "").length !== 44}
                onClick={handleCopyChave}
              >
                <ClipboardCopy className="h-4 w-4" />
                {chaveCopied ? "Copiado!" : "Copiar Codigo"}
              </Button>
              <Button
                className="gap-2 flex-1"
                disabled={chaveNfCode.replace(/\D/g, "").length !== 44}
                onClick={handleCopyAndOpenSefaz}
              >
                <ExternalLink className="h-4 w-4" />
                Copiar e Abrir Portal SEFAZ
              </Button>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3">
              <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Como usar:</p>
                <ol className="list-decimal list-inside flex flex-col gap-1">
                  <li>Posicione o cursor no campo acima e escaneie o codigo de barras da NF com o leitor</li>
                  <li>{'Clique em "Copiar e Abrir Portal SEFAZ"'}</li>
                  <li>No portal da SEFAZ, cole o codigo e consulte a nota</li>
                  <li>Baixe o XML da nota e importe aqui no sistema</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <div className="flex items-start gap-3 rounded-lg bg-muted p-4">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Onde encontrar o XML da NF-e?</p>
            <p>
              O arquivo XML da Nota Fiscal Eletronica e disponibilizado pelo fornecedor no momento da
              compra, ou pode ser baixado no portal da SEFAZ do seu estado. O arquivo tem extensao .xml
              e contem todos os dados da nota fiscal em formato padronizado.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ========================
  // Step 2: Edit items
  // ========================
  if (step === "edicao") {
    return (
      <div className="flex flex-col gap-6">
        {/* NF info header */}
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-semibold">XML importado com sucesso</p>
                  <p className="text-xs text-muted-foreground">
                    {fileName}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1 text-xs">
                  <FileText className="h-3 w-3" />
                  NF {notaInfo?.numero}
                  {notaInfo?.serie ? `/${notaInfo.serie}` : ""}
                </Badge>
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Package className="h-3 w-3" />
                  {itens.length} tipos / {totalItens} unid.
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </Badge>
              </div>
            </div>
            {/* NF details row */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground border-t border-success/20 pt-3">
              <span>
                <span className="font-medium text-foreground">Fornecedor:</span> {notaInfo?.fornecedor}
              </span>
              {notaInfo?.documentoFornecedor && (
                <span>
                  <span className="font-medium text-foreground">Documento:</span>{" "}
                  {formatDocument(notaInfo.documentoFornecedor)}
                </span>
              )}
              {notaInfo?.dataEmissao && (
                <span>
                  <span className="font-medium text-foreground">Emissao:</span>{" "}
                  {new Intl.DateTimeFormat("pt-BR").format(
                    new Date(notaInfo.dataEmissao)
                  )}
                </span>
              )}
              {notaInfo?.chaveAcesso && (
                <span className="font-mono text-[10px] break-all">
                  <span className="font-medium text-foreground font-sans">Chave:</span>{" "}
                  {notaInfo.chaveAcesso}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={fornecedorResolution.status === "error" ? "border-destructive/40 bg-destructive/5" : "border-primary/20"}>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">Fornecedor da Nota Fiscal</CardTitle>
                <CardDescription>
                  O sistema tenta reaproveitar ou cadastrar automaticamente o fornecedor usando o documento do emitente.
                </CardDescription>
              </div>
              {supplierStatusBadge}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Nome do XML</p>
                <p className="text-sm font-medium">{notaInfo?.fornecedor || "Não informado"}</p>
              </div>
              <div className="rounded-lg border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Documento</p>
                <p className="text-sm font-medium">
                  {getResolvedFornecedorDocument() ? formatDocument(getResolvedFornecedorDocument()) : "Não identificado"}
                </p>
              </div>
              <div className="rounded-lg border bg-background/60 p-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Fornecedor que será usado</p>
                <p className="text-sm font-medium">{getResolvedFornecedorName() || "Pendente de definição"}</p>
              </div>
            </div>

            <div className="rounded-lg border bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-sm">{fornecedorResolution.message || "Aguardando dados do XML."}</p>
            </div>

            {(fornecedorResolution.status === "manual_required" || fornecedorResolution.status === "error") && (
              <div className="grid gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
                <div>
                  <p className="text-sm font-medium">Selecionar ou cadastrar fornecedor manualmente</p>
                  <p className="text-xs text-muted-foreground">
                    Use o cadastro já existente do sistema ou crie o fornecedor manualmente antes de concluir a entrada.
                  </p>
                </div>
                <div className="max-w-xl">
                  <FornecedorSelector
                    value={manualFornecedorSel}
                    onValueChange={setManualFornecedorSel}
                    placeholder="Selecione ou crie um fornecedor"
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <PatrimonioTypeSelector 
            value={patrimonioTipo}
            onChange={setPatrimonioTipo}
            provAno={provAno}
            setProvAno={setProvAno}
            manualProvisorio={isManualProvisorio}
            setManualProvisorio={setIsManualProvisorio}
            manualStartNumber={manualProvisorioStart}
            setManualStartNumber={setManualProvisorioStart}
        />

        {patrimonioTipo === "definitivo" && (
            <Card className="border-2 border-primary/20">
                <CardHeader>
                    <CardTitle className="text-base">Configuracao de Sequencia</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-2 max-w-xs">
                        <Label>Patrimonio Inicial (Opcional)</Label>
                        <Input 
                            placeholder="Ex: PAT-2026-00001" 
                            value={patrimonioInicial}
                            onChange={(e) => setPatrimonioInicial(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Se deixar em branco, o sistema gera automaticamente a sequencia definitiva para os {totalItens} itens.
                        </p>
                    </div>
                </CardContent>
            </Card>
        )}

        {errorSummary.length > 0 && (
          <Card className="border-destructive/40 bg-destructive/5" data-field-error="true">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    {errorSummary.length} pendencia(s) impedem a continuaÃ§Ã£o
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-destructive/90">
                    {errorSummary.slice(0, 6).map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Location shared for all items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Destino dos Bens</CardTitle>
            <CardDescription>
              Selecione o local onde os bens serao alocados. Voce podera movimentar
              individualmente depois.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="tipo-entrada-nf">Tipo de Entrada</Label>
                <Select value={tipoEntrada} onValueChange={(value: TipoEntradaBem) => setTipoEntrada(value)}>
                  <SelectTrigger id="tipo-entrada-nf">
                    <SelectValue placeholder="Selecione o tipo de entrada" />
                  </SelectTrigger>
                  <SelectContent>
                    {tipoEntradaOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sec-lote" required className={fieldErrors.includes("secretaria") ? "text-destructive" : ""}>Secretaria</Label>
                <SearchableSelect
                  value={secretariaSel}
                  onValueChange={(v) => {
                    setSecretariaSel(v)
                    setDepartamentoSel("")
                    setSalaSel("")
                    if (fieldErrors.includes("secretaria")) setFieldErrors(prev => prev.filter(e => e !== "secretaria"))
                  }}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar secretaria..."
                  className={fieldErrors.includes("secretaria") ? "border-destructive ring-offset-destructive" : ""}
                  items={secretarias.map((s) => ({
                    value: s.nome,
                    label: s.nome,
                  }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="dep-lote" required className={fieldErrors.includes("departamento") ? "text-destructive" : ""}>Departamento</Label>
                <div className="flex gap-2">
                  <div className="w-full">
                    <SearchableSelect
                      value={departamentoSel}
                      onValueChange={(v) => {
                        setDepartamentoSel(v)
                        setSalaSel("")
                        if (fieldErrors.includes("departamento")) setFieldErrors(prev => prev.filter(e => e !== "departamento"))
                      }}
                      disabled={!secretariaSel}
                      placeholder="Selecione o departamento"
                      searchPlaceholder="Buscar departamento..."
                      className={fieldErrors.includes("departamento") ? "border-destructive ring-offset-destructive" : ""}
                      items={selectedSecretaria?.departamentos.map((d: any) => ({
                        value: d.nome,
                        label: d.nome,
                      })) || []}
                    />
                  </div>
                  <Dialog open={isCreatingDept} onOpenChange={setIsCreatingDept}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon" disabled={!secretariaSel} title="Criar Departamento">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Novo Departamento</DialogTitle>
                      </DialogHeader>
                      <div className="flex gap-2 my-4">
                        <Input 
                          placeholder="Nome do departamento..." 
                          value={newDeptName}
                          onChange={(e) => setNewDeptName(e.target.value)}
                        />
                        <Button onClick={handleCreateDept}>Criar</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sala-lote" required className={fieldErrors.includes("sala") ? "text-destructive" : ""}>Sala</Label>
                <div className="flex gap-2">
                  <div className="w-full">
                    <SearchableSelect
                      value={salaSel}
                      onValueChange={(v) => {
                          setSalaSel(v)
                          if (fieldErrors.includes("sala")) setFieldErrors(prev => prev.filter(e => e !== "sala"))
                      }}
                      disabled={!departamentoSel}
                      placeholder="Selecione a sala"
                      searchPlaceholder="Buscar sala..."
                      className={fieldErrors.includes("sala") ? "border-destructive ring-offset-destructive" : ""}
                      items={selectedDepartamento?.salas.map((s: any) => {
                        const salaNome = typeof s === 'object' ? s.nome : s
                        return {
                          value: salaNome,
                          label: salaNome,
                        }
                      }) || []}
                    />
                  </div>
                  <Dialog open={isCreatingSala} onOpenChange={setIsCreatingSala}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon" disabled={!departamentoSel} title="Criar Sala">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Nova Sala</DialogTitle>
                      </DialogHeader>
                      <div className="flex gap-2 my-4">
                        <Input 
                          placeholder="Nome da sala..." 
                          value={newSalaName}
                          onChange={(e) => setNewSalaName(e.target.value)}
                        />
                        <Button onClick={handleCreateSala}>Criar</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label required className={fieldErrors.includes("responsavel") ? "text-destructive" : ""}>Responsavel</Label>
                <ResponsavelSelect 
                  value={responsavel}
                  onValueChange={(v) => {
                      setResponsavel(v)
                      if (fieldErrors.includes("responsavel")) setFieldErrors(prev => prev.filter(e => e !== "responsavel"))
                  }}
                  onSelect={(s) => {
                      setCargoResponsavel(s.cargo || "")
                      if (fieldErrors.includes("cargoResponsavel")) setFieldErrors(prev => prev.filter(e => e !== "cargoResponsavel"))
                  }}
                  placeholder="Selecione o responsável"
                  className={fieldErrors.includes("responsavel") ? "border-destructive ring-offset-destructive" : ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label required className={fieldErrors.includes("cargoResponsavel") ? "text-destructive" : ""}>Cargo</Label>
                <Input
                  id="cargo-lote"
                  placeholder="Cargo do responsavel"
                  value={cargoResponsavel || ""}
                  onChange={(e) => {
                      setCargoResponsavel(e.target.value)
                      if (fieldErrors.includes("cargoResponsavel")) setFieldErrors(prev => prev.filter(e => e !== "cargoResponsavel"))
                  }}
                  className={fieldErrors.includes("cargoResponsavel") ? "border-destructive focus-visible:ring-destructive" : ""}
                />

              </div>
              <div className="flex flex-col gap-2 col-span-full">
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
                        className="w-full sm:w-auto"
                        onClick={() => pdfInputRef.current?.click()}
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        {notaFiscalPdf ? "Alterar PDF" : "Selecionar PDF da NF"}
                    </Button>
                    {notaFiscalPdf && (
                        <div className="flex items-center gap-2">
                             <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                PDF Anexado
                             </Badge>
                             <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setNotaFiscalPdf(null)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">O arquivo PDF sera vinculado a todos os bens gerados nesta importacao.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items list */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Itens da Nota Fiscal</CardTitle>
                <CardDescription>
                  Edite as descricoes, quantidades e categorias. Clique em um item para expandir.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 bg-transparent" onClick={handleAddItem}>
                <Plus className="h-4 w-4" />
                Adicionar Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col">
              {itens.map((item, idx) => {
                const isExpanded = expandedItem === item.id
                return (
                  <div key={item.id} className="border-b border-border last:border-0">
                    {/* Summary row */}
                    <button
                      type="button"
                      className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50"
                      onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.descricaoEditada || item.descricaoOriginal || "Novo item"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.descricaoOriginal && item.descricaoEditada !== item.descricaoOriginal
                            ? `NF: ${item.descricaoOriginal}`
                            : item.ncm
                              ? `NCM: ${item.ncm}${item.cfop ? ` | CFOP: ${item.cfop}` : ""}`
                              : "Clique para editar"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {item.categoria && (
                          <Badge variant="outline" className="text-xs hidden sm:flex">
                            {item.categoria === "informatica"
                              ? "Informatica"
                              : item.categoria === "movel"
                                ? "Movel"
                                : item.categoria === "equipamento"
                                  ? "Equipamento"
                                  : item.categoria === "eletronico"
                                    ? "Eletronico"
                                    : item.categoria}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="gap-1">
                          <Copy className="h-3 w-3" />
                          {item.quantidade}x
                        </Badge>
                        <span className="text-sm font-medium tabular-nums hidden sm:inline">
                          R$ {item.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Expanded edit form */}
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/30 p-6">
                        
                        {/* Search existing asset */}
                        <div className="mb-6 p-3 bg-primary/5 rounded-lg border border-primary/20">
                            <Label className="text-xs font-medium text-primary mb-2 block">
                                Vincular a um cadastro existente (Opcional)
                            </Label>
                            <p className="text-xs text-muted-foreground mb-3">
                                Se este item ja existe no sistema (mesmo modelo), busque-o para preencher automaticamente a imagem, categoria e detalhes.
                            </p>
                            <AssetSearchSelector 
                                placeholder="Buscar bem existente para copiar dados..."
                                onSelect={(asset) => handleUpdateItemFromAsset(item.id, asset)}
                            />
                        </div>

                        {/* Info original XML */}
                        {item.descricaoOriginal && (
                            <div className="mb-6 rounded-lg bg-muted p-3 border border-border/50">
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                    Descricao original no XML:
                                </p>
                                <p className="text-sm font-mono text-foreground">{item.descricaoOriginal}</p>
                                {(item.ncm || item.cfop || item.unidade) && (
                                    <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-border/50">
                                    {item.ncm && (
                                        <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">
                                        NCM: {item.ncm}
                                        </Badge>
                                    )}
                                    {item.cfop && (
                                        <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">
                                        CFOP: {item.cfop}
                                        </Badge>
                                    )}
                                    {item.unidade && (
                                        <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">
                                        UN: {item.unidade}
                                        </Badge>
                                    )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col lg:flex-row gap-6">
                            
                          {/* Coluna da Imagem */}
                          <div className="w-full lg:w-1/4 min-w-[220px]">
                            <Label className="text-xs mb-2 block font-medium">Imagem (aplicada a todas as unidades)</Label>
                            <div data-field-error={itemFieldErrors.includes(`item-${item.id}-imagem`) ? "true" : undefined} className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 hover:bg-muted/50 transition-colors h-[220px] bg-background ${itemFieldErrors.includes(`item-${item.id}-imagem`) ? "border-destructive bg-destructive/5" : "border-border"}`}>
                              {item.imagem ? (
                                <>
                                  <img 
                                    src={item.imagem} 
                                    alt="Preview" 
                                    className="h-full w-full object-contain rounded-md" 
                                  />
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow-md"
                                    onClick={() => handleRemoveItemImage(item.id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <div className="flex flex-col items-center gap-4 w-full h-full justify-center">
                                  <label className="cursor-pointer flex flex-col items-center gap-3 text-center w-full hover:opacity-80 transition-opacity">
                                    <div className="p-3 bg-primary/10 rounded-full">
                                      <ImageIcon className="h-6 w-6 text-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-sm font-medium text-primary">Enviar foto</span>
                                        <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP</p>
                                    </div>
                                    <input 
                                      type="file" 
                                      className="hidden" 
                                      accept="image/*"
                                      onChange={(e) => handleItemImageChange(item.id, e)}
                                    />
                                  </label>
                                  
                                  <div className="relative w-full flex items-center px-4">
                                    <span className="w-full border-t border-border" />
                                    <span className="absolute left-1/2 -translate-x-1/2 bg-background px-2 text-[10px] text-muted-foreground uppercase font-medium">
                                      Ou
                                    </span>
                                  </div>

                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-[80%] gap-2 text-xs"
                                    onClick={() => setWebcamTarget(item.id)}
                                  >
                                    <Camera className="h-3.5 w-3.5" />
                                    Usar Webcam
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Coluna dos Campos */}
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 content-start">
                              
                            {patrimonioTipo === "definitivo" && (
                                <div className="col-span-full">
                                    <Label className="text-xs font-medium">Patrimonio Inicial (Opcional)</Label>
                                    <Input
                                        value={item.patrimonioInicial || ""}
                                        onChange={(e) =>
                                        handleUpdateItem(item.id, "patrimonioInicial", e.target.value)
                                        }
                                        placeholder="Ex: PAT-2025-0500"
                                        className="mt-1.5 font-mono"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Preencha para iniciar a sequencia deste item a partir deste numero.
                                    </p>
                                </div>
                            )}

                            <div className="col-span-full">
                                <Label className="text-xs font-medium" required>Descricao (editavel)</Label>
                                <Input
                                    value={item.descricaoEditada}
                                    onChange={(e) =>
                                    handleUpdateItem(item.id, "descricaoEditada", e.target.value)
                                    }
                                    placeholder="Ex: Ar Condicionado Split 12.000 BTUs"
                                    className="mt-1.5"
                                />
                            </div>

                            <div data-field-error={itemFieldErrors.includes(`item-${item.id}-categoria`) ? "true" : undefined} className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium" required>Categoria</Label>
                                <CategoriaSelector
                                    value={item.categoria}
                                    onValueChange={(v) =>
                                    handleUpdateItem(item.id, "categoria", v as AssetCategory)
                                    }
                                    placeholder="Selecione"
                                    className={itemFieldErrors.includes(`item-${item.id}-categoria`) ? "w-full border-destructive ring-offset-destructive" : "w-full"}
                                />
                            </div>

                            <div data-field-error={itemFieldErrors.includes(`item-${item.id}-grupo`) ? "true" : undefined} className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium">Grupo</Label>
                                <GroupSelector
                                    value={item.grupo}
                                    onValueChange={(v) => handleUpdateItem(item.id, "grupo", v)}
                                    placeholder="Grupo"
                                    className={itemFieldErrors.includes(`item-${item.id}-grupo`) ? "w-full border-destructive ring-offset-destructive" : "w-full"}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium">Marca</Label>
                                <MarcaSelector
                                    value={item.marca}
                                    onValueChange={(v) => handleUpdateItem(item.id, "marca", v)}
                                    placeholder="Selecione"
                                    className="w-full"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium">Modelo</Label>
                                <Input
                                    value={item.modelo}
                                    onChange={(e) => handleUpdateItem(item.id, "modelo", e.target.value)}
                                    placeholder="Ex: Wind-Free 12K"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium">Emenda Parlamentar</Label>
                                <Input
                                    value={item.emendaParlamentar || ""}
                                    onChange={(e) => handleUpdateItem(item.id, "emendaParlamentar", e.target.value)}
                                    placeholder="Nº da Emenda"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium">Garantia (meses)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    placeholder="Ex: 12"
                                    value={item.tempoGarantia || ""}
                                    onChange={(e) =>
                                    handleUpdateItem(
                                        item.id,
                                        "tempoGarantia",
                                        e.target.value ? parseInt(e.target.value) : ""
                                    )
                                    }
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium" required>Quantidade</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={item.quantidade}
                                    onChange={(e) =>
                                    handleUpdateItem(
                                        item.id,
                                        "quantidade",
                                        Math.max(1, Number.parseInt(e.target.value) || 1)
                                    )
                                    }
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium" required>Valor Unitario (R$)</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        value={item.valorUnitario}
                                        onChange={(e) =>
                                        handleUpdateItem(
                                            item.id,
                                            "valorUnitario",
                                            Number.parseFloat(e.target.value) || 0
                                        )
                                        }
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                            
                            {/* Resumo do item */}
                            <div className="col-span-full mt-2 pt-3 border-t border-border/50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="font-normal">
                                        Total: R$ {item.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                        (Serao gerados <span className="font-semibold text-foreground">{item.quantidade}</span> patrimonios)
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 h-8 px-2"
                                    onClick={() => handleRemoveItem(item.id)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Remover Item
                                </Button>
                            </div>

                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {itens.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Package className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum item na lista</p>
                  <Button variant="outline" size="sm" className="mt-3 bg-transparent" onClick={handleAddItem}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Adicionar Item
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary and action */}
        <Card className="border-2 border-primary/20">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Resumo:</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold">{itens.length}</span>
                  <span className="text-sm text-muted-foreground">tipos de equipamento</span>
                </div>
                <Separator orientation="vertical" className="h-4 hidden sm:block" />
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold">{totalItens}</span>
                  <span className="text-sm text-muted-foreground">patrimonios a gerar</span>
                </div>
                <Separator orientation="vertical" className="h-4 hidden sm:block" />
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold">
                    R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-sm text-muted-foreground">total</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleNovaEntrada} className="bg-transparent">
                  Cancelar
                </Button>
                <Button
                  onClick={handleGerarPatrimonios}
                  disabled={itens.length === 0}
                  className="gap-2"
                >
                  <Hash className="h-4 w-4" />
                  Gerar Patrimonios ({totalItens})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      <WebcamModal 
        isOpen={!!webcamTarget} 
        onClose={() => setWebcamTarget(null)} 
        onCapture={handleWebcamCapture} 
      />
      </div>
    )
  }

  // ========================
  // Step 3: Confirm patrimonios
  // ========================
  if (step === "confirmacao") {
    const groupedByItem: Record<string, PatrimonioGerado[]> = {}
    for (const pat of patrimoniosGerados) {
      if (!groupedByItem[pat.itemId]) groupedByItem[pat.itemId] = []
      groupedByItem[pat.itemId].push(pat)
    }

    return (
      <div className="flex flex-col gap-6">
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Confirme os patrimonios gerados</p>
                <p className="text-xs text-muted-foreground">
                  Revise a lista abaixo. Cada unidade recebeu um numero de patrimonio provisorio
                  unico. Apos confirmar, os bens serao cadastrados no sistema.
                </p>
              </div>
              <Badge className="bg-warning text-warning-foreground gap-1">
                <Hash className="h-3 w-3" />
                {patrimoniosGerados.length} patrimonios
              </Badge>
            </div>
          </CardContent>
        </Card>

        {secretariaSel && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="text-muted-foreground">Destino:</span>
                <span className="font-medium">{secretariaSel}</span>
                {departamentoSel && (
                  <>
                    <span className="text-muted-foreground">/</span>
                    <span className="font-medium">{departamentoSel}</span>
                  </>
                )}
                {salaSel && (
                  <>
                    <span className="text-muted-foreground">/</span>
                    <span className="font-medium">{salaSel}</span>
                  </>
                )}
                {responsavel && (
                  <>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="text-muted-foreground">Responsavel:</span>
                    <span className="font-medium">{responsavel}</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {Object.entries(groupedByItem).map(([itemId, pats]) => (
          <Card key={itemId}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">{pats[0].descricao}</CardTitle>
                  <CardDescription>
                    {pats[0].marca} {pats[0].modelo}
                    {pats[0].marca || pats[0].modelo ? " - " : ""}
                    {pats.length} unidade{pats.length > 1 ? "s" : ""}
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  R${" "}
                  {(pats[0].valorUnitario * pats.length).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Patrimonio Provisorio</TableHead>
                      <TableHead>Descricao</TableHead>
                      <TableHead className="text-right">Valor Unit.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pats.map((pat) => (
                      <TableRow key={pat.id}>
                        <TableCell className="text-muted-foreground text-xs">
                          {pat.indice}/{pat.total}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="font-mono text-xs border-warning/50 text-warning"
                          >
                            {pat.numero}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{pat.descricao}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          R${" "}
                          {pat.valorUnitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setStep("edicao")}
            className="gap-2 bg-transparent"
          >
            <Edit className="h-4 w-4" />
            Voltar e Editar
          </Button>
          <Button onClick={() => setShowConfirmDialog(true)} className="gap-2" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {loading ? "Processando..." : `Confirmar Entrada (${patrimoniosGerados.length} bens)`}
          </Button>
        </div>

        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar Entrada em Lote</DialogTitle>
              <DialogDescription>
                Voce esta prestes a cadastrar {patrimoniosGerados.length} bens patrimoniais no
                sistema. Cada um recebera um numero de patrimonio provisorio.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-muted p-4">
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nota Fiscal:</span>
                  <span className="font-medium">
                    NF {notaInfo?.numero}
                    {notaInfo?.serie ? `/${notaInfo.serie}` : ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fornecedor:</span>
                  <span className="font-medium">{getResolvedFornecedorName() || notaInfo?.fornecedor}</span>
                </div>
                {getResolvedFornecedorDocument() && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Documento:</span>
                    <span className="font-medium">{formatDocument(getResolvedFornecedorDocument())}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipos de equipamento:</span>
                  <span className="font-medium">{itens.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total de bens:</span>
                  <span className="font-medium">{patrimoniosGerados.length}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor total:</span>
                  <span className="font-bold">
                    R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirmDialog(false)}
                className="bg-transparent"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button onClick={handleConfirmarEntrada} className="gap-2" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {loading ? "Confirmando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ========================
  // Step 4: Complete
  // ========================
  return (
    <div className="flex flex-col gap-6">
      <Card className="border-success/30">
        <CardContent className="flex flex-col items-center py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10 mb-4">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-xl font-bold mb-1">Entrada Realizada com Sucesso!</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
            {patrimoniosGerados.length} bens foram cadastrados no sistema com numeros de patrimonio
            provisorios. Voce pode consulta-los na lista de bens ou na tela de pendencias para
            atribuir os numeros definitivos.
          </p>

          <div className="w-full max-w-lg rounded-lg bg-muted p-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Nota Fiscal</span>
                <span className="font-medium">
                  NF {notaInfo?.numero}
                  {notaInfo?.serie ? `/${notaInfo.serie}` : ""}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fornecedor</span>
                <span className="font-medium">{getResolvedFornecedorName() || notaInfo?.fornecedor}</span>
              </div>
              {getResolvedFornecedorDocument() && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Documento</span>
                  <span className="font-medium">{formatDocument(getResolvedFornecedorDocument())}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Arquivo</span>
                <span className="font-medium text-xs font-mono">{fileName}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bens cadastrados</span>
                <Badge className="bg-success text-success-foreground">
                  {patrimoniosGerados.length} bens
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Valor total</span>
                <span className="font-bold">
                  R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
              {secretariaSel && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Destino</span>
                    <span className="font-medium text-right">
                      {departamentoSel || secretariaSel}
                      {salaSel && ` - ${salaSel}`}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="w-full max-w-lg mt-6">
            <p className="text-sm font-medium mb-3">Patrimonios gerados:</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {patrimoniosGerados.slice(0, 12).map((pat) => (
                <div
                  key={pat.id}
                  className="flex flex-col rounded-lg border border-border p-2 text-center"
                >
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] border-warning/50 text-warning mx-auto"
                  >
                    {pat.numero}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">{pat.descricao}</p>
                </div>
              ))}
              {patrimoniosGerados.length > 12 && (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-2">
                  <span className="text-xs text-muted-foreground">
                    +{patrimoniosGerados.length - 12} mais
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <Button variant="outline" onClick={handleNovaEntrada} className="gap-2 bg-transparent">
              <FileUp className="h-4 w-4" />
              Nova Importacao
            </Button>
            <Button className="gap-2" asChild>
              <a href="/bens">
                <Package className="h-4 w-4" />
                Ver Bens Cadastrados
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
      <WebcamModal 
        isOpen={!!webcamTarget} 
        onClose={() => setWebcamTarget(null)} 
        onCapture={handleWebcamCapture} 
      />
    </div>
  )
}
