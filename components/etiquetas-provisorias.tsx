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

interface LabelItem {
  id: string
  numero: string
  descricao: string
  assetId?: string | number
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
  const { data: secretarias = [] } = useSWR<Secretaria[]>("/secretarias", fetcher)

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
  const [columns, setColumns] = useState<string>("2")
  const [labels, setLabels] = useState<LabelItem[]>([])
  
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
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false)
  const [batchQuantity, setBatchQuantity] = useState(10)
  
  // Track printed labels (by label number)
  const [printedLabels, setPrintedLabels] = useState<string[]>([])
  const [hidePrinted, setHidePrinted] = useState(false)

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

  // Fetch next sequence when year changes
  useEffect(() => {
    const fetchNextSeq = async () => {
        try {
            const res = await fetch(`/api/etiquetas-provisorias/next-sequence?ano=${ano}`)
            const data = await res.json()
            if (data.nextSeq) {
                setNextSeq(data.nextSeq)
                setNextSeqFormatted(data.formatted)
            }
        } catch (e) {
            console.error("Failed to fetch next sequence", e)
        }
    }
    fetchNextSeq()
  }, [ano, isBatchDialogOpen]) // Refresh when dialog opens too

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
        descricao: "",
      },
    ])
    setNextSeq(nextSeq + 1)
    toast({
      title: "Sucesso",
      description: "Etiqueta manual adicionada.",
    })
  }, [ano, nextSeq])

  const handleBatchGenerate = async () => {
    if (batchQuantity <= 0) {
      toast({
        title: "Quantidade invalida",
        description: "A quantidade deve ser maior que zero.",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch("/api/etiquetas-provisorias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quantidade: batchQuantity,
          ano: ano
        }),
      })

      if (!response.ok) {
        throw new Error("Erro ao gerar etiquetas")
      }

      const data = await response.json()
      
      const newLabels: LabelItem[] = []
      let seq = nextSeq // This is purely for display if needed, but we use server response
      
      data.tags.forEach((tagCode: string, index: number) => {
        newLabels.push({
          id: `label-batch-${Date.now()}-${index}`,
          numero: tagCode,
          descricao: "",
        })
      })

      setLabels((prev) => [...prev, ...newLabels])
      setIsBatchDialogOpen(false)
      
      toast({
        title: "Sucesso",
        description: `${data.count} etiquetas geradas e salvas com sucesso!`,
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "Erro",
        description: "Nao foi possivel gerar as etiquetas. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
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
        
        const cols = parseInt(columns) || 2
        const labelWidth = 50
        // Aumentamos a altura da página PDF para enganar a impressora.
        // Se a impressora "come" 14mm do topo, vamos criar uma página maior (25mm + 14mm = 39mm).
        // Mas o conteúdo nós desenhamos no topo absoluto dessa página maior.
        // Assim, quando a impressora pular os 14mm, ela vai começar a imprimir onde queremos.
        // Usuário pediu +0,6cm (6mm) de altura extra -> Total 14mm + 6mm = 20mm
        const extraHeight = 20
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
            const marginLeft = colIndex === 0 ? 0 : 3 
            
            // O conteúdo começa no TOPO da página (0), mas como a página é maior e a impressora tem offset,
            // esperamos que o conteúdo "caia" no lugar certo.
            const marginTop = 1 
            
            const xOffset = (colIndex * labelWidth) + marginLeft

            const qrDataUrl = await generateQRCodeDataURL(label.numero)
            
            // --- LAYOUT ---
            const qrSize = 17
            doc.addImage(qrDataUrl, 'PNG', xOffset, marginTop + 1, qrSize, qrSize) 

            // Área de texto
            const textX = xOffset + qrSize + 2
            const maxTextWidth = 26 

            // Título (Aumentado e Negrito)
            doc.setFont("helvetica", "bold")
            if (customTitle) {
                doc.setFontSize(6.5) // Aumentado de 5 para 6.5
                doc.text(customTitle.toUpperCase().substring(0, 25), textX, marginTop + 3) 
                doc.setLineWidth(0.2) // Linha mais grossa
                doc.line(textX, marginTop + 4, xOffset + 45, marginTop + 4)
            }

            // Número (Mantém negrito e tamanho adaptável)
            let fontSize = 9
            doc.setFontSize(fontSize)
            let textWidth = doc.getTextWidth(label.numero)
            while (textWidth > maxTextWidth && fontSize > 5) {
                fontSize -= 0.5
                doc.setFontSize(fontSize)
                textWidth = doc.getTextWidth(label.numero)
            }
            doc.text(label.numero, textX, customTitle ? marginTop + 7 : marginTop + 6) 

            // Descrição (Aumentado e Negrito)
            if (label.descricao) {
                doc.setFont("helvetica", "bold") // Agora em Negrito
                doc.setFontSize(6) // Aumentado de 5.5 para 6
                const splitDesc = doc.splitTextToSize(label.descricao.toUpperCase(), maxTextWidth)
                const lines = splitDesc.length > 3 ? splitDesc.slice(0, 3) : splitDesc
                doc.text(lines, textX, customTitle ? marginTop + 10 : marginTop + 9) 
            }

            // Localização (Aumentado e Negrito)
            if (showLocation && label.localizacao) {
                doc.setFont("helvetica", "bold") // Agora em Negrito
                doc.setFontSize(5.5) // Aumentado de 5 para 5.5
                const locText = `${label.localizacao.departamento} ${label.localizacao.sala}`.toUpperCase()
                const splitLoc = doc.splitTextToSize(locText, maxTextWidth)
                // Subiu de +14.5 para +13.5 para ficar colado na descrição
                doc.text(splitLoc.slice(0, 2), textX, marginTop + 13.5) 
            }

            // Rodapé fixo (Aumentado e Negrito)
            doc.setFont("helvetica", "bold") // Agora em Negrito
            doc.setFontSize(6) // Aumentado de 4.5 para 6 (Bem maior)
            // Baixou de +19 para +21 para aproveitar o espaço embaixo
            doc.text("SISPATRIMONIO", xOffset + 45, marginTop + 21, { align: "right" }) 
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
            variant: "destructive",
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
    // Label size: 5cm width x 2.5cm height
    const labelWidthMm = 50
    const labelHeightMm = 25
    const pageWidthMm = cols * labelWidthMm
    
    // Determine if we should force a specific page size (best for Zebra)
    // If we set height in @page, it forces pagination per label/row
    const pageHeightMm = labelHeightMm

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
          padding: 1.5mm;
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
        ">
          <img src="${qrDataUrl}" style="width: ${labelHeightMm - 4}mm; height: ${labelHeightMm - 4}mm; flex-shrink: 0;" alt="QR" />
          <div style="flex: 1; min-width: 0; text-align: left; display: flex; flex-direction: column; justify-content: center; height: 100%;">
            ${customTitle ? `<div style="font-size: 5pt; font-weight: bold; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 0.5mm; border-bottom: 0.5px solid #000;">${customTitle}</div>` : ""}
            
            <div style="font-size: 7.5pt; font-weight: bold; font-family: monospace; letter-spacing: -0.2px; line-height: 1; margin-top: 0.5mm;">
              ${label.numero}
            </div>
            
            ${label.descricao ? `<div style="font-size: 5.5pt; color: #000; margin-top: 0.5mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; line-height: 1.1;">${label.descricao}</div>` : ""}
            
            ${showLocation && label.localizacao ? `
                <div style="font-size: 4.5pt; color: #000; margin-top: 0.5mm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; line-height: 1;">
                    ${label.localizacao.departamento ? label.localizacao.departamento.substring(0, 20) : ""}
                    ${label.localizacao.sala ? ` - ${label.localizacao.sala.substring(0, 15)}` : ""}
                </div>
            ` : ""}
            
            <div style="font-size: 4pt; color: #000; margin-top: auto; text-transform: uppercase; text-align: right;">SisPatrimonio</div>
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
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Configuracao das Etiquetas</CardTitle>
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
              <div className="flex items-center space-x-2 mt-1">
                <Checkbox 
                  id="show-location" 
                  checked={showLocation} 
                  onCheckedChange={(c) => setShowLocation(!!c)} 
                />
                <Label htmlFor="show-location" className="text-xs font-normal cursor-pointer">
                  Imprimir Depto/Sala
                </Label>
              </div>
            </div>
          </div>
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

      {/* Manual label creation + generated labels list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Etiquetas a Imprimir ({labels.length})
              </CardTitle>
              <CardDescription>
                Adicione etiquetas manualmente ou a partir dos bens acima
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
                      Gere multiplas etiquetas provisorias sequenciais de uma vez.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
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
                        "Gerar Etiquetas"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant="outline" size="sm" className="gap-1.5 bg-transparent" onClick={handleAddManual}>
                <Plus className="h-4 w-4" />
                Adicionar Manual
              </Button>
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
                  Selecione bens acima ou adicione etiquetas manualmente
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
                    <QRCodeCanvas data={label.numero} size={60} className="rounded shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col justify-center h-full text-left">
                      {customTitle && (
                        <p className="text-[8px] font-bold uppercase truncate border-b border-black mb-1">
                          {customTitle}
                        </p>
                      )}
                      <p className="text-[10px] font-mono font-bold tracking-wide leading-none">
                        {label.numero}
                      </p>
                      {label.descricao && (
                        <p className="text-[8px] text-muted-foreground mt-0.5 truncate font-semibold">
                          {label.descricao}
                        </p>
                      )}
                      {showLocation && label.localizacao && (
                        <p className="text-[7px] text-muted-foreground mt-0.5 truncate leading-tight">
                           {label.localizacao.departamento} {label.localizacao.sala ? `- ${label.localizacao.sala}` : ""}
                        </p>
                      )}
                      <p className="text-[6px] text-muted-foreground/60 mt-auto text-right uppercase">
                        SisPatrimonio
                      </p>
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
