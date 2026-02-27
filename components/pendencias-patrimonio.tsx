"use client"

import { useState } from "react"
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  AlertTriangle,
  Clock,
  CheckCircle2,
  Tag,
  MapPin,
  User,
  Package,
  Send,
  Printer,
  Search,
  Building2,
  Calendar,
  ArrowRight,
  FileCheck,
  Save,
  ImageIcon,
} from "lucide-react"
import {
  getStatusLabel,
  getStatusColor,
  getCategoryLabel,
  formatCurrency,
  formatDate,
  type PdfSettings,
} from "@/lib/data"
import type { Asset } from "@/lib/data"
import { gerarRelatorioProvisorio } from "@/lib/pdf-generator"
import { useAuth } from "@/lib/auth-context"
import { api, fetcher } from "@/lib/api-client"
import useSWR, { useSWRConfig } from "swr"
import { useToast } from "@/components/ui/use-toast"

export function PendenciasPatrimonio() {
  const { mutate } = useSWRConfig()
  const { toast } = useToast()
  const { user } = useAuth()
  const [search, setSearch] = useState("")
  const [secretariaFilter, setSecretariaFilter] = useState<string>("todos")
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [showAtribuirDialog, setShowAtribuirDialog] = useState(false)
  const [showAtribuirLoteDialog, setShowAtribuirLoteDialog] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [definitiveNumber, setDefinitiveNumber] = useState("")
  // const [batchPrefix, setBatchPrefix] = useState("PAT-2025-") // Removed prefix
  const [batchStartNumber, setBatchStartNumber] = useState("00500")
  const [saved, setSaved] = useState(false)

  // Load data from API
  const { data: bensResult } = useSWR("/bens?limit=1000", fetcher)
  const { data: veiculos = [] } = useSWR<Asset[]>("/veiculos", fetcher)
  const { data: pdfSettings } = useSWR<PdfSettings>("/configuracoes/pdf", fetcher)

  // Handle API response structure (array or object with data property)
  const bens = Array.isArray(bensResult) ? bensResult : (bensResult?.data || [])

  // Combine and deduplicate assets to avoid key collisions
  // Use a Map to ensure unique IDs
  const assetsMap = new Map<string | number, Asset>()
  
  // Add bens first
  bens.forEach((asset: Asset) => {
    if (asset && asset.id) assetsMap.set(asset.id, asset)
  })
  
  // Add veiculos (might overwrite if duplicates exist, which is fine)
  if (Array.isArray(veiculos)) {
    veiculos.forEach((asset: Asset) => {
      if (asset && asset.id) assetsMap.set(asset.id, asset)
    })
  }

  const allAssets = Array.from(assetsMap.values())
  
  const provisorios = allAssets.filter((a) => 
    a.patrimonioTipo === "provisorio" || 
    !a.patrimonio || 
    a.patrimonio.trim() === ""
  )

  const filtered = provisorios.filter((asset) => {
    const matchSearch =
      search === "" ||
      asset.descricao.toLowerCase().includes(search.toLowerCase()) ||
      (asset.patrimonio && asset.patrimonio.toLowerCase().includes(search.toLowerCase())) ||
      (typeof asset.responsavel === 'object' && asset.responsavel?.nome.toLowerCase().includes(search.toLowerCase())) ||
      (typeof asset.responsavel === 'string' && asset.responsavel.toLowerCase().includes(search.toLowerCase()))

    const matchSecretaria =
      secretariaFilter === "todos" || (asset.localizacao && asset.localizacao.secretaria.includes(secretariaFilter))

    return matchSearch && matchSecretaria
  })

  // Group by secretaria
  const bySecretaria = filtered.reduce(
    (acc, asset) => {
      const key = asset.localizacao.secretaria
      if (!acc[key]) acc[key] = []
      acc[key].push(asset)
      return acc
    },
    {} as Record<string, Asset[]>
  )

  const getDaysWaiting = (dateStr?: string) => {
    if (!dateStr) return 0
    return Math.floor(
      (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
    )
  }

  // Count by days waiting
  const waitingStats = {
    total: provisorios.length,
    menosDe30: provisorios.filter((a) => getDaysWaiting(a.dataAquisicao) < 30).length,
    entre30e60: provisorios.filter((a) => {
      const days = getDaysWaiting(a.dataAquisicao)
      return days >= 30 && days < 60
    }).length,
    maisDe60: provisorios.filter((a) => getDaysWaiting(a.dataAquisicao) >= 60).length,
  }

  const toggleItem = (id: string | number) => {
    const strId = String(id)
    setSelectedItems((prev) =>
      prev.includes(strId) ? prev.filter((i) => i !== strId) : [...prev, strId]
    )
  }

  const toggleAll = () => {
    if (selectedItems.length === filtered.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(filtered.map((a) => String(a.id)))
    }
  }

  const handleAtribuirIndividual = async () => {
    if (!selectedAsset || !definitiveNumber.trim()) {
      toast({
        title: "Erro de validação",
        description: "Por favor, preencha o número de patrimônio definitivo.",
        variant: "destructive",
      })
      return
    }
    
    // Check for duplicate
    const exists = allAssets.some(a => a.patrimonio === definitiveNumber && a.id !== selectedAsset.id)
    if (exists) {
        toast({
            title: "Erro de duplicidade",
            description: `O patrimônio ${definitiveNumber} já existe no sistema.`,
            variant: "destructive",
        })
        return
    }

    try {
      const updateData = {
        ...selectedAsset,
        patrimonio: definitiveNumber,
        patrimonioTipo: "definitivo",
        numero_patrimonio: definitiveNumber,
      }

      if (selectedAsset.categoria === 'veiculo' || selectedAsset.categoria === 'Veiculo') {
        await api.updateVeiculo(selectedAsset.id, updateData)
      } else {
        await api.updateBem(selectedAsset.id, updateData)
      }
      
      // Optimistic update
      await mutate("/bens?limit=1000", async (currentData: any) => {
        // If it's an array
        if (Array.isArray(currentData)) {
            return currentData.map(b => b.id === selectedAsset.id ? { ...b, ...updateData } : b)
        }
        // If it's an object with data property
        if (currentData?.data) {
             return { ...currentData, data: currentData.data.map((b: any) => b.id === selectedAsset.id ? { ...b, ...updateData } : b) }
        }
        return currentData
      }, { revalidate: true })
      
      mutate("/veiculos")

      toast({
        title: "Sucesso",
        description: `Patrimônio ${definitiveNumber} atribuído com sucesso!`,
      })
      
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setShowAtribuirDialog(false)
        setSelectedAsset(null)
        setDefinitiveNumber("")
      }, 1500)
    } catch (error) {
      console.error("Erro ao atribuir patrimonio:", error)
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Não foi possível atribuir o patrimônio. Tente novamente.",
        variant: "destructive",
      })
    }
  }

  const handleAtribuirLote = async () => {
    if (selectedItems.length === 0) {
      toast({
        title: "Seleção vazia",
        description: "Selecione pelo menos um bem para atribuir.",
        variant: "destructive",
      })
      return
    }

    try {
      const startNum = parseInt(batchStartNumber) || 0
      const updatesToProcess: { asset: Asset; newPatrimonio: string }[] = []

      // First pass: Validate all items
      for (let i = 0; i < selectedItems.length; i++) {
        const id = selectedItems[i]
        const asset = allAssets.find((a) => a.id === id)
        if (!asset) continue
        
        const currentNum = startNum + i
        const newNum = String(currentNum).padStart(Math.max(batchStartNumber.length, 5), "0")
        const newPatrimonio = newNum // No prefix

        // Check for duplicates
        const exists = allAssets.some(a => a.patrimonio === newPatrimonio && a.id !== id)
        if (exists) {
            toast({
                title: "Erro de duplicidade",
                description: `O patrimônio ${newPatrimonio} já existe. Ajuste o número inicial.`,
                variant: "destructive",
            })
            return
        }
        
        updatesToProcess.push({ asset, newPatrimonio })
      }

      // Second pass: Update
      const updates = updatesToProcess.map(({ asset, newPatrimonio }) => {
        const updateData = {
          ...asset,
          patrimonio: newPatrimonio,
          patrimonioTipo: "definitivo",
          numero_patrimonio: newPatrimonio,
        }

        if (asset.categoria === 'veiculo' || asset.categoria === 'Veiculo') {
            return api.updateVeiculo(asset.id, updateData)
        }
        return api.updateBem(asset.id, updateData)
      })

      await Promise.all(updates)
      
      // Optimistic update for batch
      await mutate("/bens?limit=1000", async (currentData: any) => {
          let newData = currentData
          if (Array.isArray(currentData)) {
              newData = [...currentData]
              updatesToProcess.forEach(({ asset, newPatrimonio }) => {
                 const idx = newData.findIndex((b: any) => b.id === asset.id)
                 if (idx !== -1) {
                     newData[idx] = { ...newData[idx], patrimonio: newPatrimonio, patrimonioTipo: "definitivo", numero_patrimonio: newPatrimonio }
                 }
              })
              return newData
          }
          if (currentData?.data) {
               const newDataList = [...currentData.data]
               updatesToProcess.forEach(({ asset, newPatrimonio }) => {
                 const idx = newDataList.findIndex((b: any) => b.id === asset.id)
                 if (idx !== -1) {
                     newDataList[idx] = { ...newDataList[idx], patrimonio: newPatrimonio, patrimonioTipo: "definitivo", numero_patrimonio: newPatrimonio }
                 }
               })
               return { ...currentData, data: newDataList }
          }
          return currentData
      }, { revalidate: true })
      
      mutate("/veiculos")
      
      toast({
        title: "Sucesso",
        description: `${selectedItems.length} patrimônios atribuídos em lote!`,
      })
      
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setShowAtribuirLoteDialog(false)
        setSelectedItems([])
      }, 1500)
    } catch (error) {
      console.error("Erro ao atribuir lote:", error)
      toast({
        title: "Erro ao processar lote",
        description: "Ocorreu um erro ao atribuir os patrimônios. Verifique o console.",
        variant: "destructive",
      })
    }
  }


  const getDaysColor = (days: number) => {
    if (days < 30) return "text-success"
    if (days < 60) return "text-warning"
    return "text-destructive"
  }

  const handleImprimirRelatorio = () => {
    const dataParaRelatorio = filtered.map(asset => ({
      patrimonio: asset.patrimonio || "",
      descricao: asset.descricao,
      categoria: asset.categoria,
      localizacao: asset.localizacao,
      responsavel: typeof asset.responsavel === 'string' 
        ? { nome: asset.responsavel } 
        : asset.responsavel || { nome: "Não informado" },
      valor: asset.valor || 0,
      patrimonioTipo: asset.patrimonioTipo || "provisorio",
      dataAquisicao: asset.dataAquisicao ? asset.dataAquisicao.split('T')[0] : new Date().toISOString().split('T')[0]
    }))

    gerarRelatorioProvisorio(dataParaRelatorio, {
      secretaria: secretariaFilter !== "todos" ? secretariaFilter : undefined,
      settings: pdfSettings
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">
            Pendencias de Patrimonio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bens aguardando numero de patrimonio definitivo da prefeitura
          </p>
        </div>
        <div className="flex gap-2">
          {selectedItems.length > 0 && (
            <Button
              className="gap-2"
              onClick={() => setShowAtribuirLoteDialog(true)}
            >
              <Tag className="h-4 w-4" />
              Atribuir em Lote ({selectedItems.length})
            </Button>
          )}
          <Button 
            variant="outline" 
            className="gap-2 bg-transparent"
            onClick={handleImprimirRelatorio}
          >
            <Printer className="h-4 w-4" />
            Imprimir Relatorio
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-l-4 border-l-warning">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Pendentes</p>
              <p className="text-2xl font-bold">{waitingStats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10">
              <Clock className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{"< 30 dias"}</p>
              <p className="text-2xl font-bold">{waitingStats.menosDe30}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">30-60 dias</p>
              <p className="text-2xl font-bold">{waitingStats.entre30e60}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
              <Clock className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{"> 60 dias"}</p>
              <p className="text-2xl font-bold">{waitingStats.maisDe60}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow explanation */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                1
              </div>
              <div>
                <p className="text-sm font-medium">Identificar pendencias</p>
                <p className="text-xs text-muted-foreground">Bens sem patrimonio definitivo</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary hidden lg:block" />
            <div className="flex items-center gap-3 flex-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                2
              </div>
              <div>
                <p className="text-sm font-medium">Gerar patrimonio</p>
                <p className="text-xs text-muted-foreground">Atribuir numero definitivo</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary hidden lg:block" />
            <div className="flex items-center gap-3 flex-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                3
              </div>
              <div>
                <p className="text-sm font-medium">Enviar etiquetas</p>
                <p className="text-xs text-muted-foreground">Unidade cola as etiquetas</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary hidden lg:block" />
            <div className="flex items-center gap-3 flex-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-xs font-bold text-success">
                4
              </div>
              <div>
                <p className="text-sm font-medium text-success">Concluido</p>
                <p className="text-xs text-muted-foreground">Assistente confirma colagem</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por descricao, patrimonio provisorio, responsavel..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={secretariaFilter} onValueChange={setSecretariaFilter}>
              <SelectTrigger className="w-52">
                <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Secretaria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Secretarias</SelectItem>
                <SelectItem value="Administracao">Sec. Administracao</SelectItem>
                <SelectItem value="Educacao">Sec. Educacao</SelectItem>
                <SelectItem value="Saude">Sec. Saude</SelectItem>
                <SelectItem value="Obras">Sec. Obras</SelectItem>
                <SelectItem value="Financas">Sec. Financas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table of pending items */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {filtered.length} bens pendentes
            </CardTitle>
            {filtered.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={toggleAll}>
                {selectedItems.length === filtered.length
                  ? "Desmarcar Todos"
                  : "Selecionar Todos"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead className="w-[60px]">Foto</TableHead>
                  <TableHead>Prov. Patrimonio</TableHead>
                  <TableHead>Descricao</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden lg:table-cell">Unidade</TableHead>
                  <TableHead className="hidden md:table-cell">Responsavel</TableHead>
                  <TableHead>Dias Aguardando</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((asset) => {
                  const days = getDaysWaiting(asset.dataAquisicao)
                  return (
                    <TableRow
                      key={asset.id}
                      className={selectedItems.includes(String(asset.id)) ? "bg-primary/5" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(String(asset.id))}
                          onCheckedChange={() => toggleItem(asset.id)}
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
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="font-mono text-[11px] border-warning/50 text-warning"
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            {asset.patrimonio || "Sem Patrimônio"}
                          </Badge>
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
                        <Badge variant="secondary" className="text-xs">
                          {getCategoryLabel(asset.categoria)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">
                            {asset.localizacao.departamento}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {asset.localizacao.sala}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm">{typeof asset.responsavel === 'object' ? asset.responsavel.nome : asset.responsavel}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-bold ${getDaysColor(days)}`}>
                            {days}d
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => {
                              setSelectedAsset(asset)
                              setShowAtribuirDialog(true)
                            }}
                          >
                            <Tag className="h-3.5 w-3.5" />
                            Atribuir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-8 w-8 text-success" />
                        <p className="text-sm font-medium text-success">
                          Nenhuma pendencia encontrada!
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Todos os bens possuem patrimonio definitivo.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Individual assign dialog */}
      <Dialog
        open={showAtribuirDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowAtribuirDialog(false)
            setSelectedAsset(null)
            setDefinitiveNumber("")
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir Patrimonio Definitivo</DialogTitle>
            <DialogDescription>
              Confirme os dados e insira o número do patrimônio definitivo.
            </DialogDescription>
          </DialogHeader>
          {selectedAsset && (
            <div className="flex flex-col gap-4 mt-2">
              {/* Asset Image Banner */}
              <div className="flex justify-center rounded-lg border bg-muted/30 p-2">
                 {selectedAsset.imagem ? (
                   <img 
                     src={selectedAsset.imagem} 
                     alt={selectedAsset.descricao}
                     className="max-h-[150px] w-auto rounded-md object-contain"
                   />
                 ) : (
                   <div className="flex flex-col items-center justify-center py-4 text-muted-foreground/50">
                     <ImageIcon className="h-8 w-8 mb-1" />
                     <p className="text-[10px]">Sem foto</p>
                   </div>
                 )}
              </div>

              {/* Asset info */}
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-semibold">{selectedAsset.descricao}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] border-warning/50 text-warning font-mono"
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    {selectedAsset.patrimonio}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {selectedAsset.localizacao.departamento}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {typeof selectedAsset.responsavel === 'object' ? selectedAsset.responsavel.nome : selectedAsset.responsavel}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(selectedAsset.dataAquisicao)}
                  </span>
                </div>
              </div>

              {/* Input */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="definitivo-num">Numero de Patrimonio Definitivo</Label>
                <Input
                  id="definitivo-num"
                  placeholder="PAT-2025-XXXXX"
                  value={definitiveNumber}
                  onChange={(e) => setDefinitiveNumber(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Digite o numero oficial recebido da prefeitura para gerar a etiqueta
                </p>
              </div>

              {/* Info */}
              <div className="flex items-center gap-2 rounded-lg bg-info/10 p-3">
                <Send className="h-4 w-4 text-info shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Apos confirmar, a etiqueta sera disponibilizada para o assistente da unidade
                  ({selectedAsset.localizacao.departamento}) colar no equipamento.
                </p>
              </div>

              {saved && (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Patrimonio definitivo atribuido com sucesso!
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAtribuirDialog(false)
                    setSelectedAsset(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="gap-2"
                  disabled={!definitiveNumber.trim()}
                  onClick={handleAtribuirIndividual}
                >
                  <FileCheck className="h-4 w-4" />
                  Confirmar e Gerar Etiqueta
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Batch assign dialog */}
      <Dialog
        open={showAtribuirLoteDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowAtribuirLoteDialog(false)
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Atribuir Patrimonio em Lote</DialogTitle>
            <DialogDescription>
              Atribua números de patrimônio sequenciais para os bens selecionados.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div className="rounded-lg bg-warning/10 border border-warning/30 p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <p className="text-sm font-semibold">
                  {selectedItems.length} bens selecionados
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Os numeros serao atribuidos sequencialmente a partir do numero inicial informado.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Numero Inicial</Label>
                <Input
                  value={batchStartNumber}
                  onChange={(e) => setBatchStartNumber(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Pre-visualizacao
              </p>
              <div className="flex flex-col gap-1.5">
                {selectedItems.length > 0 ? (
                  selectedItems.slice(0, 5).map((id, i) => {
                    const asset = allAssets.find((a) => a.id === id)
                    // Generate number based on start number + index
                    // Use parseInt to handle numeric addition, then convert back to string
                    const startNum = parseInt(batchStartNumber) || 0
                    const currentNum = startNum + i
                    // Pad with leading zeros to match the input length or default to 5
                    const numStr = String(currentNum).padStart(Math.max(batchStartNumber.length, 5), "0")
                    
                    return (
                      <div key={id} className="flex items-center gap-2 text-sm">
                        <div className="h-8 w-8 shrink-0 rounded border bg-muted flex items-center justify-center overflow-hidden">
                          {asset?.imagem ? (
                            <img 
                              src={asset.imagem} 
                              alt={asset.descricao}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="w-24 shrink-0">
                          <Badge variant="outline" className="w-full justify-center font-mono text-[10px] border-warning/50 text-warning">
                            {asset?.patrimonio || "N/A"}
                          </Badge>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <div className="w-28 shrink-0">
                          <Badge className="w-full justify-center font-mono text-[10px] bg-success text-success-foreground hover:bg-success/90">
                            {numStr}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground truncate min-w-0 flex-1" title={asset?.descricao}>
                          {asset?.descricao}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Nenhum item selecionado
                  </p>
                )}
                {selectedItems.length > 5 && (
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    ... e mais {selectedItems.length - 5} itens
                  </p>
                )}
              </div>
            </div>

            {saved && (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                {selectedItems.length} patrimonios atribuidos com sucesso!
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAtribuirLoteDialog(false)}>
                Cancelar
              </Button>
              <Button className="gap-2" onClick={handleAtribuirLote}>
                <FileCheck className="h-4 w-4" />
                Atribuir {selectedItems.length} Patrimonios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
