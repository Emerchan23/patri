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
} from "lucide-react"
import { api, fetcher } from "@/lib/api-client"
import useSWR, { mutate } from "swr"
import type { AssetCategory } from "@/lib/data"
import { Trash2 } from "lucide-react"
import { EntradaNotaFiscal } from "./entrada-nota-fiscal"
import { DatePicker } from "@/components/ui/date-picker"
import { SearchableSelect } from "@/components/ui/searchable-select"
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
  quantidade: number
  imagem?: string | null
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

import { ResponsavelSelect } from "@/components/responsavel-select"
import { useAuth } from "@/lib/auth-context"

export function CadastroForm() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { data: categorias = [] } = useSWR<Categoria[]>("/categorias", fetcher)
  const { data: marcas = [] } = useSWR<Marca[]>("/marcas", fetcher)
  const { data: secretarias = [] } = useSWR<Secretaria[]>("/secretarias", fetcher)
  
  // Pre-fill location for assistants
  useEffect(() => {
    if (user?.role === "assistente" && user.unidade) {
        setSecretariaSel(user.unidade.secretaria)
        setDepartamentoSel(user.unidade.departamento)
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

  // Fetch next available definitive number when type changes to definitive (Batch mode)
  useEffect(() => {
    if (patrimonioTipo === "definitivo" && modoEntrada === "lote") {
      api.get('/bens/next-number').then((res) => {
        if (res && res.nextNumber) {
          const year = new Date().getFullYear();
          const num = String(res.nextNumber).padStart(5, '0');
          setLotePatrimonioInicial(`PAT-${year}-${num}`)
        }
      }).catch(err => console.error("Error fetching next number:", err))
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
  const [saved, setSaved] = useState(false)
  const [savedMessage, setSavedMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imagemPreview, setImagemPreview] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
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
  
  // Lote manual state
  const [loteItems, setLoteItems] = useState<LoteItem[]>([
    { id: "1", descricao: "", categoria: "", grupo: "", marca: "", modelo: "", fornecedor: "", valor: "", quantidade: 1, imagem: null },
  ])
  const [loteSaved, setLoteSaved] = useState(false)
  const [loteSavedMessage, setLoteSavedMessage] = useState("")
  const [lotePatrimonioInicial, setLotePatrimonioInicial] = useState("")

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

  const selectedSecretaria = secretarias.find((s) => s.nome === secretariaSel)
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

  const handleSave = async () => {
    // Validation
    const missingFields: string[] = []

    if (!descricao) missingFields.push("Descrição")
    if (!categoria) missingFields.push("Categoria")
    if (!grupo) missingFields.push("Grupo")
    if (!secretariaSel) missingFields.push("Secretaria")
    if (!departamentoSel) missingFields.push("Departamento")
    if (!salaSel) missingFields.push("Sala")
    if (!valorIndividual) missingFields.push("Valor")
    if (!dataAquisicao) missingFields.push("Data de Aquisição")
    if (!responsavelNome) missingFields.push("Nome do Responsável")
    if (!responsavelCargo) missingFields.push("Cargo do Responsável")

    if (patrimonioTipo === "definitivo") {
         // @ts-ignore
         const pat = (document.getElementById("patrimonio") as HTMLInputElement)?.value
         if (!pat) missingFields.push("Número do Patrimônio")
    } else {
         if (isManualProvisorio) {
            if (!manualProvisorio) missingFields.push("Número Provisório")
         }
    }
    
    if (missingFields.length > 0) {
        toast({ 
            title: "Campos Obrigatórios Faltando", 
            description: `Por favor, preencha os seguintes campos: ${missingFields.join(", ")}.`, 
            variant: "destructive",
            duration: 5000,
        })
        return
    }

    setIsSubmitting(true)
    try {
      const baseData: any = {
        descricao: descricao,
        categoria: categoria,
        grupo: grupo,
        marca: marcaSel,
        modelo: modelo,
        fornecedor: fornecedorSel,
        numeroSerie: serie,
        dataAquisicao: dataAquisicao ? dataAquisicao.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        valor: parseCurrency(valorIndividual),
        tempoGarantia: tempoGarantia ? parseInt(tempoGarantia) : undefined,
        estadoConservacao: estadoConservacao,
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
        imagem: imagemPreview
      }

      if (patrimonioTipo === "definitivo") {
         // @ts-ignore
         const pat = (document.getElementById("patrimonio") as HTMLInputElement)?.value
         // @ts-ignore
         baseData.patrimonio = pat
      } else {
         if (isManualProvisorio) {
            // User wants standard format even for manual entry
            // Check if user already typed full format to avoid double prefix
            const cleanCode = manualProvisorio.replace(/^PROV-\d{4}-/, '')
            baseData.patrimonioProvisorio = `PROV-${provAno}-${cleanCode}`
         } else {
            // @ts-ignore
            baseData.patrimonioProvisorio = `PROV-${provAno}-AUTO` // Backend should handle auto-generation or we do it here? Usually backend.
         }
      }
      
      // For vehicle
      if (categoria.includes("veicul")) {
        // @ts-ignore
        baseData.placa = (document.getElementById("placa") as HTMLInputElement)?.value
        // @ts-ignore
        baseData.ano = parseInt((document.getElementById("ano") as HTMLInputElement)?.value || "0")
        // @ts-ignore
        baseData.kmAtual = parseInt((document.getElementById("km") as HTMLInputElement)?.value || "0")
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
      
      // Reset form fields
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
      setManualProvisorio("")
      
      // Reset responsavel
      setResponsavelNome("")
      setResponsavelCargo("")

      // Optional: Reset location? User might want to keep it for next item. 
      // User said "duplicar o mesmo objeto", which implies identifying data.
      // Resetting identification data should be enough.
      
      // Reset uncontrolled inputs
      const idsToReset = ["descricao", "modelo", "serie", "valor", "observacoes", "placa", "ano", "km", "patrimonio", "manual-prov"]
      idsToReset.forEach(id => {
        const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement
        if (el) el.value = ""
      })
      
      setTimeout(() => setSaved(false), 5000)
    } catch (error) {
      console.error(error)
      toast({
        title: "Erro ao cadastrar",
        description: "Não foi possível cadastrar o bem. Verifique os dados e tente novamente.",
        variant: "destructive",
      })
      setSavedMessage("Erro ao cadastrar bem.")
      setSaved(true) // Show error
    } finally {
      setIsSubmitting(false)
    }
  }

  // Lote helpers
  const addLoteItem = () => {
    setLoteItems((prev) => [
      ...prev,
      { id: String(Date.now()), descricao: "", categoria: "", grupo: "", marca: "", modelo: "", fornecedor: "", valor: "", quantidade: 1, imagem: null },
    ])
  }

  const removeLoteItem = (id: string) => {
    setLoteItems((prev) => prev.filter((item) => item.id !== id))
  }

  const updateLoteItem = (id: string, field: keyof LoteItem, value: string | number) => {
    setLoteItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
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
    // Validation
    const errors: string[] = []

    if (loteItems.length === 0) errors.push("Adicione pelo menos um item ao lote.")
    if (!secretariaSel) errors.push("Secretaria")
    if (!departamentoSel) errors.push("Departamento")
    if (!salaSel) errors.push("Sala")
    if (!responsavelNome) errors.push("Responsável")
    
    // Check individual items
    loteItems.forEach((item, index) => {
        const itemErrors = []
        if (!item.descricao) itemErrors.push("Descrição")
        if (!item.categoria) itemErrors.push("Categoria")
        if (!item.grupo) itemErrors.push("Grupo")
        
        if (itemErrors.length > 0) {
            errors.push(`Item ${index + 1}: ${itemErrors.join(", ")}`)
        }
    })
    
    if (patrimonioTipo === "definitivo") {
        if (!lotePatrimonioInicial) errors.push("Patrimônio Inicial")
    } else if (isManualProvisorio && !manualProvisorio) {
        errors.push("Número Provisório Inicial")
    }

    if (errors.length > 0) {
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
    
    if (patrimonioTipo === "definitivo") {
        const match = lotePatrimonioInicial.match(/^(.*?)(\d+)$/)
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

    try {
      // Prepare batch data
      const batchData: any[] = []
      
      for (const item of loteItems) {
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
                imagem: item.imagem
              }
              
              if (patrimonioTipo === "definitivo") {
                  const numStr = String(patNumber).padStart(patPadding, '0')
                  newItem.patrimonio = `${patPrefix}${numStr}`
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
      
      // We need an API endpoint for batch creation or loop
      for (const item of batchData) {
         await api.createBem(item)
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
      setLoteItems([{ id: "1", descricao: "", categoria: "", grupo: "", marca: "", modelo: "", fornecedor: "", valor: "", quantidade: 1, imagem: null }])
      setTimeout(() => setLoteSaved(false), 5000)
    } catch (e) {
      console.error(e)
      toast({
        title: "Erro ao cadastrar lote",
        description: "Ocorreu um erro ao salvar o lote. Verifique o console.",
        variant: "destructive",
      })
      setLoteSavedMessage("Erro ao salvar lote.")
      setLoteSaved(true)
    }
  }

  const isVeiculo = categoria.includes("veicul")

  return (
    <div className="flex flex-col gap-6">
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

          {/* Shared location and responsible */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Localizacao e Responsavel (compartilhados)</CardTitle>
              <CardDescription>
                Todos os itens do lote serao cadastrados nesta localizacao
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="flex flex-col gap-2">
                  <Label required>Secretaria</Label>
                  <SearchableSelect
                    value={secretariaSel}
                    onValueChange={(v) => { setSecretariaSel(v); setDepartamentoSel(""); setSalaSel(""); }}
                    placeholder="Selecione a secretaria"
                    searchPlaceholder="Buscar secretaria..."
                    disabled={user?.role === "assistente"}
                    items={secretarias.map((s) => ({
                      value: s.nome,
                      label: s.nome,
                    }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label required>Departamento</Label>
                  <div className="flex gap-2">
                    <div className="w-full">
                      <SearchableSelect
                        value={departamentoSel}
                        onValueChange={(v) => { setDepartamentoSel(v); setSalaSel(""); }}
                        disabled={!secretariaSel || user?.role === "assistente"}
                        placeholder="Selecione o departamento"
                        searchPlaceholder="Buscar departamento..."
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
                  <Label required>Sala</Label>
                  <div className="flex gap-2">
                    <div className="w-full">
                      <SearchableSelect
                        value={salaSel}
                        onValueChange={setSalaSel}
                        disabled={!departamentoSel}
                        placeholder="Selecione a sala"
                        searchPlaceholder="Buscar sala..."
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
                <div className="flex flex-col gap-2">
                  <Label required>Responsavel</Label>
                  <ResponsavelSelect 
                    value={responsavelNome}
                    onValueChange={setResponsavelNome}
                    onSelect={(s) => setResponsavelCargo(s.cargo || "")}
                    placeholder="Selecione o responsável"
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
              
              {patrimonioTipo === "definitivo" && (
                <div className="mt-4 pt-4 border-t">
                    <div className="flex flex-col gap-2 max-w-xs">
                        <Label required>Patrimonio Inicial</Label>
                        <Input 
                            placeholder="Ex: PAT-2025-0001" 
                            id="lote-pat-inicial"
                            value={lotePatrimonioInicial}
                            onChange={(e) => setLotePatrimonioInicial(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            A sequencia sera gerada a partir deste numero.
                        </p>
                    </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lote items table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Itens do Lote</CardTitle>
                <CardDescription>
                  Adicione varios itens diferentes. Cada linha pode ter uma quantidade diferente.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addLoteItem}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Item
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-center font-medium text-muted-foreground pb-2 pr-2 w-24">Img</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2">Descricao</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2">Categoria</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2">Grupo</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2">Marca</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2">Fornecedor</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2">Modelo</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2">Valor (R$)</th>
                      <th className="text-left font-medium text-muted-foreground pb-2 pr-2 w-20">Qtd</th>
                      <th className="w-10 pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {loteItems.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-2 pr-2 align-middle">
                          <div className="flex items-center justify-center gap-1">
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
                        <td className="py-2 pr-2">
                          <Input
                            placeholder="Descricao do bem"
                            value={item.descricao}
                            onChange={(e) => updateLoteItem(item.id, "descricao", e.target.value)}
                            className="text-sm"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <CategoriaSelector
                            value={item.categoria}
                            onValueChange={(v) => updateLoteItem(item.id, "categoria", v)}
                            placeholder="Selecione"
                            className="w-full"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <GroupSelector
                            value={item.grupo}
                            onValueChange={(v) => updateLoteItem(item.id, "grupo", v)}
                            placeholder="Grupo"
                            className="w-full"
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
                            className="text-sm"
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
            <Button onClick={handleSaveLote} className="gap-2">
              <Save className="h-4 w-4" />
              Cadastrar Lote ({loteItems.reduce((sum, item) => sum + (item.quantidade || 1), 0)} itens)
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
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="patrimonio" required>Numero de Patrimonio</Label>
                        <Input
                          id="patrimonio"
                          placeholder="PAT-2026-XXXXX"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="descricao" required>Descricao do Bem</Label>
                      <Input 
                        id="descricao" 
                        placeholder="Ex: Computador Dell OptiPlex 7010" 
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="categoria" required>Categoria</Label>
                      <CategoriaSelector
                        value={categoria}
                        onValueChange={(v) => setCategoria(v as AssetCategory)}
                        placeholder="Selecione ou crie uma categoria"
                        className="w-full"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="grupo" required>Grupo</Label>
                      <GroupSelector
                        value={grupo}
                        onValueChange={setGrupo}
                        placeholder="Selecione ou crie um grupo (ex: No Break, Computador)"
                        className="w-full"
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
                        <Label required>Data de Aquisicao</Label>
                        <DatePicker date={dataAquisicao} setDate={setDataAquisicao} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="valor" required>Valor (R$)</Label>
                        <Input
                          id="valor"
                          placeholder="R$ 0,00"
                          value={valorIndividual}
                          onChange={(e) => setValorIndividual(formatCurrency(e.target.value))}
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
                    {quantidade > 1 && (
                      <div className="flex items-start gap-2 rounded-lg bg-info/10 p-3">
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
                        <Label htmlFor="secretaria" required>Secretaria</Label>
                        <SearchableSelect
                          value={secretariaSel}
                          onValueChange={(v) => {
                            setSecretariaSel(v)
                            setDepartamentoSel("")
                            setSalaSel("")
                          }}
                          placeholder="Selecione a secretaria"
                          searchPlaceholder="Buscar secretaria..."
                          disabled={user?.role === "assistente"}
                          items={secretarias.map((s) => ({
                            value: s.nome,
                            label: s.nome,
                          }))}
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label htmlFor="departamento" required>Departamento</Label>
                        <div className="flex gap-2">
                          <div className="w-full">
                            <SearchableSelect
                              value={departamentoSel}
                              onValueChange={(v) => {
                                setDepartamentoSel(v)
                                setSalaSel("")
                              }}
                              disabled={!secretariaSel || user?.role === "assistente"}
                              placeholder="Selecione o departamento"
                              searchPlaceholder="Buscar departamento..."
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
                        <Label htmlFor="sala" required>Sala</Label>
                        <div className="flex gap-2">
                          <div className="w-full">
                            <SearchableSelect
                              value={salaSel}
                              onValueChange={setSalaSel}
                              disabled={!departamentoSel}
                              placeholder="Selecione a sala"
                              searchPlaceholder="Buscar sala..."
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
                        <Label required>Nome do Responsavel</Label>
                        <ResponsavelSelect 
                            value={responsavelNome}
                            onValueChange={setResponsavelNome}
                            onSelect={(s) => setResponsavelCargo(s.cargo || "")}
                            placeholder="Selecione o responsável"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label required>Cargo</Label>
                        <Input 
                            value={responsavelCargo || ""}
                            onChange={(e) => setResponsavelCargo(e.target.value)}
                            placeholder="Ex: Coordenadora de RH"
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
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Imagem do Bem</CardTitle>
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
            <Button variant="outline" className="bg-transparent">Cancelar</Button>
            <Button onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" />
              Cadastrar Bem
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
