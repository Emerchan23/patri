"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Clock,
  CheckCircle2,
  Save,
  AlertTriangle,
  Package,
  Car,
  Info,
  FileText,
  Plus,
  ImagePlus,
  X,
  ImageIcon,
  Camera,
  Maximize2,
  Minimize2,
} from "lucide-react"
import { api, fetcher, getApiErrorMessage, isApiError } from "@/lib/api-client"
import useSWR, { mutate } from "swr"
import type { AssetCategory } from "@/lib/data"
import { Trash2 } from "lucide-react"
import { EntradaNotaFiscal } from "./entrada-nota-fiscal"
import { DatePicker } from "@/components/ui/date-picker"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { AssetSearchSelector } from "./asset-search-selector"
import { GroupSelector } from "@/components/group-selector"
import { MarcaSelector } from "@/components/marca-selector"
import { FornecedorSelector } from "@/components/fornecedor-selector"
import { CategoriaSelector } from "@/components/categoria-selector"
import { useToast } from "@/components/ui/use-toast"
import { PatrimonioTypeSelector } from "@/components/patrimonio-type-selector"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { WebcamModal } from "./webcam-modal"

interface LoteItem {
  id: string
  descricao: string
  categoria: string
  grupo: string
  marca: string
  modelo: string
  fornecedor: string
  valor: string
  tempoGarantia?: string
  quantidade: number
  imagem?: string | null
  patrimonioInicial?: string
  emendaParlamentar?: string
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

interface Categoria {
  id: string
  nome: string
  slug: string
}

interface Marca {
  id: string
  nome: string
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

import { ResponsavelSelect } from "@/components/responsavel-select"
import { useAuth } from "@/lib/auth-context"

const parsePatrimonioSequence = (value: string) => {
  const match = value.trim().match(/^(.*?)(\d+)$/)
  if (!match) return null
  return {
    prefix: match[1],
    nextNumber: parseInt(match[2], 10),
    padding: match[2].length,
  }
}

const buildSequentialCodes = (initialCode: string, quantity: number) => {
  const parsed = parsePatrimonioSequence(initialCode)
  if (!parsed) return null

  return Array.from({ length: quantity }, (_, index) => ({
    code: `${parsed.prefix}${String(parsed.nextNumber + index).padStart(parsed.padding, "0")}`,
    itemIndex: index,
  }))
}

const formatLocalConflictMessage = (code: string, firstItemIndex: number, secondItemIndex: number) =>
  `O patrimônio ${code} foi gerado mais de uma vez entre os itens ${firstItemIndex + 1} e ${secondItemIndex + 1}. Ajuste os números iniciais antes de cadastrar.`

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

export function CadastroForm() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const { data: categoriasData } = useSWR("/categorias?all=true", fetcher)
  const categorias = Array.isArray(categoriasData) ? categoriasData : (categoriasData?.data || [])

  const { data: marcasData } = useSWR("/marcas?all=true", fetcher)
  const marcas = Array.isArray(marcasData) ? marcasData : (marcasData?.data || [])

  const { data: secretariasData } = useSWR("/secretarias?all=true", fetcher)
  const secretarias = Array.isArray(secretariasData) ? secretariasData : (secretariasData?.data || [])
  
  // Pre-fill location for assistants
  useEffect(() => {
    if (user?.role === "assistente" && user.unidade) {
        setSecretariaSel(user.unidade.secretaria)
        setDepartamentoSel(user.unidade.departamentos?.[0] || user.unidade.departamento || "")
    }
  }, [user])
  
  // Pre-fetch groups
  useSWR("/api/bens/grupos", fetcher)

  const currentYear = new Date().getFullYear().toString()
  const [modoEntrada, setModoEntrada] = useState<"individual" | "nota-fiscal" | "lote">("individual")
  const [patrimonioTipo, setPatrimonioTipo] = useState<"definitivo" | "provisorio">("provisorio")
  const [provAno, setProvAno] = useState(currentYear)
  const [isManualProvisorio, setIsManualProvisorio] = useState(false)
  const [manualProvisorio, setManualProvisorio] = useState("")

  useEffect(() => {
    if (patrimonioTipo === "definitivo" && modoEntrada === "lote") {
      setLotePatrimonioInicial("")
    }
  }, [patrimonioTipo, modoEntrada])
  const [isValidatingTag, setIsValidatingTag] = useState(false)
  const [tagValidationMsg, setTagValidationMsg] = useState<{type: 'success'|'error'|'warning', msg: string} | null>(null)
  const [categoria, setCategoria] = useState<string>("")
  const [grupo, setGrupo] = useState<string>("")
  const [marcaSel, setMarcaSel] = useState("")
  const [fornecedorSel, setFornecedorSel] = useState("")
  const [quantidade, setQuantidade] = useState(1)
  const [secretariaSel, setSecretariaSel] = useState("")
  const [departamentoSel, setDepartamentoSel] = useState("")
  const [salaSel, setSalaSel] = useState("")
  const [estadoConservacao, setEstadoConservacao] = useState("novo")
  const [dataAquisicao, setDataAquisicao] = useState<Date | undefined>(new Date())
  const [valorIndividual, setValorIndividual] = useState("")
  const [tempoGarantia, setTempoGarantia] = useState("")
  const [emendaParlamentar, setEmendaParlamentar] = useState("")
  const [saved, setSaved] = useState(false)
  const [savedMessage, setSavedMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const individualSubmitLockRef = useRef(false)
  const loteSubmitLockRef = useRef(false)
  const [submitErrorSummary, setSubmitErrorSummary] = useState<string[]>([])
  const [loteSubmitErrorSummary, setLoteSubmitErrorSummary] = useState<string[]>([])
  const [imagemPreview, setImagemPreview] = useState<string | null>(null)
  const [notaFiscalPdf, setNotaFiscalPdf] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Webcam state
  const [webcamTarget, setWebcamTarget] = useState<string | null>(null) // 'individual' or lote item ID

  const handleWebcamCapture = (imageSrc: string) => {
    if (webcamTarget === 'individual') {
      setImagemPreview(imageSrc)
    } else if (webcamTarget) {
      // É um item do lote
      setLoteItems((prev) =>
        prev.map((item) => (item.id === webcamTarget ? { ...item, imagem: imageSrc } : item))
      )
    }
    setWebcamTarget(null)
  }

  // State for controlled inputs
  const [descricao, setDescricao] = useState("")
  const [modelo, setModelo] = useState("")
  const [serie, setSerie] = useState("")
  const [patrimonioManual, setPatrimonioManual] = useState("")
  const [observacoes, setObservacoes] = useState("")
  const [tipoEntrada, setTipoEntrada] = useState<TipoEntradaBem>("compra")
  const [placa, setPlaca] = useState("")
  const [anoVeiculo, setAnoVeiculo] = useState("")
  const [kmAtualVeiculo, setKmAtualVeiculo] = useState("")
  
  // Lote manual state
  const [loteItems, setLoteItems] = useState<LoteItem[]>([
    { id: "1", descricao: "", categoria: "", grupo: "", marca: "", modelo: "", fornecedor: "", valor: "", tempoGarantia: "", quantidade: 1, imagem: null, patrimonioInicial: "", emendaParlamentar: "" },
  ])
  const [loteSaved, setLoteSaved] = useState(false)
  const [loteSavedMessage, setLoteSavedMessage] = useState("")
  const [lotePatrimonioInicial, setLotePatrimonioInicial] = useState("")
  const [isTableMaximized, setIsTableMaximized] = useState(false)

  const getDefinitivePrefix = (date?: Date | string | null) => {
    if (!date) return `PAT-${new Date().getFullYear()}-`
    const parsed = typeof date === "string" ? new Date(date) : date
    const year = Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear()
    return `PAT-${year}-`
  }

  const getAutomaticDefinitiveStart = async (prefix?: string) => {
    const effectivePrefix = prefix || getDefinitivePrefix(new Date())
    const res = await api.get(`/bens/next-number?prefix=${encodeURIComponent(effectivePrefix)}`)
    const nextNumber = Number(res?.nextNumber || 1)
    return `${effectivePrefix}${String(nextNumber).padStart(5, "0")}`
  }

  // Responsavel state (shared)
  const [responsavelNome, setResponsavelNome] = useState("")
  const [responsavelCargo, setResponsavelCargo] = useState("")

  const [isCreatingDept, setIsCreatingDept] = useState(false)
  const [newDeptName, setNewDeptName] = useState("")
  const [isCreatingSala, setIsCreatingSala] = useState(false)
  const [newSalaName, setNewSalaName] = useState("")

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
    const generatedManualCodes = new Map<string, number>()

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagemPreview(ev.target?.result as string)
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
      setNotaFiscalPdf(ev.target?.result as string)
      toast({
          title: "Sucesso",
          description: "PDF da Nota Fiscal anexado com sucesso!",
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const selectedSecretaria = (secretarias as Secretaria[]).find((s) => s.nome === secretariaSel)
  const selectedDepartamento = selectedSecretaria?.departamentos.find(
    (d) => d.nome === departamentoSel
  )

  const formatCurrency = (value: string) => {
    const onlyDigits = value.replace(/\D/g, "")
    if (onlyDigits === "") return ""
    const numberValue = Number(onlyDigits) / 100
    return numberValue.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  const parseCurrency = (value: string) => {
    return Number(value.replace(/\D/g, "")) / 100
  }

  const handleManualTagBlur = async () => {
    if (!manualProvisorio || manualProvisorio.length < 5) {
      setTagValidationMsg(null)
      return
    }

    setIsValidatingTag(true)
    try {
      const response = await fetch(`/api/bens/validar-etiqueta?codigo=${manualProvisorio}`)
      const data = await response.json()

      if (!data.valid) {
        setTagValidationMsg({ type: 'error', msg: data.message })
      } else if (!data.exists) {
        setTagValidationMsg({ type: 'warning', msg: data.message })
      } else {
        setTagValidationMsg({ type: 'success', msg: "Etiqueta válida e disponível." })
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsValidatingTag(false)
    }
  }

  const [fieldErrors, setFieldErrors] = useState<string[]>([])
  const [loteFieldErrors, setLoteFieldErrors] = useState<string[]>([])

  const scrollToFirstError = () => {
    window.setTimeout(() => {
      const firstError = document.querySelector("[data-field-error='true']")
      if (firstError) {
        ;(firstError as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }, 50)
  }

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
        ? ` na posição ${Number(firstConflict.itemIndex) + 1}`
        : ""
    const message = code
      ? `O patrimônio ${code} já está em uso${itemLabel}. Ajuste a numeração informada antes de continuar.`
      : `${contextLabel} contém um patrimônio já utilizado.`

    toast({
      title: "Patrimônio já em uso",
      description: message,
      variant: "destructive",
      duration: 8000,
    })

    return false
  }

  const handleSave = async () => {
    if (individualSubmitLockRef.current) return
    const missingFields: string[] = []
    const newFieldErrors: string[] = []

    if (!descricao) { missingFields.push("Descrição"); newFieldErrors.push("descricao") }
    if (!categoria) { missingFields.push("Categoria"); newFieldErrors.push("categoria") }
    if (!grupo) { missingFields.push("Grupo"); newFieldErrors.push("grupo") }
    if (!secretariaSel) { missingFields.push("Secretaria"); newFieldErrors.push("secretaria") }
    if (!departamentoSel) { missingFields.push("Departamento"); newFieldErrors.push("departamento") }
    if (!salaSel) { missingFields.push("Sala"); newFieldErrors.push("sala") }
    if (!valorIndividual) { missingFields.push("Valor"); newFieldErrors.push("valor") }
    if (!dataAquisicao) { missingFields.push("Data de Aquisição"); newFieldErrors.push("dataAquisicao") }
    if (!responsavelNome) { missingFields.push("Nome do Responsável"); newFieldErrors.push("responsavelNome") }
    if (!responsavelCargo) { missingFields.push("Cargo do Responsável"); newFieldErrors.push("responsavelCargo") }
    if (!imagemPreview) { missingFields.push("Imagem do Bem"); newFieldErrors.push("imagem") }

    if (patrimonioTipo === "definitivo") {
      if (!patrimonioManual.trim()) { missingFields.push("Número do Patrimônio"); newFieldErrors.push("patrimonio") }
    } else if (isManualProvisorio && !manualProvisorio) {
      missingFields.push("Número Provisório")
      newFieldErrors.push("manualProvisorio")
    }

    setFieldErrors(newFieldErrors)
    setSubmitErrorSummary(missingFields)

    if (missingFields.length > 0) {
      scrollToFirstError()
      toast({
        title: "Campos Obrigatórios Faltando",
        description: (
          <div className="flex flex-col gap-1">
            <p>Por favor, preencha os seguintes campos obrigatórios:</p>
            <ul className="list-disc pl-4 text-xs">
              {missingFields.map((field, i) => <li key={i}>{field}</li>)}
            </ul>
          </div>
        ),
        variant: "destructive",
        duration: 6000,
      })
      return
    }

    individualSubmitLockRef.current = true
    setIsSubmitting(true)
    try {
      const baseData: any = {
        descricao,
        categoria,
        grupo,
        marca: marcaSel,
        modelo,
        fornecedor: fornecedorSel,
        numeroSerie: serie,
        dataAquisicao: dataAquisicao ? dataAquisicao.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        valor: parseCurrency(valorIndividual),
        tempoGarantia: tempoGarantia ? parseInt(tempoGarantia) : undefined,
        estadoConservacao,
        localizacao: {
          secretaria: secretariaSel,
          departamento: departamentoSel,
          sala: salaSel,
        },
        responsavel: {
          nome: responsavelNome,
          cargo: responsavelCargo,
        },
        status: "ativo",
        patrimonioTipo,
        quantidade,
        imagem: imagemPreview,
        notaFiscal: notaFiscalPdf,
        emendaParlamentar,
        observacoes,
        tipoEntrada,
      }

      if (patrimonioTipo === "definitivo") {
        baseData.patrimonio = patrimonioManual.trim()
      } else if (isManualProvisorio) {
        const cleanCode = manualProvisorio.replace(/^PROV-\d{4}-/, '')
        baseData.patrimonioProvisorio = `PROV-${provAno}-${cleanCode}`
      } else {
        baseData.patrimonioProvisorio = `PROV-${provAno}-AUTO`
        baseData.patrimonioAutoGerado = true
      }

      if (categoria.includes("veicul")) {
        baseData.placa = placa
        baseData.ano = parseInt(anoVeiculo || "0")
        baseData.kmAtual = parseInt(kmAtualVeiculo || "0")
      }

      const codesToValidate: Array<{ code: string; field?: "patrimonio" | "patrimonioProvisorio"; itemIndex?: number }> = []
      if (patrimonioTipo === "definitivo") {
        const patrimonioInicial = patrimonioManual.trim()
        if (patrimonioInicial) {
          const generatedCodes = quantidade > 1
            ? buildSequentialCodes(patrimonioInicial, quantidade)
            : [{ code: patrimonioInicial, itemIndex: 0 }]

          if (!generatedCodes) {
            toast({
              title: "Formato inválido",
              description: "Use um patrimônio com sequência numérica final, como PAT-2026-00001.",
              variant: "destructive",
            })
            return
          }

          codesToValidate.push(...generatedCodes.map((item) => ({ ...item, field: "patrimonio" as const })))
        }
      } else if (isManualProvisorio) {
        const provisionalCode = `PROV-${provAno}-${manualProvisorio.replace(/^PROV-\d{4}-/, '')}`
        const generatedCodes = quantidade > 1
          ? buildSequentialCodes(provisionalCode, quantidade)
          : [{ code: provisionalCode, itemIndex: 0 }]

        if (!generatedCodes) {
          toast({
            title: "Formato inválido",
            description: "Use um número provisório com sequência numérica final.",
            variant: "destructive",
          })
          return
        }

        codesToValidate.push(...generatedCodes.map((item) => ({ ...item, field: "patrimonioProvisorio" as const })))
      }

      const canContinue = await validateCodeAvailability(codesToValidate, "O patrimônio informado")
      if (!canContinue) {
        setSubmitErrorSummary([codesToValidate[0] ? `O patrimônio ${codesToValidate[0].code} precisa ser ajustado antes do cadastro.` : "A numeração informada precisa ser ajustada antes do cadastro."])
        return
      }

      await api.createBem(baseData)
      mutate("/api/bens/grupos")

      const msg = quantidade > 1 ? `${quantidade} bens cadastrados com sucesso!` : "Bem cadastrado com sucesso!"
      toast({
        title: "Sucesso",
        description: msg,
      })

      setSavedMessage(msg)
      setSaved(true)
      setSubmitErrorSummary([])
      setFieldErrors([])
      setDescricao("")
      setCategoria("")
      setGrupo("")
      setMarcaSel("")
      setFornecedorSel("")
      setModelo("")
      setSerie("")
      setValorIndividual("")
      setTempoGarantia("")
      setQuantidade(1)
      setImagemPreview(null)
      setNotaFiscalPdf(null)
      setEmendaParlamentar("")
      setManualProvisorio("")
      setPatrimonioManual("")
      setObservacoes("")
      setTipoEntrada("compra")
      setPlaca("")
      setAnoVeiculo("")
      setKmAtualVeiculo("")
      setResponsavelNome("")
      setResponsavelCargo("")
      setTimeout(() => setSaved(false), 5000)
    } catch (error: any) {
      console.error(error)
      let msg = getApiErrorMessage(error, "Não foi possível cadastrar o bem. Verifique os dados e tente novamente.")
      let title = "Erro ao cadastrar"
      if (isApiError(error) && error.status === 409) {
        title = "Patrimônio já existe"
        const conflictingCode = error.body?.conflictingCode
        msg = conflictingCode
          ? `O patrimônio ${conflictingCode} já está em uso. Informe outro número para continuar.`
          : getApiErrorMessage(error, msg)
      }

      if (!isApiError(error) && (msg.includes("duplicação") || msg.includes("Duplicate entry"))) {
        title = "Patrimônio Já Existe"
        msg = "Este número de patrimônio já está cadastrado no sistema. Por favor, verifique se digitou corretamente ou utilize um outro número para este equipamento."
      }

      toast({
        title,
        description: msg,
        variant: "destructive",
        duration: 8000,
      })
      setSavedMessage(msg)
      setSaved(true)
      setSubmitErrorSummary([msg])
    } finally {
      setIsSubmitting(false)
      individualSubmitLockRef.current = false
    }
  }

  // Lote helpers
  const addLoteItem = () => {
    setLoteItems((prev) => [
      ...prev,
      { id: String(Date.now()), descricao: "", categoria: "", grupo: "", marca: "", modelo: "", fornecedor: "", valor: "", tempoGarantia: "", quantidade: 1, imagem: null, patrimonioInicial: "", emendaParlamentar: "" },
    ])
  }

  const removeLoteItem = (id: string) => {
    setLoteItems((prev) => prev.filter((item) => item.id !== id))
  }

  const updateLoteItem = (id: string, field: keyof LoteItem, value: string | number) => {
    setLoteItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
    const itemFieldKey = `item-${id}-${field}`
    if (loteFieldErrors.includes(itemFieldKey)) {
      setLoteFieldErrors((prev) => prev.filter((error) => error !== itemFieldKey))
    }
  }

  const handleLoteImageChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = (ev) => {
       const result = ev.target?.result as string
       setLoteItems((prev) =>
         prev.map((item) => (item.id === id ? { ...item, imagem: result } : item))
       )
       const itemFieldKey = `item-${id}-imagem`
       if (loteFieldErrors.includes(itemFieldKey)) {
         setLoteFieldErrors((prev) => prev.filter((error) => error !== itemFieldKey))
       }
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const removeLoteImage = (id: string) => {
    setLoteItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, imagem: null } : item))
    )
  }

  const handleSaveLote = async () => {
    if (loteSubmitLockRef.current) return
    // Validation
    const errors: string[] = []
    const newLoteFieldErrors: string[] = []

    if (loteItems.length === 0) errors.push("Adicione pelo menos um item ao lote.")
    if (!secretariaSel) { errors.push("Secretaria"); newLoteFieldErrors.push("secretaria"); }
    if (!departamentoSel) { errors.push("Departamento"); newLoteFieldErrors.push("departamento"); }
    if (!salaSel) { errors.push("Sala"); newLoteFieldErrors.push("sala"); }
    if (!responsavelNome) { errors.push("Responsável"); newLoteFieldErrors.push("responsavelNome"); }
    
    // Check individual items
    loteItems.forEach((item, index) => {
        const itemErrors = []
        if (!item.descricao) { itemErrors.push("Descrição"); newLoteFieldErrors.push(`item-${item.id}-descricao`); }
        if (!item.categoria) { itemErrors.push("Categoria"); newLoteFieldErrors.push(`item-${item.id}-categoria`); }
        if (!item.grupo) { itemErrors.push("Grupo"); newLoteFieldErrors.push(`item-${item.id}-grupo`); }
        if (!item.valor) { itemErrors.push("Valor"); newLoteFieldErrors.push(`item-${item.id}-valor`); }
        if (!item.imagem) { itemErrors.push("Imagem"); newLoteFieldErrors.push(`item-${item.id}-imagem`); }
        
        if (itemErrors.length > 0) {
            errors.push(`Item ${index + 1}: ${itemErrors.join(", ")}`)
        }
    })
    
    if (patrimonioTipo !== "definitivo" && isManualProvisorio && !manualProvisorio) {
        errors.push("Número Provisório Inicial"); newLoteFieldErrors.push("manualProvisorio");
    }

    setLoteFieldErrors(newLoteFieldErrors)
    setLoteSubmitErrorSummary(errors)

    if (errors.length > 0) {
        scrollToFirstError()
        toast({
            title: "Erros de Validação",
            description: (
                <div className="flex flex-col gap-1">
                    <p>Por favor, corrija os seguintes erros:</p>
                    <ul className="list-disc pl-4 text-xs">
                        {errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                        {errors.length > 5 && <li>... e mais {errors.length - 5} erros.</li>}
                    </ul>
                </div>
            ),
            variant: "destructive",
            duration: 5000,
        })
        return
    }

    let patPrefix = ""
    let patNumber = 0
    let patPadding = 0
    
    const hasManualDefinitiveStart = Boolean(lotePatrimonioInicial.trim())

    if (patrimonioTipo === "definitivo" && hasManualDefinitiveStart) {
        let patrimonioInicialEfetivo = lotePatrimonioInicial.trim()
        const match = patrimonioInicialEfetivo.match(/^(.*?)(\d+)$/)
        if (match) {
            patPrefix = match[1]
            patNumber = parseInt(match[2])
            patPadding = match[2].length
        } else {
             toast({ title: "Erro", description: "Formato de patrimonio invalido. Use algo como PAT-001", variant: "destructive" })
             return
        }
    } else {
        if (isManualProvisorio) {
            patNumber = parseInt(manualProvisorio)
            if (isNaN(patNumber)) {
               toast({ title: "Erro", description: "Numero provisorio invalido.", variant: "destructive" })
               return
            }
            patPadding = manualProvisorio.length
        }
    }

    const generatedManualCodes = new Map<string, number>()

    loteSubmitLockRef.current = true
    setIsSubmitting(true)

    try {
      // Prepare batch data
      const batchData: any[] = []
      
      for (let loteItemIndex = 0; loteItemIndex < loteItems.length; loteItemIndex++) {
          const item = loteItems[loteItemIndex]
          // Check for item-specific start number
          if (patrimonioTipo === "definitivo" && item.patrimonioInicial) {
              const match = item.patrimonioInicial.match(/^(.*?)(\d+)$/)
              if (match) {
                  patPrefix = match[1]
                  patNumber = parseInt(match[2])
                  patPadding = match[2].length
              }
          }

          const qtd = item.quantidade || 1
          for (let i = 0; i < qtd; i++) {
              const newItem: any = {
                descricao: item.descricao,
                categoria: item.categoria,
                grupo: item.grupo,
                marca: item.marca,
                modelo: item.modelo,
                fornecedor: item.fornecedor,
                valor: parseCurrency(item.valor),
                tempoGarantia: item.tempoGarantia ? parseInt(item.tempoGarantia) : undefined,
                localizacao: {
                  secretaria: secretariaSel,
                  departamento: departamentoSel,
                  sala: salaSel,
                },
                responsavel: {
                   nome: responsavelNome,
                   cargo: responsavelCargo
                },
                status: "ativo",
                patrimonioTipo: patrimonioTipo,
                imagem: item.imagem,
                notaFiscal: notaFiscalPdf,
                emendaParlamentar: item.emendaParlamentar,
                tipoEntrada,
              }
              
              if (patrimonioTipo === "definitivo" && (hasManualDefinitiveStart || item.patrimonioInicial)) {
                  const numStr = String(patNumber).padStart(patPadding, '0')
                  newItem.patrimonio = `${patPrefix}${numStr}`
                  const normalizedCode = newItem.patrimonio.trim().toUpperCase()
                  const previousItemIndex = generatedManualCodes.get(normalizedCode)
                  if (typeof previousItemIndex === "number") {
                    const conflictMessage = formatLocalConflictMessage(newItem.patrimonio, previousItemIndex, loteItemIndex)
                    toast({
                      title: "Patrimônio duplicado no lote",
                      description: conflictMessage,
                      variant: "destructive",
                      duration: 8000,
                    })
                    setLoteSavedMessage(conflictMessage)
                    setLoteSaved(true)
                    setLoteSubmitErrorSummary([conflictMessage])
                    return
                  }
                  generatedManualCodes.set(normalizedCode, loteItemIndex)
                  patNumber++
              } else {
                  if (isManualProvisorio) {
                      const numStr = String(patNumber).padStart(patPadding, '0')
                      newItem.patrimonioProvisorio = `PROV-${provAno}-${numStr}`
                      patNumber++
                  } else {
                      newItem.patrimonioProvisorio = `PROV-${provAno}-AUTO`
                  }
              }
              
              batchData.push(newItem)
          }
      }
      
      const explicitCodes = batchData.flatMap((item, index) => {
        const entries: Array<{ code: string; field?: "patrimonio" | "patrimonioProvisorio"; itemIndex?: number }> = []
        if (item.patrimonio && !String(item.patrimonio).includes("AUTO")) {
          entries.push({ code: item.patrimonio, field: "patrimonio", itemIndex: index })
        }
        if (item.patrimonioProvisorio && !String(item.patrimonioProvisorio).includes("AUTO")) {
          entries.push({ code: item.patrimonioProvisorio, field: "patrimonioProvisorio", itemIndex: index })
        }
        return entries
      })

      const canContinue = await validateCodeAvailability(explicitCodes, "A numeração informada para o lote")
      if (!canContinue) {
        setLoteSavedMessage("Existe conflito na numeração manual informada para o lote.")
        setLoteSaved(true)
        setLoteSubmitErrorSummary(["Existe conflito na numeração manual informada para o lote."])
        return
      }

      // Send entire batch in one request for better performance and deduplication
      if (batchData.length > 0) {
          await api.createBem(batchData)
      }
      
      mutate("/api/bens/grupos")

      const totalItems = loteItems.reduce((sum, item) => sum + (item.quantidade || 1), 0)
      const msg = `${totalItems} bens cadastrados com sucesso em lote!`
      
      toast({
        title: "Sucesso",
        description: msg,
      })
      
      setLoteSavedMessage(msg)
      setLoteSaved(true)
      setLoteSubmitErrorSummary([])
      setLoteFieldErrors([])
      setLoteItems([{ id: "1", descricao: "", categoria: "", grupo: "", marca: "", modelo: "", fornecedor: "", valor: "", tempoGarantia: "", quantidade: 1, imagem: null, emendaParlamentar: "" }])
      setNotaFiscalPdf(null)
      setTipoEntrada("compra")
      setTimeout(() => setLoteSaved(false), 5000)
    } catch (e: any) {
      console.error(e)
      let msg = getApiErrorMessage(e, "Ocorreu um erro ao salvar o lote.")
      let title = "Erro ao cadastrar lote"

      if (isApiError(e) && e.status === 409) {
          title = "Patrimônio já existe"
          const conflictingCode = e.body?.conflictingCode
          const itemIndex = typeof e.body?.itemIndex === "number" ? e.body.itemIndex + 1 : null
          msg = conflictingCode
            ? `O patrimônio ${conflictingCode} já está em uso${itemIndex ? ` no item ${itemIndex}` : ""}. Ajuste o número informado e tente novamente.`
            : msg
      }

      if (!isApiError(e) && (msg.includes("duplicação") || msg.includes("Duplicate entry"))) {
          title = "Patrimônio Já Existe"
          msg = "Este número de patrimônio já está cadastrado no sistema. Por favor, verifique se digitou corretamente ou utilize um outro número."
      }

      toast({
        title: title,
        description: msg,
        variant: "destructive",
        duration: 8000,
      })
      setLoteSavedMessage(msg)
      setLoteSaved(true)
      setLoteSubmitErrorSummary([msg])
    } finally {
      setIsSubmitting(false)
      loteSubmitLockRef.current = false
    }
  }

  const handleAssetSelect = (asset: any) => {
    // Populate Individual Form
    setDescricao(asset.descricao || "")
    setCategoria(asset.categoria || "")
    setGrupo(asset.grupo || "")
    setMarcaSel(asset.marca || "")
    setModelo(asset.modelo || "")
    setFornecedorSel(asset.fornecedor || "")
    
    // Valor might need formatting if it comes as number
    if (asset.valor) {
        setValorIndividual(asset.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }))
    }
    
    if (asset.tempoGarantia) setTempoGarantia(asset.tempoGarantia.toString())
    
    if (asset.emendaParlamentar) setEmendaParlamentar(asset.emendaParlamentar)

    // Image
    if (asset.imagem) {
        setImagemPreview(asset.imagem)
    }

    // Set field errors to empty for filled fields
    setFieldErrors([])

    toast({
        title: "Dados carregados",
        description: "Os campos foram preenchidos com base no bem selecionado.",
    })
  }

  const handleLoteAssetSelect = (asset: any) => {
      const newItem: LoteItem = {
          id: String(Date.now()),
          descricao: asset.descricao || "",
          categoria: asset.categoria || "",
          grupo: asset.grupo || "",
          marca: asset.marca || "",
          modelo: asset.modelo || "",
          fornecedor: asset.fornecedor || "",
          valor: asset.valor ? asset.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "",
          tempoGarantia: asset.tempoGarantia ? asset.tempoGarantia.toString() : "",
          quantidade: 1,
          imagem: asset.imagem || null,
          patrimonioInicial: "",
          emendaParlamentar: asset.emendaParlamentar || ""
      }
      
      setLoteItems(prev => [...prev, newItem])
      
      toast({
          title: "Item adicionado",
          description: "O item foi adicionado à lista com os dados do bem selecionado.",
      })
  }

  const isVeiculo = categoria.includes("veicul")

  return (
    <div className="flex flex-col gap-6 pb-20">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-balance">Cadastrar Bem Patrimonial</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registre bens individualmente ou importe em lote por nota fiscal
        </p>
      </div>

      {/* Entry mode selector */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setModoEntrada("individual")}
          className={`flex items-center gap-4 rounded-xl border-2 p-4 transition-all text-left ${
            modoEntrada === "individual"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-border/80"
          }`}
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              modoEntrada === "individual" ? "bg-primary/10" : "bg-muted"
            }`}
          >
            <Plus
              className={`h-5 w-5 ${
                modoEntrada === "individual" ? "text-primary" : "text-muted-foreground"
              }`}
            />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Cadastro Individual</p>
            <p className="text-xs text-muted-foreground">
              Registre um ou mais itens iguais
            </p>
          </div>
          {modoEntrada === "individual" && (
            <Badge className="bg-primary text-primary-foreground shrink-0">Ativo</Badge>
          )}
        </button>

        <button
          type="button"
          onClick={() => setModoEntrada("lote")}
          className={`flex items-center gap-4 rounded-xl border-2 p-4 transition-all text-left ${
            modoEntrada === "lote"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-border/80"
          }`}
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              modoEntrada === "lote" ? "bg-primary/10" : "bg-muted"
            }`}
          >
            <Package
              className={`h-5 w-5 ${
                modoEntrada === "lote" ? "text-primary" : "text-muted-foreground"
              }`}
            />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Cadastro em Lote</p>
            <p className="text-xs text-muted-foreground">
              Varios itens diferentes de uma vez
            </p>
          </div>
          {modoEntrada === "lote" && (
            <Badge className="bg-primary text-primary-foreground shrink-0">Ativo</Badge>
          )}
        </button>

        <button
          type="button"
          onClick={() => setModoEntrada("nota-fiscal")}
          className={`flex items-center gap-4 rounded-xl border-2 p-4 transition-all text-left ${
            modoEntrada === "nota-fiscal"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-border/80"
          }`}
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              modoEntrada === "nota-fiscal" ? "bg-primary/10" : "bg-muted"
            }`}
          >
            <FileText
              className={`h-5 w-5 ${
                modoEntrada === "nota-fiscal" ? "text-primary" : "text-muted-foreground"
              }`}
            />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Entrada por Nota Fiscal</p>
            <p className="text-xs text-muted-foreground">
              Importe equipamentos de uma NF
            </p>
          </div>
          {modoEntrada === "nota-fiscal" && (
            <Badge className="bg-primary text-primary-foreground shrink-0">Ativo</Badge>
          )}
        </button>
      </div>

      {/* Nota Fiscal mode */}
      {modoEntrada === "nota-fiscal" && <EntradaNotaFiscal />}

      {/* Lote Manual mode */}
      {modoEntrada === "lote" && (
        <>
          {loteSubmitErrorSummary.length > 0 && (
            <Card className="border-destructive/40 bg-destructive/5" data-field-error="true">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      {loteSubmitErrorSummary.length} pendencia(s) impedem o cadastro do lote
                    </p>
                    <ul className="mt-1 list-disc pl-4 text-xs text-destructive/90">
                      {loteSubmitErrorSummary.slice(0, 6).map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <PatrimonioTypeSelector 
            value={patrimonioTipo}
            onChange={setPatrimonioTipo}
            provAno={provAno}
            setProvAno={setProvAno}
            manualProvisorio={isManualProvisorio}
            setManualProvisorio={setIsManualProvisorio}
            manualStartNumber={manualProvisorio}
            setManualStartNumber={setManualProvisorio}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Adicionar Item Existente</CardTitle>
              <CardDescription>
                Busque um bem já cadastrado para aproveitar os dados e adicionar ao lote
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AssetSearchSelector 
                onSelect={handleLoteAssetSelect}
                placeholder="Buscar bem para adicionar ao lote..."
              />
            </CardContent>
          </Card>

          {/* Shared location and responsible */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Localizacao e Responsavel (compartilhados)</CardTitle>
              <CardDescription>
                Todos os itens do lote serao cadastrados nesta localizacao
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
                <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold">Localizacao</h4>
                    <p className="text-xs text-muted-foreground">
                      Secretaria, departamento e sala compartilhados por todos os itens do lote.
                    </p>
                  </div>
                  <div className="grid gap-4">
                    <div className="flex min-w-0 flex-col gap-2">
                      <Label required className={loteFieldErrors.includes("secretaria") ? "text-destructive" : ""}>Secretaria</Label>
                      <div className="min-w-0">
                        <SearchableSelect
                          value={secretariaSel}
                          onValueChange={(v) => { setSecretariaSel(v); setDepartamentoSel(""); setSalaSel(""); }}
                          placeholder="Selecione a secretaria"
                          searchPlaceholder="Buscar secretaria..."
                          disabled={user?.role === "assistente"}
                          className={loteFieldErrors.includes("secretaria") ? "border-destructive ring-offset-destructive" : ""}
                          items={(secretarias as Secretaria[]).map((s) => ({
                            value: s.nome,
                            label: s.nome,
                          }))}
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="flex min-w-0 flex-col gap-2">
                  <Label required className={loteFieldErrors.includes("departamento") ? "text-destructive" : ""}>Departamento</Label>
                  <div className="flex min-w-0 items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <SearchableSelect
                        value={departamentoSel}
                        onValueChange={(v) => { setDepartamentoSel(v); setSalaSel(""); }}
                        disabled={!secretariaSel || user?.role === "assistente"}
                        placeholder="Selecione o departamento"
                        searchPlaceholder="Buscar departamento..."
                        className={loteFieldErrors.includes("departamento") ? "border-destructive ring-offset-destructive" : ""}
                        items={selectedSecretaria?.departamentos.map((d) => ({
                          value: d.nome,
                          label: d.nome,
                        })) || []}
                      />
                    </div>
                    <Dialog open={isCreatingDept} onOpenChange={setIsCreatingDept}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="icon" className="shrink-0" disabled={!secretariaSel} title="Criar Departamento">
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
                      <div className="flex min-w-0 flex-col gap-2">
                  <Label required className={loteFieldErrors.includes("sala") ? "text-destructive" : ""}>Sala</Label>
                  <div className="flex min-w-0 items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <SearchableSelect
                        value={salaSel}
                        onValueChange={setSalaSel}
                        disabled={!departamentoSel}
                        placeholder="Selecione a sala"
                        searchPlaceholder="Buscar sala..."
                        className={loteFieldErrors.includes("sala") ? "border-destructive ring-offset-destructive" : ""}
                        items={selectedDepartamento?.salas.map((s) => ({
                          value: typeof s === 'string' ? s : s.nome,
                          label: typeof s === 'string' ? s : s.nome,
                        })) || []}
                      />
                    </div>
                    <Dialog open={isCreatingSala} onOpenChange={setIsCreatingSala}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="icon" className="shrink-0" disabled={!departamentoSel} title="Criar Sala">
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
                    </div>
                  </div>
                </div>
                <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold">Responsavel</h4>
                    <p className="text-xs text-muted-foreground">
                      Dados compartilhados do responsavel principal deste lote.
                    </p>
                  </div>
                  <div className="grid gap-4">
                    <div className="flex min-w-0 flex-col gap-2">
                  <Label required className={loteFieldErrors.includes("responsavelNome") ? "text-destructive" : ""}>Responsavel</Label>
                  <ResponsavelSelect 
                    value={responsavelNome}
                    onValueChange={setResponsavelNome}
                    onSelect={(s) => setResponsavelCargo(s.cargo || "")}
                    placeholder="Selecione o responsável"
                    className={loteFieldErrors.includes("responsavelNome") ? "border-destructive ring-offset-destructive" : ""}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label required>Cargo</Label>
                  <Input 
                    value={responsavelCargo || ""}
                    onChange={(e) => setResponsavelCargo(e.target.value)}
                    placeholder="Cargo"
                  />

                </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <div className="flex flex-col gap-2 max-w-sm">
                  <Label htmlFor="tipo-entrada-lote">Tipo de Entrada</Label>
                  <Select value={tipoEntrada} onValueChange={(value: TipoEntradaBem) => setTipoEntrada(value)}>
                    <SelectTrigger id="tipo-entrada-lote">
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
                  <p className="text-xs text-muted-foreground">
                    Compra fica como padrão para agilizar o cadastro diário.
                  </p>
                </div>
              </div>
              
              {patrimonioTipo === "definitivo" && (
                <div className="mt-4 pt-4 border-t">
                    <div className="flex flex-col gap-2 max-w-xs">
                        <Label>Patrimonio Inicial (Opcional)</Label>
                        <Input 
                            placeholder="Ex: PAT-2026-00001" 
                            id="lote-pat-inicial"
                            value={lotePatrimonioInicial}
                            onChange={(e) => setLotePatrimonioInicial(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Se deixar em branco, o sistema gera automaticamente a sequencia definitiva.
                        </p>
                    </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documentacao do Lote</CardTitle>
              <CardDescription>
                Anexe a Nota Fiscal valida para todo o lote (PDF)
              </CardDescription>
            </CardHeader>
            <CardContent>
                <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                onChange={handlePdfChange}
                className="hidden"
                />
                
                {notaFiscalPdf ? (
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-red-600" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">Nota Fiscal.pdf</span>
                            <span className="text-xs text-muted-foreground">Anexado com sucesso</span>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setNotaFiscalPdf(null)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
                ) : (
                <Button 
                    variant="outline" 
                    className="w-full gap-2 border-dashed h-12"
                    onClick={() => pdfInputRef.current?.click()}
                >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Anexar Nota Fiscal (PDF)
                </Button>
                )}
            </CardContent>
          </Card>

          {/* Lote items table */}
          <Card className={isTableMaximized ? "fixed inset-0 z-50 rounded-none h-screen flex flex-col bg-background shadow-2xl" : ""}>
            <CardHeader className="flex flex-row items-center justify-between shrink-0">
              <div>
                <CardTitle className="text-base">Itens do Lote</CardTitle>
                <CardDescription>
                  Adicione varios itens diferentes. Cada linha pode ter uma quantidade diferente.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsTableMaximized(!isTableMaximized)}
                  title={isTableMaximized ? "Restaurar" : "Maximizar"}
                >
                  {isTableMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={addLoteItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className={isTableMaximized ? "flex-1 overflow-auto p-4" : ""}>
              {isTableMaximized && (
                  <div className="mb-6 p-4 border rounded-lg bg-muted/30 shadow-sm">
                      <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-primary" />
                              <h3 className="text-sm font-semibold">Adicionar Item Existente ao Lote</h3>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                              Busque um bem já cadastrado para preencher os dados automaticamente e adicionar à lista abaixo.
                          </p>
                          <AssetSearchSelector 
                            onSelect={handleLoteAssetSelect}
                            placeholder="Buscar bem (nome, marca, modelo)..."
                          />
                      </div>
                  </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-center font-medium text-muted-foreground pb-2 pr-2 w-24">
                        Img <span className="text-destructive">*</span>
                      </th>
                      {patrimonioTipo === "definitivo" && (
                        <th className="text-left font-medium text-muted-foreground pb-2 pr-2 w-32">Pat. Inicial (Opcional)</th>
                      )}
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2">Descricao</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2">Categoria</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2">Grupo</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2">Marca</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2">Fornecedor</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2">Modelo</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2">Valor (R$)</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2 w-24">Garantia</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2">Emenda</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2 w-20">Qtd</th>
                      <th className="w-10 pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {loteItems.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-2 pr-2 align-middle">
                          <div className={`flex items-center justify-center gap-1 p-1 rounded-md ${loteFieldErrors.includes(`item-${item.id}-imagem`) ? "border border-destructive bg-destructive/10" : ""}`}>
                            {item.imagem ? (
                              <div className="relative group">
                                <img 
                                  src={item.imagem} 
                                  alt="Item" 
                                  className="h-9 w-9 object-cover rounded-md border border-border bg-background"
                                />
                                <button
                                  className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => removeLoteImage(item.id)}
                                  title="Remover imagem"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <label className="cursor-pointer flex items-center justify-center h-9 w-9 rounded-md border border-dashed border-border hover:bg-muted hover:border-primary/50 transition-colors bg-background" title="Carregar imagem">
                                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                  <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={(e) => handleLoteImageChange(item.id, e)}
                                  />
                                </label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 rounded-md border border-dashed border-border hover:bg-muted hover:border-primary/50 transition-colors"
                                  onClick={() => setWebcamTarget(item.id)}
                                  title="Usar Webcam"
                                >
                                  <Camera className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                        {patrimonioTipo === "definitivo" && (
                          <td className="py-2 pr-2">
                            <Input
                              placeholder="Auto"
                              value={item.patrimonioInicial || ""}
                              onChange={(e) => updateLoteItem(item.id, "patrimonioInicial", e.target.value)}
                              className="text-sm font-mono"
                              title="Deixe em branco para seguir a sequencia automatica"
                            />
                          </td>
                        )}
                        <td className="py-2 pr-2">
                          <Input
                            placeholder="Descricao do bem"
                            value={item.descricao}
                            onChange={(e) => updateLoteItem(item.id, "descricao", e.target.value)}
                            className={`text-sm ${loteFieldErrors.includes(`item-${item.id}-descricao`) ? "border-destructive focus-visible:ring-destructive" : ""}`}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <CategoriaSelector
                            value={item.categoria}
                            onValueChange={(v) => updateLoteItem(item.id, "categoria", v)}
                            placeholder="Selecione"
                            className={`w-full ${loteFieldErrors.includes(`item-${item.id}-categoria`) ? "border-destructive ring-offset-destructive" : ""}`}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <GroupSelector
                            value={item.grupo}
                            onValueChange={(v) => updateLoteItem(item.id, "grupo", v)}
                            placeholder="Grupo"
                            className={`w-full ${loteFieldErrors.includes(`item-${item.id}-grupo`) ? "border-destructive ring-offset-destructive" : ""}`}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <MarcaSelector
                            value={item.marca}
                            onValueChange={(v) => updateLoteItem(item.id, "marca", v)}
                            placeholder="Selecione"
                            className="w-full"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <FornecedorSelector
                            value={item.fornecedor}
                            onValueChange={(v) => updateLoteItem(item.id, "fornecedor", v)}
                            placeholder="Selecione"
                            className="w-full"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            placeholder="Modelo"
                            value={item.modelo}
                            onChange={(e) => updateLoteItem(item.id, "modelo", e.target.value)}
                            className="text-sm"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            placeholder="0,00"
                            value={item.valor}
                            onChange={(e) => updateLoteItem(item.id, "valor", formatCurrency(e.target.value))}
                            className={`text-sm ${loteFieldErrors.includes(`item-${item.id}-valor`) ? "border-destructive focus-visible:ring-destructive" : ""}`}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            type="number"
                            min={0}
                            placeholder="Meses"
                            value={item.tempoGarantia || ""}
                            onChange={(e) => updateLoteItem(item.id, "tempoGarantia", e.target.value)}
                            className="text-sm"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            placeholder="Nº Emenda"
                            value={item.emendaParlamentar || ""}
                            onChange={(e) => updateLoteItem(item.id, "emendaParlamentar", e.target.value)}
                            className="text-sm w-32"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            type="number"
                            min={1}
                            value={item.quantidade}
                            onChange={(e) => updateLoteItem(item.id, "quantidade", Math.max(1, parseInt(e.target.value) || 1))}
                            className="text-sm w-20"
                          />
                        </td>
                        <td className="py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeLoteItem(item.id)}
                            disabled={loteItems.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remover item</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg bg-muted p-3">
                <div className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{loteItems.length}</strong> itens diferentes,{" "}
                  <strong className="text-foreground">
                    {loteItems.reduce((sum, item) => sum + (item.quantidade || 1), 0)}
                  </strong>{" "}
                  patrimonios no total
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save button for lote */}
          <div className="flex items-center justify-end gap-4">
            {loteSaved && (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                {loteSavedMessage}
              </div>
            )}
            <Button variant="outline" className="bg-transparent">Cancelar</Button>
            <Button onClick={handleSaveLote} className="gap-2" disabled={isSubmitting}>
              {isSubmitting ? <Clock className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSubmitting
                ? "Cadastrando lote..."
                : `Cadastrar Lote (${loteItems.reduce((sum, item) => sum + (item.quantidade || 1), 0)} itens)`}
            </Button>
          </div>
        </>
      )}

      {/* Individual mode - existing form below */}
      {modoEntrada === "individual" && (
        <>
          {/* Patrimonio type toggle - highlight feature */}
          <PatrimonioTypeSelector 
            value={patrimonioTipo}
            onChange={setPatrimonioTipo}
            provAno={provAno}
            setProvAno={setProvAno}
            manualProvisorio={isManualProvisorio}
            setManualProvisorio={setIsManualProvisorio}
            manualStartNumber={manualProvisorio}
            setManualStartNumber={setManualProvisorio}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Reaproveitar Cadastro</CardTitle>
              <CardDescription>
                Busque um bem já cadastrado para preencher os campos automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AssetSearchSelector 
                onSelect={handleAssetSelect}
                placeholder="Buscar bem para preencher formulário..."
              />
            </CardContent>
          </Card>

          {submitErrorSummary.length > 0 && (
            <Card className="border-destructive/40 bg-destructive/5" data-field-error="true">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      {submitErrorSummary.length} pendencia(s) impedem o cadastro
                    </p>
                    <ul className="mt-1 list-disc pl-4 text-xs text-destructive/90">
                      {submitErrorSummary.slice(0, 6).map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Form tabs */}
          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="geral" className="gap-2">
                <Package className="h-4 w-4" />
                Dados Gerais
              </TabsTrigger>
              {isVeiculo && (
                <TabsTrigger value="veiculo" className="gap-2">
                  <Car className="h-4 w-4" />
                  Dados do Veiculo
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="geral" className="mt-4">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Identification */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Identificacao</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {patrimonioTipo === "provisorio" && isManualProvisorio ? (
                        <div className="flex flex-col gap-2">
                            <Label>Numero Provisorio</Label>
                            <Input 
                                value={`PROV-${provAno}-${manualProvisorio || "XXXXX"}`}
                                disabled
                                className="font-mono bg-muted"
                            />
                            <p className="text-xs text-muted-foreground">
                                O numero sera gerado com base na configuracao acima.
                            </p>
                        </div>
                    ) : patrimonioTipo === "provisorio" ? (
                        <div className="flex flex-col gap-2">
                            <Label>Numero Provisorio (auto)</Label>
                            <Input 
                                value={`PROV-${provAno}-AUTO`}
                                disabled
                                className="font-mono bg-muted"
                            />
                        </div>
                    ) : (
                      <div className="flex flex-col gap-2" data-field-error={fieldErrors.includes("patrimonio") ? "true" : undefined}>
                        <Label htmlFor="patrimonio" required className={fieldErrors.includes("patrimonio") ? "text-destructive" : ""}>Numero de Patrimonio</Label>
                        <Input
                          id="patrimonio"
                          placeholder="PAT-2026-XXXXX"
                          value={patrimonioManual}
                          onChange={(e) => {
                            setPatrimonioManual(e.target.value)
                            if (fieldErrors.includes("patrimonio")) setFieldErrors((prev) => prev.filter((f) => f !== "patrimonio"))
                            setSubmitErrorSummary((prev) => prev.filter((item) => item !== "NÃºmero do PatrimÃ´nio"))
                          }}
                          className={fieldErrors.includes("patrimonio") ? "border-destructive focus-visible:ring-destructive" : ""}
                        />
                        {fieldErrors.includes("patrimonio") && (
                          <p className="text-xs text-destructive">Informe o numero do patrimonio para continuar.</p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="descricao" required className={fieldErrors.includes("descricao") ? "text-destructive" : ""}>Descricao do Bem</Label>
                      <Input 
                        id="descricao" 
                        placeholder="Ex: Computador Dell OptiPlex 7010" 
                        value={descricao}
                        onChange={(e) => {
                            setDescricao(e.target.value)
                            if (fieldErrors.includes("descricao")) setFieldErrors(prev => prev.filter(f => f !== "descricao"))
                        }}
                        className={fieldErrors.includes("descricao") ? "border-destructive focus-visible:ring-destructive" : ""}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="categoria" required className={fieldErrors.includes("categoria") ? "text-destructive" : ""}>Categoria</Label>
                      <CategoriaSelector
                        value={categoria}
                        onValueChange={(v) => {
                            setCategoria(v as AssetCategory)
                            if (fieldErrors.includes("categoria")) setFieldErrors(prev => prev.filter(f => f !== "categoria"))
                        }}
                        placeholder="Selecione ou crie uma categoria"
                        className={fieldErrors.includes("categoria") ? "border-destructive ring-offset-destructive" : "w-full"}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="grupo" required className={fieldErrors.includes("grupo") ? "text-destructive" : ""}>Grupo</Label>
                      <GroupSelector
                        value={grupo}
                        onValueChange={(v) => {
                            setGrupo(v)
                            if (fieldErrors.includes("grupo")) setFieldErrors(prev => prev.filter(f => f !== "grupo"))
                        }}
                        placeholder="Selecione ou crie um grupo (ex: No Break, Computador)"
                        className={fieldErrors.includes("grupo") ? "border-destructive ring-offset-destructive" : "w-full"}
                      />
                    </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="marca">Marca</Label>
                      <MarcaSelector
                        value={marcaSel}
                        onValueChange={setMarcaSel}
                        placeholder="Selecione ou crie uma marca"
                        className="w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="fornecedor">Fornecedor</Label>
                      <FornecedorSelector
                        value={fornecedorSel}
                        onValueChange={setFornecedorSel}
                        placeholder="Selecione ou crie um fornecedor"
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="modelo">Modelo</Label>
                        <Input 
                          id="modelo" 
                          placeholder="Ex: OptiPlex 7010" 
                          value={modelo}
                          onChange={(e) => setModelo(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="serie">Numero de Serie</Label>
                        <Input 
                          id="serie" 
                          placeholder="Ex: SN-DELL-78912" 
                          value={serie}
                          onChange={(e) => setSerie(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="tipoEntrada">Tipo de Entrada</Label>
                        <Select value={tipoEntrada} onValueChange={(value: TipoEntradaBem) => setTipoEntrada(value)}>
                          <SelectTrigger id="tipoEntrada">
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
                        <Label required className={fieldErrors.includes("dataAquisicao") ? "text-destructive" : ""}>Data de Aquisicao</Label>
                        <DatePicker 
                          date={dataAquisicao} 
                          setDate={(d) => {
                              setDataAquisicao(d)
                              if (d && fieldErrors.includes("dataAquisicao")) setFieldErrors(prev => prev.filter(f => f !== "dataAquisicao"))
                          }} 
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="valor" required className={fieldErrors.includes("valor") ? "text-destructive" : ""}>Valor (R$)</Label>
                        <Input
                          id="valor"
                          placeholder="R$ 0,00"
                          value={valorIndividual}
                          onChange={(e) => {
                              setValorIndividual(formatCurrency(e.target.value))
                              if (fieldErrors.includes("valor")) setFieldErrors(prev => prev.filter(f => f !== "valor"))
                          }}
                          className={fieldErrors.includes("valor") ? "border-destructive focus-visible:ring-destructive" : ""}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="garantia">Garantia (meses)</Label>
                        <Input
                          id="garantia"
                          type="number"
                          placeholder="Ex: 12"
                          value={tempoGarantia}
                          onChange={(e) => setTempoGarantia(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                      <Label htmlFor="quantidade">Quantidade</Label>
                      <Input
                        id="quantidade"
                        type="number"
                        min={1}
                        value={quantidade}
                        onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mt-4">
                      <Label htmlFor="emenda">Emenda Parlamentar (Opcional)</Label>
                      <Input
                          id="emenda"
                          placeholder="Ex: Emenda nº 123/2025 - Deputado Fulano"
                          value={emendaParlamentar}
                          onChange={(e) => setEmendaParlamentar(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                          Informe se este bem foi adquirido atraves de emenda parlamentar.
                      </p>
                  </div>

                  {quantidade > 1 && (
                    <div className="flex items-start gap-2 rounded-lg bg-info/10 p-3 mt-4">
                        <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">
                          Serao gerados <strong className="text-foreground">{quantidade} patrimonios</strong> automaticamente com numeros sequenciais.
                          Todos os itens terao os mesmos dados (descricao, categoria, localizacao, etc).
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="conservacao">Estado de Conservacao</Label>
                      <Select value={estadoConservacao} onValueChange={setEstadoConservacao}>
                        <SelectTrigger id="conservacao">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="novo">Novo</SelectItem>
                          <SelectItem value="bom">Bom</SelectItem>
                          <SelectItem value="regular">Regular</SelectItem>
                          <SelectItem value="ruim">Ruim</SelectItem>
                          <SelectItem value="inoperante">Inoperante</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Location & Responsible */}
                <div className="flex flex-col gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Localizacao</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="secretaria" required className={fieldErrors.includes("secretaria") ? "text-destructive" : ""}>Secretaria</Label>
                        <SearchableSelect
                          value={secretariaSel}
                          onValueChange={(v) => {
                            setSecretariaSel(v)
                            setDepartamentoSel("")
                            setSalaSel("")
                            if (fieldErrors.includes("secretaria")) setFieldErrors(prev => prev.filter(f => f !== "secretaria"))
                          }}
                          placeholder="Selecione a secretaria"
                          searchPlaceholder="Buscar secretaria..."
                          disabled={user?.role === "assistente"}
                          className={fieldErrors.includes("secretaria") ? "border-destructive ring-offset-destructive" : ""}
                          items={(secretarias as Secretaria[]).map((s) => ({
                            value: s.nome,
                            label: s.nome,
                          }))}
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label htmlFor="departamento" required className={fieldErrors.includes("departamento") ? "text-destructive" : ""}>Departamento</Label>
                        <div className="flex gap-2">
                          <div className="w-full">
                            <SearchableSelect
                              value={departamentoSel}
                              onValueChange={(v) => {
                                setDepartamentoSel(v)
                                setSalaSel("")
                                if (fieldErrors.includes("departamento")) setFieldErrors(prev => prev.filter(f => f !== "departamento"))
                              }}
                              disabled={!secretariaSel || user?.role === "assistente"}
                              placeholder="Selecione o departamento"
                              searchPlaceholder="Buscar departamento..."
                              className={fieldErrors.includes("departamento") ? "border-destructive ring-offset-destructive" : ""}
                              items={selectedSecretaria?.departamentos.map((d) => ({
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
                        <Label htmlFor="sala" required className={fieldErrors.includes("sala") ? "text-destructive" : ""}>Sala</Label>
                        <div className="flex gap-2">
                          <div className="w-full">
                            <SearchableSelect
                              value={salaSel}
                              onValueChange={(v) => {
                                  setSalaSel(v)
                                  if (fieldErrors.includes("sala")) setFieldErrors(prev => prev.filter(f => f !== "sala"))
                              }}
                              disabled={!departamentoSel}
                              placeholder="Selecione a sala"
                              searchPlaceholder="Buscar sala..."
                              className={fieldErrors.includes("sala") ? "border-destructive ring-offset-destructive" : ""}
                              items={selectedDepartamento?.salas.map((s) => ({
                                value: typeof s === 'string' ? s : s.nome,
                                label: typeof s === 'string' ? s : s.nome,
                              })) || []}
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
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Responsavel</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <Label required className={fieldErrors.includes("responsavelNome") ? "text-destructive" : ""}>Nome do Responsavel</Label>
                        <ResponsavelSelect 
                            value={responsavelNome}
                            onValueChange={(v) => {
                                setResponsavelNome(v)
                                if (fieldErrors.includes("responsavelNome")) setFieldErrors(prev => prev.filter(f => f !== "responsavelNome"))
                            }}
                            onSelect={(s) => {
                                setResponsavelCargo(s.cargo || "")
                                if (fieldErrors.includes("responsavelCargo")) setFieldErrors(prev => prev.filter(f => f !== "responsavelCargo"))
                            }}
                            placeholder="Selecione o responsável"
                            className={fieldErrors.includes("responsavelNome") ? "border-destructive ring-offset-destructive" : ""}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label required className={fieldErrors.includes("responsavelCargo") ? "text-destructive" : ""}>Cargo</Label>
                        <Input 
                            value={responsavelCargo || ""}
                            onChange={(e) => {
                                setResponsavelCargo(e.target.value)
                                if (fieldErrors.includes("responsavelCargo")) setFieldErrors(prev => prev.filter(f => f !== "responsavelCargo"))
                            }}
                            placeholder="Ex: Coordenadora de RH"
                            className={fieldErrors.includes("responsavelCargo") ? "border-destructive focus-visible:ring-destructive" : ""}
                        />

                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Observacoes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        id="observacoes"
                        placeholder="Informacoes adicionais sobre o bem..."
                        className="min-h-24"
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Documentacao</CardTitle>
                      <CardDescription>
                        Anexe a Nota Fiscal ou outros documentos (PDF)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <input
                        ref={pdfInputRef}
                        type="file"
                        accept="application/pdf"
                        onChange={handlePdfChange}
                        className="hidden"
                      />
                      
                      {notaFiscalPdf ? (
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                                    <FileText className="h-5 w-5 text-red-600" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium">Nota Fiscal.pdf</span>
                                    <span className="text-xs text-muted-foreground">Anexado com sucesso</span>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => setNotaFiscalPdf(null)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                      ) : (
                        <Button 
                            variant="outline" 
                            className="w-full gap-2 border-dashed h-12"
                            onClick={() => pdfInputRef.current?.click()}
                        >
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            Anexar Nota Fiscal (PDF)
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  <Card className={fieldErrors.includes("imagem") ? "border-destructive" : ""}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-1">
                        Imagem do Bem <span className="text-destructive">*</span>
                      </CardTitle>
                      <CardDescription>
                        Envie uma foto do equipamento para identificacao visual
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        aria-label="Selecionar imagem do bem"
                      />
                      
                      {/* Hidden canvas for capture */}
                      <canvas ref={canvasRef} className="hidden" />

                      {imagemPreview ? (
                        <div className="relative">
                          <img
                            src={imagemPreview}
                            alt="Preview do bem"
                            className="w-full max-h-48 object-contain rounded-lg border border-border"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7"
                            onClick={() => setImagemPreview(null)}
                          >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Remover imagem</span>
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                            <button
                              type="button"
                              onClick={() => imageInputRef.current?.click()}
                              className="flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed border-border p-6 transition-colors hover:border-primary/50 hover:bg-muted/50"
                            >
                              <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                              <p className="text-sm font-medium">Clique para enviar uma foto</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                JPG, PNG ou WebP
                              </p>
                            </button>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background px-2 text-muted-foreground">Ou</span>
                                </div>
                            </div>

                            <Button 
                              type="button" 
                              variant="outline" 
                              className="w-full"
                              onClick={() => setWebcamTarget('individual')}
                            >
                                <Camera className="mr-2 h-4 w-4" />
                                Usar Webcam
                            </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {isVeiculo && (
              <TabsContent value="veiculo" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Dados do Veiculo</CardTitle>
                    <CardDescription>
                      Informacoes especificas para controle de veiculos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="placa">Placa</Label>
                        <Input id="placa" placeholder="ABC-1D23" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="ano">Ano</Label>
                        <Input id="ano" type="number" placeholder="2025" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="km">KM Atual</Label>
                        <Input id="km" type="number" placeholder="0" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>

          {/* Save button */}
          <div className="flex items-center justify-end gap-4">
            {saved && (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                {savedMessage}
              </div>
            )}
            <Button variant="outline" className="bg-transparent" disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleSave} className="gap-2" disabled={isSubmitting}>
              {isSubmitting ? <Clock className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSubmitting ? "Cadastrando..." : "Cadastrar Bem"}
            </Button>
          </div>
        </>
      )}
      <WebcamModal 
        isOpen={!!webcamTarget} 
        onClose={() => setWebcamTarget(null)} 
        onCapture={handleWebcamCapture} 
      />
    </div>
  )
}
