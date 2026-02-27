"use client"

import { GroupSelector } from "@/components/group-selector"
import { useState, useCallback, useRef, useEffect } from "react"
import useSWR, { mutate } from "swr"
import { api, fetcher } from "@/lib/api-client"
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
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { AssetCategory } from "@/lib/data"
import { CategoriaSelector } from "@/components/categoria-selector"
import { MarcaSelector } from "@/components/marca-selector"
import { PatrimonioTypeSelector, PatrimonioType } from "@/components/patrimonio-type-selector"
import { ResponsavelSelect } from "@/components/responsavel-select"

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
  imagem?: string | null
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
  cnpjFornecedor: string
  valorTotal: number
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

    const info: NfInfo = {
      numero: ide ? getText(ide, "nNF") : "",
      serie: ide ? getText(ide, "serie") : "",
      chaveAcesso: "",
      dataEmissao: ide ? (getText(ide, "dhEmi") || getText(ide, "dEmi")) : "",
      fornecedor: emit ? getText(emit, "xNome") : "",
      cnpjFornecedor: emit ? (getText(emit, "CNPJ") || getText(emit, "CPF")) : "",
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

function formatCnpj(cnpj: string): string {
  if (!cnpj || cnpj.length !== 14) return cnpj
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
}

// Demo XML content removed for production
// const DEMO_XML_1 = ...
// const DEMO_XML_2 = ...

export function EntradaNotaFiscal() {
  const { toast } = useToast()
  const { data: secretarias = [] } = useSWR<any[]>("/secretarias", fetcher)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
  const [patrimonioInicial, setPatrimonioInicial] = useState("")
  const [isManualProvisorio, setIsManualProvisorio] = useState(false)
  const [manualProvisorioStart, setManualProvisorioStart] = useState("")
  const [provAno, setProvAno] = useState(new Date().getFullYear().toString())

  useEffect(() => {
    if (patrimonioTipo === "definitivo") {
      api.get('/bens/next-number').then((res) => {
        if (res && res.nextNumber) {
          const year = new Date().getFullYear();
          const num = String(res.nextNumber).padStart(5, '0');
          setPatrimonioInicial(`PAT-${year}-${num}`)
        }
      }).catch(err => console.error("Error fetching next number:", err))
    }
  }, [patrimonioTipo])

  const selectedSecretaria = secretarias.find((s: any) => s.nome === secretariaSel)
  const selectedDepartamento = selectedSecretaria?.departamentos.find(
    (d: any) => d.nome === departamentoSel
  )

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
        mutate("/secretarias")
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
        mutate("/secretarias")
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
        imagem: null,
      },
    ])
  }

  const handleGerarPatrimonios = async () => {
    // Validate items
    const missingCategory = itens.find(i => !i.categoria)
    if (missingCategory) {
      toast({
        title: "Dados incompletos",
        description: `O item "${missingCategory.descricaoEditada || missingCategory.descricaoOriginal}" está sem categoria. Selecione uma categoria para todos os itens.`,
        variant: "destructive"
      })
      return
    }

    let currentPatNumber = 0
    let currentPatPrefix = ""
    let currentPatPadding = 0

    if (patrimonioTipo === "definitivo") {
        if (!patrimonioInicial) {
             toast({ title: "Erro", description: "Informe o numero de patrimonio inicial.", variant: "destructive" })
             return
        }
        const match = patrimonioInicial.match(/^(.*?)(\d+)$/)
        if (match) {
            currentPatPrefix = match[1]
            currentPatNumber = parseInt(match[2])
            currentPatPadding = match[2].length
        } else {
             toast({ title: "Erro", description: "Formato de patrimonio invalido. Use algo como PAT-001", variant: "destructive" })
             return
        }
    } else {
        if (isManualProvisorio) {
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
            // Auto provisional - Fetch latest sequence
            try {
                const res = await api.get('/bens?limit=1');
                if (res && res.meta && res.meta.nextProvisionalSeq) {
                    currentPatNumber = res.meta.nextProvisionalSeq;
                } else {
                    currentPatNumber = 1;
                }
            } catch (e) {
                console.error("Erro ao buscar sequencia provisoria:", e);
                currentPatNumber = 1;
            }
            currentPatPadding = 5
        }
    }

    const patrimonios: PatrimonioGerado[] = []
    for (const item of itens) {
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

        patrimonios.push({
          id: `pat-${item.id}-${i}`,
          itemId: item.id,
          numero: numeroPat,
          descricao: item.descricaoEditada || item.descricaoOriginal,
          categoria: item.categoria,
          grupo: item.grupo,
          marca: item.marca,
          modelo: item.modelo,
          valorUnitario: item.valorUnitario,
          indice: i + 1,
          total: item.quantidade,
          imagem: item.imagem,
        })
      }
    }
    setPatrimoniosGerados(patrimonios)
    setStep("confirmacao")
  }

  const handleConfirmarEntrada = async () => {
    // Validation
    const missingFields: string[] = []
    
    if (!secretariaSel) missingFields.push("Secretaria")
    if (!departamentoSel) missingFields.push("Departamento")
    if (!salaSel) missingFields.push("Sala")
    if (!responsavel) missingFields.push("Responsável")
    
    if (missingFields.length > 0) {
      toast({
        title: "Campos Obrigatórios Faltando",
        description: `Por favor, preencha os seguintes campos: ${missingFields.join(", ")}.`,
        variant: "destructive",
        duration: 5000,
      })
      return
    }

    setLoading(true)
    try {
      // Auto-create supplier if needed and not exists
      if (notaInfo?.fornecedor && notaInfo?.cnpjFornecedor) {
         try {
            await api.createFornecedor({
                nome: notaInfo.fornecedor,
                cnpj: notaInfo.cnpjFornecedor
            });
         } catch (e) {
             console.log("Fornecedor ja existe ou erro ao criar automatico:", e);
         }
      }

      // Create assets one by one
      const promises = patrimoniosGerados.map((pat) => {
        const payload: any = {
          descricao: pat.descricao,
          categoria: pat.categoria || "outros",
          grupo: pat.grupo,
          marca: pat.marca,
          modelo: pat.modelo,
          valor: pat.valorUnitario,
          localizacao: {
            secretaria: secretariaSel,
            departamento: departamentoSel,
            sala: salaSel,
          },
          responsavel: {
            nome: responsavel,
            cargo: cargoResponsavel
          },
          data_aquisicao: notaInfo?.dataEmissao ? new Date(notaInfo.dataEmissao).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          estadoConservacao: "novo",
          status: "ativo",
          observacoes: `Importado via NF ${notaInfo?.numero} - Fornecedor: ${notaInfo?.fornecedor}`,
          patrimonioTipo: patrimonioTipo,
          imagem: pat.imagem,
          fornecedor: notaInfo?.fornecedor || "Não Informado",
        }
        
        if (patrimonioTipo === "definitivo") {
            payload.patrimonio = pat.numero
        } else {
            payload.patrimonioProvisorio = pat.numero
        }
        
        return api.createBem(payload)
      })
      
      await Promise.all(promises)

      toast({
        title: "Sucesso",
        description: `${patrimoniosGerados.length} bens cadastrados com sucesso.`
      })
      setShowConfirmDialog(false)
      setStep("concluido")
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao salvar os bens. Tente novamente."
      })
    } finally {
      setLoading(false)
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
      "https://www.fsist.com.br/",
      "_blank"
    )
  }, [handleCopyChave])

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
  }

  // ========================
  // Step 1: Upload XML
  // ========================
  if (step === "upload") {
    return (
      <div className="flex flex-col gap-6">
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
              {notaInfo?.cnpjFornecedor && (
                <span>
                  <span className="font-medium text-foreground">CNPJ:</span>{" "}
                  {formatCnpj(notaInfo.cnpjFornecedor)}
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
                        <Label required>Patrimonio Inicial</Label>
                        <Input 
                            placeholder="Ex: PAT-2025-0001" 
                            value={patrimonioInicial}
                            onChange={(e) => setPatrimonioInicial(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            A sequencia sera gerada a partir deste numero para todos os {totalItens} itens.
                        </p>
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
                <Label htmlFor="sec-lote" required>Secretaria</Label>
                <Select
                  value={secretariaSel}
                  onValueChange={(v) => {
                    setSecretariaSel(v)
                    setDepartamentoSel("")
                    setSalaSel("")
                  }}
                >
                  <SelectTrigger id="sec-lote">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {secretarias.map((s) => (
                      <SelectItem key={s.nome} value={s.nome}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="dep-lote" required>Departamento</Label>
                <div className="flex gap-2">
                  <Select
                    value={departamentoSel}
                    onValueChange={(v) => {
                      setDepartamentoSel(v)
                      setSalaSel("")
                    }}
                    disabled={!secretariaSel}
                  >
                    <SelectTrigger id="dep-lote" className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedSecretaria?.departamentos.map((d: any) => (
                        <SelectItem key={d.nome} value={d.nome}>
                          {d.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <Label htmlFor="sala-lote" required>Sala</Label>
                <div className="flex gap-2">
                  <Select value={salaSel} onValueChange={setSalaSel} disabled={!departamentoSel}>
                    <SelectTrigger id="sala-lote" className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedDepartamento?.salas.map((s: any) => {
                        const salaNome = typeof s === 'object' ? s.nome : s
                        const salaKey = typeof s === 'object' ? s.id : s
                        return (
                          <SelectItem key={salaKey} value={salaNome}>
                            {salaNome}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
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
                <Label required>Responsavel</Label>
                <ResponsavelSelect 
                  value={responsavel}
                  onValueChange={setResponsavel}
                  onSelect={(s) => setCargoResponsavel(s.cargo || "")}
                  placeholder="Selecione o responsável"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label required>Cargo</Label>
                <Input
                  id="cargo-lote"
                  placeholder="Cargo do responsavel"
                  value={cargoResponsavel || ""}
                  onChange={(e) => setCargoResponsavel(e.target.value)}
                />

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
                            <div className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-4 hover:bg-muted/50 transition-colors h-[220px] bg-background">
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

                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium" required>Categoria</Label>
                                <CategoriaSelector
                                    value={item.categoria}
                                    onValueChange={(v) =>
                                    handleUpdateItem(item.id, "categoria", v as AssetCategory)
                                    }
                                    placeholder="Selecione"
                                    className="w-full"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-medium">Grupo</Label>
                                <GroupSelector
                                    value={item.grupo}
                                    onValueChange={(v) => handleUpdateItem(item.id, "grupo", v)}
                                    placeholder="Grupo"
                                    className="w-full"
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
          <Button onClick={() => setShowConfirmDialog(true)} className="gap-2">
            <Save className="h-4 w-4" />
            Confirmar Entrada ({patrimoniosGerados.length} bens)
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
                  <span className="font-medium">{notaInfo?.fornecedor}</span>
                </div>
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
              >
                Cancelar
              </Button>
              <Button onClick={handleConfirmarEntrada} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Confirmar
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
                <span className="font-medium">{notaInfo?.fornecedor}</span>
              </div>
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
