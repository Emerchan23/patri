"use client"

import { useState } from "react"
import useSWR from "swr"
import { api, fetcher } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Checkbox,
} from "@/components/ui/checkbox"
import {
  Building2,
  FolderOpen,
  DoorOpen,
  Tag,
  Award,
  Plus,
  Pencil,
  Trash2,
  Search,
  Printer,
} from "lucide-react"
import { generateQRCodeDataURL } from "@/components/ui/qr-code"
import { SearchableSelect } from "@/components/ui/searchable-select"
import type { Category, Marca } from "@/lib/data"

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

export function CadastrosAuxiliares() {
  // Data fetching
  const { data: secretariasData, mutate: mutateSecretarias } = useSWR<Secretaria[]>("/secretarias", fetcher)
  const { data: categoriesData, mutate: mutateCategorias } = useSWR<Category[]>("/categorias", fetcher)
  const { data: marcasData, mutate: mutateMarcas } = useSWR<Marca[]>("/marcas", fetcher)

  const secList = secretariasData || []
  const categories = categoriesData || []
  const marcas = marcasData || []

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<"secretaria" | "departamento" | "sala" | "categoria" | "marca">("secretaria")
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [deleteItem, setDeleteItem] = useState<{ type: string; id: string; nome: string } | null>(null)

  // Form states
  const [formNome, setFormNome] = useState("")
  const [formDescricao, setFormDescricao] = useState("")
  const [formSecretaria, setFormSecretaria] = useState("") // Stores ID as string
  const [formDepartamento, setFormDepartamento] = useState("") // Stores ID as string

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [filterSecretaria, setFilterSecretaria] = useState("todas") // Stores ID as string or "todas"

  // Print Config State
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [printConfig, setPrintConfig] = useState<{
    type: "SALA" | "DEP" | "SEC",
    item: any,
    customTitle: string,
    showParent: boolean
  }>({ type: "SALA", item: null, customTitle: "", showParent: false })

  const openPrintDialog = (type: "SALA" | "DEP" | "SEC", item: any) => {
    setPrintConfig({ type, item, customTitle: "", showParent: false })
    setPrintDialogOpen(true)
  }

  // Helpers
  const resetForm = () => {
    setFormNome("")
    setFormDescricao("")
    setFormSecretaria("")
    setFormDepartamento("")
    setEditingItem(null)
  }

  const openDialog = (type: typeof dialogType, item?: any) => {
    setDialogType(type)
    if (item) {
      setEditingItem(item)
      setFormNome(item.nome || "")
      setFormDescricao(item.descricao || "")
      // For edit, we need to pre-fill select fields if available
      // But item might not have parent IDs directly.
      // We pass parent IDs when opening dialog if possible
      setFormSecretaria(item.secretariaId ? String(item.secretariaId) : "")
      setFormDepartamento(item.departamentoId ? String(item.departamentoId) : "")
    } else {
      resetForm()
    }
    setDialogOpen(true)
  }

  // SECRETARIA CRUD
  const saveSecretaria = async () => {
    if (!formNome.trim()) return
    try {
      if (editingItem) {
        await api.updateSecretaria(editingItem.id, { nome: formNome.trim() })
      } else {
        await api.createSecretaria({ nome: formNome.trim() })
      }
      mutateSecretarias()
      setDialogOpen(false)
      resetForm()
    } catch (e) { console.error(e) }
  }

  const deleteSecretaria = async (id: string) => {
    try {
      await api.deleteSecretaria(id)
      mutateSecretarias()
      setDeleteDialogOpen(false)
    } catch (e) { console.error(e) }
  }

  // DEPARTAMENTO CRUD
  const saveDepartamento = async () => {
    if (!formNome.trim() || (!formSecretaria && !editingItem)) return
    try {
      if (editingItem) {
        await api.updateDepartamento(editingItem.id, { 
          nome: formNome.trim(),
          secretariaId: formSecretaria ? parseInt(formSecretaria) : undefined 
        })
      } else {
        await api.createDepartamento(formSecretaria, { nome: formNome.trim() })
      }
      mutateSecretarias()
      setDialogOpen(false)
      resetForm()
    } catch (e) { console.error(e) }
  }

  const deleteDepartamento = async (id: string) => {
    try {
      await api.deleteDepartamento(id)
      mutateSecretarias()
      setDeleteDialogOpen(false)
    } catch (e) { console.error(e) }
  }

  // SALA CRUD
  const saveSala = async () => {
    if (!formNome.trim() || (!formDepartamento && !editingItem)) return
    try {
      if (editingItem) {
        await api.updateSala(editingItem.id, { 
          nome: formNome.trim(),
          departamentoId: formDepartamento ? parseInt(formDepartamento) : undefined
        })
      } else {
        await api.createSala(formDepartamento, { nome: formNome.trim() })
      }
      mutateSecretarias()
      setDialogOpen(false)
      resetForm()
    } catch (e) { console.error(e) }
  }

  const deleteSala = async (id: string) => {
    try {
      await api.deleteSala(id)
      mutateSecretarias()
      setDeleteDialogOpen(false)
    } catch (e) { console.error(e) }
  }

  // CATEGORIA CRUD
  const saveCategoria = async () => {
    if (!formNome.trim()) return
    try {
      if (editingItem) {
        await api.updateCategoria(editingItem.id, {
          nome: formNome.trim(),
          descricao: formDescricao.trim() || undefined
        })
      } else {
        await api.createCategoria({ 
          nome: formNome.trim(),
          descricao: formDescricao.trim() || undefined
        })
      }
      mutateCategorias()
      setDialogOpen(false)
      resetForm()
    } catch (e) { console.error(e) }
  }

  const deleteCategoria = async (id: string) => {
    try {
      await api.deleteCategoria(id)
      mutateCategorias()
      setDeleteDialogOpen(false)
    } catch (e) { console.error(e) }
  }

  // MARCA CRUD
  const saveMarca = async () => {
    if (!formNome.trim()) return
    try {
      if (editingItem) {
        await api.updateMarca(editingItem.id, { nome: formNome.trim() })
      } else {
        await api.createMarca({ nome: formNome.trim() })
      }
      mutateMarcas()
      setDialogOpen(false)
      resetForm()
    } catch (e) { console.error(e) }
  }

  const deleteMarca = async (id: string) => {
    try {
      await api.deleteMarca(id)
      mutateMarcas()
      setDeleteDialogOpen(false)
    } catch (e) { console.error(e) }
  }

  // Print QR Code
  const executePrint = async () => {
    const { type, item, customTitle, showParent } = printConfig
    if (!item) return

    // Label Size 50x25mm per label, but we want 2 columns and extra height for printer offset
    // Matches the "perfect" configuration from EtiquetasProvisorias
    const labelWidthMm = 50
    const extraHeight = 20
    const labelHeightMm = 25 + extraHeight
    const pageWidthMm = labelWidthMm * 2 // 100mm total width
    
    // Format: TYPE:{id}
    const qrData = `${type}:${item.id}`
    const typeLabel = type === "SALA" ? "SALA" : type === "DEP" ? "DEP." : "SEC."

    try {
        const { jsPDF } = await import("jspdf")
        const { generateQRCodeDataURL } = await import("@/components/ui/qr-code")
        
        // Configuração da página (100mm x 45mm)
        const doc = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: [pageWidthMm, labelHeightMm] 
        })

        const qrDataUrl = await generateQRCodeDataURL(qrData)
        
        // We will print the SAME label twice (side by side)
        for (let i = 0; i < 2; i++) {
            // Layout offsets based on column index
            const colIndex = i
            
            // Column 1: 0mm margin left (Perfect)
            // Column 2: 3mm margin left (Matches EtiquetasProvisorias)
            const marginLeft = colIndex === 0 ? 0 : 3
            
            // Top offset to handle printer skipping 14mm
            const marginTop = 1
            
            const xOffset = (colIndex * labelWidthMm) + marginLeft
            
            // --- DRAW CONTENT ---
            const qrSize = 17
            doc.addImage(qrDataUrl, 'PNG', xOffset, marginTop + 1, qrSize, qrSize)

            // Text Area
            const textX = xOffset + qrSize + 2
            const maxTextWidth = 26 

            doc.setFont("helvetica", "bold")

            // Title
            if (customTitle) {
                doc.setFontSize(6.5)
                doc.text(customTitle.toUpperCase().substring(0, 25), textX, marginTop + 3)
                doc.setLineWidth(0.2)
                doc.line(textX, marginTop + 4, xOffset + 45, marginTop + 4)
            }

            // Main Name (Sala/Dep) - Acts like "Numero" in provisional label
            let fontSize = 9
            doc.setFontSize(fontSize)
            let textWidth = doc.getTextWidth(item.nome.toUpperCase())
            while (textWidth > maxTextWidth && fontSize > 5) {
                fontSize -= 0.5
                doc.setFontSize(fontSize)
                textWidth = doc.getTextWidth(item.nome.toUpperCase())
            }
            doc.text(item.nome.toUpperCase(), textX, customTitle ? marginTop + 7 : marginTop + 6)

            // Parent Info (Acts like "Descricao")
            if (showParent) {
                let parentInfo = ""
                if (type === "SALA") {
                    parentInfo = `${item.departamento || ""} ${item.secretaria ? `- ${item.secretaria}` : ""}`
                } else if (type === "DEP") {
                    parentInfo = item.secretaria || ""
                }

                if (parentInfo) {
                    doc.setFont("helvetica", "bold")
                    doc.setFontSize(6)
                    const splitInfo = doc.splitTextToSize(parentInfo.toUpperCase(), maxTextWidth)
                    const lines = splitInfo.length > 3 ? splitInfo.slice(0, 3) : splitInfo
                    doc.text(lines, textX, customTitle ? marginTop + 10 : marginTop + 9)
                }
            }

            // Type Label (SALA #ID) - Removido a pedido
            // doc.setFont("helvetica", "normal")
            // doc.setFontSize(5.5)
            // doc.text(`${typeLabel} #${item.id}`, textX, marginTop + 13.5)

            // Footer
            doc.setFont("helvetica", "bold")
            doc.setFontSize(6)
            doc.text("SISPATRIMONIO", xOffset + 45, marginTop + 21, { align: "right" })
        }

        // Salvar PDF
        doc.save(`etiqueta_${type.toLowerCase()}_${item.id}.pdf`)
        
        setPrintDialogOpen(false)

    } catch (error) {
        console.error("Erro ao gerar PDF", error)
        alert("Erro ao gerar PDF")
    }
  }

  // Save handler based on type
  const handleSave = () => {
    switch (dialogType) {
      case "secretaria": saveSecretaria(); break
      case "departamento": saveDepartamento(); break
      case "sala": saveSala(); break
      case "categoria": saveCategoria(); break
      case "marca": saveMarca(); break
    }
  }

  const handleDelete = () => {
    if (!deleteItem) return
    switch (deleteItem.type) {
      case "secretaria": deleteSecretaria(deleteItem.id); break
      case "departamento": deleteDepartamento(deleteItem.id); break
      case "sala": deleteSala(deleteItem.id); break
      case "categoria": deleteCategoria(deleteItem.id); break
      case "marca": deleteMarca(deleteItem.id); break
    }
  }

  // Flatten data for display
  const allDepartamentos = secList.flatMap((s) =>
    s.departamentos.map((d) => ({ ...d, secretaria: s.nome, secretariaId: s.id }))
  )

  const allSalas = secList.flatMap((s) =>
    s.departamentos.flatMap((d) =>
      d.salas.map((sala) => ({ 
        ...sala, 
        departamento: d.nome, 
        departamentoId: d.id,
        secretaria: s.nome,
        secretariaId: s.id
      }))
    )
  )

  // Filters
  const filteredDepartamentos =
    filterSecretaria === "todas"
      ? allDepartamentos
      : allDepartamentos.filter((d) => String(d.secretariaId) === filterSecretaria)

  const filteredSalas =
    filterSecretaria === "todas"
      ? allSalas
      : allSalas.filter((s) => String(s.secretariaId) === filterSecretaria)

  const dialogTitles: Record<string, { title: string; desc: string }> = {
    secretaria: {
      title: editingItem ? "Editar Secretaria" : "Nova Secretaria",
      desc: editingItem ? "Altere o nome da secretaria" : "Adicione uma nova secretaria ao sistema",
    },
    departamento: {
      title: editingItem ? "Editar Departamento" : "Novo Departamento",
      desc: editingItem ? "Altere o nome do departamento" : "Adicione um novo departamento a uma secretaria",
    },
    sala: {
      title: editingItem ? "Editar Sala" : "Nova Sala",
      desc: editingItem ? "Altere o nome da sala" : "Adicione uma nova sala a um departamento",
    },
    categoria: {
      title: editingItem ? "Editar Categoria" : "Nova Categoria",
      desc: editingItem ? "Altere os dados da categoria" : "Adicione uma nova categoria de bens",
    },
    marca: {
      title: editingItem ? "Editar Marca" : "Nova Marca",
      desc: editingItem ? "Altere o nome da marca" : "Adicione uma nova marca de equipamento",
    },
  }

  // Get available departamentos for selected secretaria (for Sala form)
  const departamentosForSala = formSecretaria
    ? secList.find((s) => String(s.id) === formSecretaria)?.departamentos || []
    : []

  const stats = [
    { label: "Secretarias", value: secList.length, icon: Building2, color: "text-primary" },
    { label: "Departamentos", value: allDepartamentos.length, icon: FolderOpen, color: "text-accent" },
    { label: "Salas", value: allSalas.length, icon: DoorOpen, color: "text-warning" },
    { label: "Categorias", value: categories.length, icon: Tag, color: "text-success" },
    { label: "Marcas", value: marcas.length, icon: Award, color: "text-info" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cadastros Auxiliares</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie secretarias, departamentos, salas, categorias e marcas
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="secretarias" className="space-y-4" onValueChange={() => setSearchTerm("")}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="secretarias" className="text-xs sm:text-sm">
            <Building2 className="mr-1.5 h-4 w-4 hidden sm:inline-block" />
            Secretarias
          </TabsTrigger>
          <TabsTrigger value="departamentos" className="text-xs sm:text-sm">
            <FolderOpen className="mr-1.5 h-4 w-4 hidden sm:inline-block" />
            Departamentos
          </TabsTrigger>
          <TabsTrigger value="salas" className="text-xs sm:text-sm">
            <DoorOpen className="mr-1.5 h-4 w-4 hidden sm:inline-block" />
            Salas
          </TabsTrigger>
          <TabsTrigger value="categorias" className="text-xs sm:text-sm">
            <Tag className="mr-1.5 h-4 w-4 hidden sm:inline-block" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="marcas" className="text-xs sm:text-sm">
            <Award className="mr-1.5 h-4 w-4 hidden sm:inline-block" />
            Marcas
          </TabsTrigger>
        </TabsList>

        {/* SECRETARIAS TAB */}
        <TabsContent value="secretarias">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Secretarias</CardTitle>
                <CardDescription>Gerencie as secretarias do municipio</CardDescription>
              </div>
              <Button onClick={() => openDialog("secretaria")} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nova Secretaria
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative w-64">
                   <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                   <Input 
                      placeholder="Buscar marcas..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                   />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-center">Departamentos</TableHead>
                    <TableHead className="text-center">Salas</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {secList
                    .filter((s) =>
                      searchTerm ? s.nome.toLowerCase().includes(searchTerm.toLowerCase()) : true
                    )
                    .map((sec) => (
                    <TableRow key={sec.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          {sec.nome}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{sec.departamentos.length}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {sec.departamentos.reduce((sum, d) => sum + d.salas.length, 0)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openPrintDialog("SEC", sec)}
                            title="Imprimir Etiqueta QR"
                          >
                            <Printer className="h-4 w-4" />
                            <span className="sr-only">Imprimir QR</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openDialog("secretaria", sec)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeleteItem({ type: "secretaria", id: String(sec.id), nome: sec.nome })
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Excluir</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {secList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhuma secretaria cadastrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEPARTAMENTOS TAB */}
        <TabsContent value="departamentos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Departamentos</CardTitle>
                <CardDescription>Gerencie os departamentos de cada secretaria</CardDescription>
              </div>
              <Button onClick={() => openDialog("departamento")} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Novo Departamento
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-64">
                  <SearchableSelect
                    value={filterSecretaria}
                    onValueChange={setFilterSecretaria}
                    placeholder="Filtrar por secretaria"
                    searchPlaceholder="Buscar secretaria..."
                    items={[
                      { value: "todas", label: "Todas as Secretarias" },
                      ...secList.map((s) => ({ value: String(s.id), label: s.nome })),
                    ]}
                  />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Secretaria</TableHead>
                    <TableHead className="text-center">Salas</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDepartamentos.map((dep) => (
                    <TableRow key={dep.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-accent" />
                          {dep.nome}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{dep.secretaria}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{dep.salas.length}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openPrintDialog("DEP", dep)}
                            title="Imprimir Etiqueta QR"
                          >
                            <Printer className="h-4 w-4" />
                            <span className="sr-only">Imprimir QR</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openDialog("departamento", dep)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeleteItem({
                                type: "departamento",
                                id: String(dep.id),
                                nome: dep.nome,
                              })
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Excluir</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredDepartamentos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum departamento encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SALAS TAB */}
        <TabsContent value="salas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Salas</CardTitle>
                <CardDescription>Gerencie as salas de cada departamento</CardDescription>
              </div>
              <Button onClick={() => openDialog("sala")} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nova Sala
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-64">
                  <SearchableSelect
                    value={filterSecretaria}
                    onValueChange={setFilterSecretaria}
                    placeholder="Filtrar por secretaria"
                    searchPlaceholder="Buscar secretaria..."
                    items={[
                      { value: "todas", label: "Todas as Secretarias" },
                      ...secList.map((s) => ({ value: String(s.id), label: s.nome })),
                    ]}
                  />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sala</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Secretaria</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSalas.map((sala) => (
                    <TableRow key={sala.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <DoorOpen className="h-4 w-4 text-warning" />
                          {sala.nome}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{sala.departamento}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{sala.secretaria}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openPrintDialog("SALA", sala)}
                            title="Imprimir Etiqueta QR"
                          >
                            <Printer className="h-4 w-4" />
                            <span className="sr-only">Imprimir QR</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openDialog("sala", sala)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeleteItem({
                                type: "sala",
                                id: String(sala.id),
                                nome: sala.nome,
                              })
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Excluir</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredSalas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhuma sala encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CATEGORIAS TAB */}
        <TabsContent value="categorias">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Categorias</CardTitle>
                <CardDescription>Gerencie as categorias de bens patrimoniais</CardDescription>
              </div>
              <Button onClick={() => openDialog("categoria")} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nova Categoria
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative w-64">
                   <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                   <Input 
                      placeholder="Buscar secretarias..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                   />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Descricao</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories
                    .filter((cat) => 
                      searchTerm ? cat.nome.toLowerCase().includes(searchTerm.toLowerCase()) : true
                    )
                    .map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-success" />
                          {cat.nome}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {cat.slug}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {cat.descricao || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openDialog("categoria", cat)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeleteItem({ type: "categoria", id: String(cat.id), nome: cat.nome })
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Excluir</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {categories.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhuma categoria cadastrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MARCAS TAB */}
        <TabsContent value="marcas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Marcas</CardTitle>
                <CardDescription>Gerencie as marcas de equipamentos</CardDescription>
              </div>
              <Button onClick={() => openDialog("marca")} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nova Marca
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative w-64">
                   <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                   <Input 
                      placeholder="Buscar marcas..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                   />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marcas
                    .filter((m) =>
                      searchTerm ? m.nome.toLowerCase().includes(searchTerm.toLowerCase()) : true
                    )
                    .map((marca) => (
                      <TableRow key={marca.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-info" />
                            {marca.nome}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openDialog("marca", marca)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeleteItem({ type: "marca", id: String(marca.id), nome: marca.nome })
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Excluir</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  {marcas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                        Nenhuma marca cadastrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitles[dialogType]?.title}</DialogTitle>
            <DialogDescription>{dialogTitles[dialogType]?.desc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Secretaria select for departamento and sala */}
            {(dialogType === "departamento" || dialogType === "sala") && (
              <div className="space-y-2">
                <Label required>Secretaria</Label>
                <SearchableSelect
                  value={formSecretaria}
                  onValueChange={(v) => {
                    setFormSecretaria(v)
                    setFormDepartamento("")
                  }}
                  placeholder="Selecione a secretaria"
                  searchPlaceholder="Buscar secretaria..."
                  items={secList.map((s) => ({
                    value: String(s.id),
                    label: s.nome,
                  }))}
                />
              </div>
            )}

            {/* Departamento select for sala */}
            {dialogType === "sala" && (
              <div className="space-y-2">
                <Label required>Departamento</Label>
                <SearchableSelect
                  value={formDepartamento}
                  onValueChange={setFormDepartamento}
                  placeholder="Selecione o departamento"
                  searchPlaceholder="Buscar departamento..."
                  items={departamentosForSala.map((d) => ({
                    value: String(d.id),
                    label: d.nome,
                  }))}
                />
              </div>
            )}

            {/* Nome field (always) */}
            <div className="space-y-2">
              <Label required>Nome</Label>
              <Input
                placeholder={`Nome ${dialogType === "sala" ? "da sala" : dialogType === "categoria" ? "da categoria" : dialogType === "marca" ? "da marca" : dialogType === "departamento" ? "do departamento" : "da secretaria"}`}
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
              />
            </div>

            {/* Description for categoria */}
            {dialogType === "categoria" && (
              <div className="space-y-2">
                <Label>Descricao (opcional)</Label>
                <Input
                  placeholder="Descricao da categoria"
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingItem ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Configuration Dialog */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Imprimir Etiqueta</DialogTitle>
            <DialogDescription>
              Configure a etiqueta para {printConfig.item?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="print-title">Titulo Personalizado (Opcional)</Label>
              <Input
                id="print-title"
                placeholder="Ex: SECRETARIA DE SAUDE"
                value={printConfig.customTitle}
                onChange={(e) => setPrintConfig(prev => ({ ...prev, customTitle: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Aparecera no topo da etiqueta em negrito.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="show-parent" 
                checked={printConfig.showParent}
                onCheckedChange={(checked) => setPrintConfig(prev => ({ ...prev, showParent: !!checked }))}
              />
              <Label htmlFor="show-parent" className="cursor-pointer font-normal">
                {printConfig.type === "SALA" 
                  ? "Incluir Departamento e Secretaria" 
                  : printConfig.type === "DEP" 
                    ? "Incluir Secretaria" 
                    : "Incluir Informacoes Superiores"}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={executePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{" "}
              <strong>{deleteItem?.nome}</strong>? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}