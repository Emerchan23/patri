"use client"

import { useEffect, useState } from "react"
import useSWR, { mutate } from "swr"
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

import { PaginationControl } from "@/components/ui/pagination-control"

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

interface QrCadastroLayoutConfig {
  title: string
  subtitle: string
  showParent: boolean
  showFooter: boolean
  qrSizeMm: number
  offsetXMm: number
  offsetYMm: number
  offsetColuna2Mm: number
  alturaExtraMm: number
  innerPaddingMm: number
}

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export function CadastrosAuxiliares() {
  // Pagination states
  const [secPage, setSecPage] = useState(1)
  const [depPage, setDepPage] = useState(1)
  const [salaPage, setSalaPage] = useState(1)
  const [catPage, setCatPage] = useState(1)
  const [marcaPage, setMarcaPage] = useState(1)
  const [grupoPage, setGrupoPage] = useState(1)
  const LIMIT = 10

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [filterSecretaria, setFilterSecretaria] = useState("todas") // Stores ID as string or "todas"
  const [activeTab, setActiveTab] = useState("secretarias")

  // Data fetching
  // Secretarias (Paginated list)
  const { data: secretariasRes, mutate: mutateSecretarias } = useSWR(
    `/secretarias?page=${secPage}&limit=${LIMIT}&search=${searchTerm}`, 
    fetcher
  )
  // Secretarias All (For dropdowns)
  const { data: allSecretariasRes } = useSWR(
    `/secretarias?all=true`, 
    fetcher
  )

  // Departamentos (Paginated)
  const { data: departamentosRes, mutate: mutateDepartamentos } = useSWR(
    `/departamentos?page=${depPage}&limit=${LIMIT}&search=${searchTerm}&secretariaId=${filterSecretaria}`, 
    fetcher
  )

  // Salas (Paginated)
  const { data: salasRes, mutate: mutateSalas } = useSWR(
    `/salas?page=${salaPage}&limit=${LIMIT}&search=${searchTerm}&secretariaId=${filterSecretaria}`, 
    fetcher
  )

  // Categorias (Paginated)
  const { data: categoriesRes, mutate: mutateCategorias } = useSWR(
    `/categorias?page=${catPage}&limit=${LIMIT}&search=${searchTerm}`, 
    fetcher
  )
  
  // Marcas (Paginated)
  const { data: marcasRes, mutate: mutateMarcas } = useSWR(
    `/marcas?page=${marcaPage}&limit=${LIMIT}&search=${searchTerm}`, 
    fetcher
  )

  // Grupos (Paginated)
  const { data: gruposRes, mutate: mutateGrupos } = useSWR(
    `/grupos?page=${grupoPage}&limit=${LIMIT}&search=${searchTerm}`,
    fetcher
  )

  const secList = Array.isArray(secretariasRes?.data) ? secretariasRes.data : []
  const secMeta = secretariasRes?.meta || { totalPages: 1, page: 1 }
  
  const allSecretarias = Array.isArray(allSecretariasRes) ? allSecretariasRes : [] // Legacy structure for dropdowns
  
  const depList = Array.isArray(departamentosRes?.data) ? departamentosRes.data : []
  const depMeta = departamentosRes?.meta || { totalPages: 1, page: 1 }

  const salaList = Array.isArray(salasRes?.data) ? salasRes.data : []
  const salaMeta = salasRes?.meta || { totalPages: 1, page: 1 }

  const categories = Array.isArray(categoriesRes?.data) ? categoriesRes.data : []
  const catMeta = categoriesRes?.meta || { totalPages: 1, page: 1 }
  
  const marcas = Array.isArray(marcasRes?.data) ? marcasRes.data : []
  const marcaMeta = marcasRes?.meta || { totalPages: 1, page: 1 }

  const grupos = Array.isArray(gruposRes?.data) ? gruposRes.data : []
  const grupoMeta = gruposRes?.meta || { totalPages: 1, page: 1 }

  useEffect(() => {
    setSecPage(1)
    setDepPage(1)
    setSalaPage(1)
    setCatPage(1)
    setMarcaPage(1)
    setGrupoPage(1)
  }, [searchTerm, filterSecretaria])
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<"secretaria" | "departamento" | "sala" | "categoria" | "marca" | "grupo">("secretaria")
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [deleteItem, setDeleteItem] = useState<{ type: string; id: string; nome: string } | null>(null)

  // Form states
  const [formNome, setFormNome] = useState("")
  const [formDescricao, setFormDescricao] = useState("")
  const [formSecretaria, setFormSecretaria] = useState("") // Stores ID as string
  const [formDepartamento, setFormDepartamento] = useState("") // Stores ID as string

  // Print Config State
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [qrLayoutConfig, setQrLayoutConfig] = useState<QrCadastroLayoutConfig>({
    title: "Identificacao de Ambiente",
    subtitle: "",
    showParent: true,
    showFooter: true,
    qrSizeMm: 17,
    offsetXMm: 0,
    offsetYMm: 1,
    offsetColuna2Mm: 3,
    alturaExtraMm: 20,
    innerPaddingMm: 1.5,
  })
  const { data: qrSettingsResult, mutate: mutateQrSettings } = useSWR(
    "/etiquetas-provisorias/settings?preset=qr_cadastro",
    fetcher
  )
  const [printConfig, setPrintConfig] = useState<{
    type: "SALA" | "DEP" | "SEC",
    item: any,
    customTitle: string,
    showParent: boolean
    showFooter: boolean
    mode: "zebra" | "pdf_comum"
  }>({ type: "SALA", item: null, customTitle: "", showParent: true, showFooter: true, mode: "zebra" })

  useEffect(() => {
    if (!qrSettingsResult?.layoutConfig) return
    setQrLayoutConfig({
      title: String(qrSettingsResult.layoutConfig.title || "Identificacao de Ambiente"),
      subtitle: String(qrSettingsResult.layoutConfig.subtitle || ""),
      showParent: Boolean(qrSettingsResult.layoutConfig.showParent ?? true),
      showFooter: Boolean(qrSettingsResult.layoutConfig.showFooter ?? true),
      qrSizeMm: Number(qrSettingsResult.layoutConfig.qrSizeMm ?? 17),
      offsetXMm: Number(qrSettingsResult.layoutConfig.offsetXMm ?? 0),
      offsetYMm: Number(qrSettingsResult.layoutConfig.offsetYMm ?? 1),
      offsetColuna2Mm: Number(qrSettingsResult.layoutConfig.offsetColuna2Mm ?? 3),
      alturaExtraMm: Number(qrSettingsResult.layoutConfig.alturaExtraMm ?? 20),
      innerPaddingMm: Number(qrSettingsResult.layoutConfig.innerPaddingMm ?? 1.5),
    })
  }, [qrSettingsResult])

  const openPrintDialog = (type: "SALA" | "DEP" | "SEC", item: any) => {
    setPrintConfig({
      type,
      item,
      customTitle: qrLayoutConfig.title,
      showParent: qrLayoutConfig.showParent,
      showFooter: qrLayoutConfig.showFooter,
      mode: "zebra",
    })
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

  const renderPaginationSummary = (meta: { total?: number; page?: number; limit?: number }) => {
    const total = Number(meta.total || 0)
    const page = Number(meta.page || 1)
    const limit = Number(meta.limit || LIMIT)

    if (total === 0) {
      return "Mostrando 0 de 0"
    }

    const start = (page - 1) * limit + 1
    const end = Math.min(page * limit, total)
    return `Mostrando ${start}-${end} de ${total}`
  }

  const openDialog = (type: typeof dialogType, item?: any) => {
    setDialogType(type)
    setFormSecretaria("")
    setFormDepartamento("")
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
      mutate("/secretarias?all=true")
      setDialogOpen(false)
      resetForm()
    } catch (e: any) { 
      const msg = e.response?.data?.error || e.message || "Erro ao salvar secretaria"
      alert(msg)
    }
  }

  const deleteSecretaria = async (id: string) => {
    try {
      await api.deleteSecretaria(id)
      mutateSecretarias()
      mutate("/secretarias?all=true")
      setDeleteDialogOpen(false)
    } catch (e: any) { 
      const msg = e.response?.data?.error || e.message || "Erro ao excluir secretaria"
      alert(msg)
    }
  }

  // DEPARTAMENTO CRUD
  const saveDepartamento = async () => {
    if (!formNome.trim()) return
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
      mutateDepartamentos()
      mutate("/secretarias?all=true")
      setDialogOpen(false)
      resetForm()
    } catch (e: any) { 
      const msg = e.response?.data?.error || e.message || "Erro ao salvar departamento"
      alert(msg)
    }
  }

  const deleteDepartamento = async (id: string) => {
    try {
      await api.deleteDepartamento(id)
      mutateSecretarias()
      mutateDepartamentos()
      mutate("/secretarias?all=true")
      setDeleteDialogOpen(false)
    } catch (e: any) { 
      const msg = e.response?.data?.error || e.message || "Erro ao excluir departamento"
      alert(msg)
    }
  }

  // SALA CRUD
  const saveSala = async () => {
    if (!formNome.trim()) return
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
      mutateDepartamentos()
      mutateSalas()
      mutate("/secretarias?all=true")
      setDialogOpen(false)
      resetForm()
    } catch (e: any) { 
      const msg = e.response?.data?.error || e.message || "Erro ao salvar sala"
      alert(msg)
    }
  }

  const deleteSala = async (id: string) => {
    try {
      await api.deleteSala(id)
      mutateSecretarias()
      mutateDepartamentos()
      mutateSalas()
      mutate("/secretarias?all=true")
      setDeleteDialogOpen(false)
    } catch (e: any) { 
      const msg = e.response?.data?.error || e.message || "Erro ao excluir sala"
      alert(msg)
    }
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
      mutate("/categorias?all=true")
      setDialogOpen(false)
      resetForm()
    } catch (e: any) { 
      const msg = e.response?.data?.error || e.message || "Erro ao salvar categoria"
      alert(msg)
    }
  }

  const deleteCategoria = async (id: string) => {
    try {
      await api.deleteCategoria(id)
      mutateCategorias()
      mutate("/categorias?all=true")
      setDeleteDialogOpen(false)
    } catch (e: any) { 
      const msg = e.response?.data?.error || e.message || "Erro ao excluir categoria"
      alert(msg)
    }
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
      mutate("/marcas?all=true")
      setDialogOpen(false)
      resetForm()
    } catch (e: any) { 
      // If error is an object with message (like from API client)
      const msg = e.response?.data?.error || e.message || "Erro ao salvar marca"
      alert(msg) 
    }
  }

  const deleteMarca = async (id: string) => {
    try {
      await api.deleteMarca(id)
      mutateMarcas()
      mutate("/marcas?all=true")
      setDeleteDialogOpen(false)
    } catch (e: any) { 
      const msg = e.response?.data?.error || e.message || "Erro ao excluir marca"
      alert(msg)
    }
  }

  // GRUPO CRUD
  const saveGrupo = async () => {
    if (!formNome.trim()) return
    try {
      if (editingItem) {
        // Assuming updateGrupo endpoint or similar logic if needed, but api client only has create/delete/get
        // If update is not available in API client, we might need to add it or skip.
        // The user asked to edit groups.
        // Let's check api-client.ts again. It has createGrupo and deleteGrupo. No updateGrupo.
        // We should add it to api-client.ts first if we want to support edit.
        // For now, I will assume it exists or I will add it.
        // Actually, I should add it to api-client.ts first.
        // But let's proceed with adding the call here, assuming I'll fix api-client next.
        // Wait, I can't assume. I must fix api-client.
        // Let's modify api-client.ts to include updateGrupo.
        // But for now, let's just add the logic and then fix the file.
        // Actually, I'll use a generic put for now if specific function missing.
        await api.put(`/grupos/${editingItem.id}`, { nome: formNome.trim() })
      } else {
        await api.createGrupo({ nome: formNome.trim() })
      }
      mutateGrupos()
      mutate("/api/grupos?all=true")
      setDialogOpen(false)
      resetForm()
    } catch (e: any) { 
      const msg = e.response?.data?.error || e.message || "Erro ao salvar grupo"
      alert(msg) 
    }
  }

  const deleteGrupo = async (id: string) => {
    try {
      await api.deleteGrupo(id)
      mutateGrupos()
      mutate("/api/grupos?all=true")
      setDeleteDialogOpen(false)
    } catch (e: any) { 
      const msg = e.response?.data?.error || e.message || "Erro ao excluir grupo"
      alert(msg)
    }
  }

  // Print QR Code
  const executePrint = async () => {
    const { type, item, customTitle, showParent, showFooter, mode } = printConfig
    if (!item) return

    // Label Size 50x25mm per label, but we want 2 columns and extra height for printer offset
    // Matches the "perfect" configuration from EtiquetasProvisorias
    const labelWidthMm = 50
    const extraHeight = qrLayoutConfig.alturaExtraMm
    const labelHeightMm = 25 + extraHeight
    const pageWidthMm = labelWidthMm * 2 // 100mm total width
    
    // Format: TYPE:{id}
    const qrData = `${type}:${item.id}`

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
        const parentInfo = !showParent
          ? ""
          : type === "SALA"
            ? [item.departamento, item.secretaria].filter(Boolean).join(" - ")
            : type === "DEP"
              ? item.secretaria || ""
              : ""

        if (mode === "pdf_comum") {
            const docA4 = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4",
            })

            docA4.setDrawColor(180)
            docA4.roundedRect(18, 24, 174, 70, 4, 4)
            docA4.addImage(qrDataUrl, "PNG", 28, 34, 42, 42)

            let currentY = 36
            const textX = 78
            const maxTextWidth = 100

            if (customTitle) {
                docA4.setFont("helvetica", "bold")
                docA4.setFontSize(14)
                docA4.text(customTitle.toUpperCase().substring(0, 42), textX, currentY)
                currentY += 8
            }

            if (qrLayoutConfig.subtitle) {
                docA4.setFont("helvetica", "normal")
                docA4.setFontSize(10)
                docA4.text(qrLayoutConfig.subtitle.toUpperCase().substring(0, 48), textX, currentY)
                currentY += 7
            }

            docA4.setFont("helvetica", "bold")
            docA4.setFontSize(19)
            const mainLines = docA4.splitTextToSize(String(item.nome).toUpperCase(), maxTextWidth).slice(0, 3)
            docA4.text(mainLines, textX, currentY)
            currentY += Math.max(10, mainLines.length * 8)

            if (parentInfo) {
                docA4.setFont("helvetica", "normal")
                docA4.setFontSize(11)
                const parentLines = docA4.splitTextToSize(parentInfo.toUpperCase(), maxTextWidth).slice(0, 3)
                docA4.text(parentLines, textX, currentY)
            }

            if (showFooter) {
                docA4.setFont("helvetica", "bold")
                docA4.setFontSize(9)
                docA4.text("SISPATRIMONIO", 184, 86, { align: "right" })
            }

            docA4.save(`etiqueta_${type.toLowerCase()}_${item.id}_a4.pdf`)
            setPrintDialogOpen(false)
            return
        }
        
        // We will print the SAME label twice (side by side)
        for (let i = 0; i < 2; i++) {
            // Layout offsets based on column index
            const colIndex = i
            const marginLeft = qrLayoutConfig.offsetXMm + (colIndex === 0 ? 0 : qrLayoutConfig.offsetColuna2Mm)
            const marginTop = qrLayoutConfig.offsetYMm
            const xOffset = (colIndex * labelWidthMm) + marginLeft
            
            // --- DRAW CONTENT ---
            const qrSize = qrLayoutConfig.qrSizeMm
            doc.addImage(qrDataUrl, 'PNG', xOffset + qrLayoutConfig.innerPaddingMm, marginTop + qrLayoutConfig.innerPaddingMm, qrSize, qrSize)

            // Text Area
            const textX = xOffset + qrLayoutConfig.innerPaddingMm + qrSize + 2
            const maxTextWidth = 26 

            doc.setFont("helvetica", "bold")
            let currentY = marginTop + qrLayoutConfig.innerPaddingMm + 2

            // Title
            if (customTitle) {
                doc.setFontSize(6.5)
                doc.text(customTitle.toUpperCase().substring(0, 25), textX, currentY)
                currentY += 1
                doc.setLineWidth(0.2)
                doc.line(textX, currentY, xOffset + 45, currentY)
                currentY += 2
            }

            if (qrLayoutConfig.subtitle) {
                doc.setFont("helvetica", "normal")
                doc.setFontSize(5)
                doc.text(qrLayoutConfig.subtitle.toUpperCase().substring(0, 28), textX, currentY)
                currentY += 2
                doc.setFont("helvetica", "bold")
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
            currentY += 3
            doc.text(item.nome.toUpperCase(), textX, currentY)

            // Parent Info (Acts like "Descricao")
            if (parentInfo) {
                currentY += 3
                doc.setFont("helvetica", "normal")
                doc.setFontSize(5.5)
                const lines = doc.splitTextToSize(parentInfo.toUpperCase(), maxTextWidth).slice(0, 2)
                doc.text(lines, textX, currentY)
            }

            // Type Label (SALA #ID) - Removido a pedido
            // doc.setFont("helvetica", "normal")
            // doc.setFontSize(5.5)
            // doc.text(`${typeLabel} #${item.id}`, textX, marginTop + 13.5)

            // Footer
            if (showFooter) {
              doc.setFont("helvetica", "bold")
              doc.setFontSize(6)
              doc.text("SISPATRIMONIO", xOffset + 45, marginTop + 21, { align: "right" })
            }
        }

        // Salvar PDF
        doc.save(`etiqueta_${type.toLowerCase()}_${item.id}.pdf`)
        
        setPrintDialogOpen(false)

    } catch (error) {
        console.error("Erro ao gerar PDF", error)
        alert("Erro ao gerar PDF")
    }
  }

  const handleSaveQrPreset = async () => {
    try {
      const response = await fetch("/api/etiquetas-provisorias/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preset: "qr_cadastro",
          layoutConfig: {
            ...qrLayoutConfig,
            title: printConfig.customTitle,
            showParent: printConfig.showParent,
            showFooter: printConfig.showFooter,
          },
        }),
      })

      if (!response.ok) throw new Error("Erro ao salvar preset")

      await mutateQrSettings()
      setQrLayoutConfig((prev) => ({
        ...prev,
        title: printConfig.customTitle,
        showParent: printConfig.showParent,
        showFooter: printConfig.showFooter,
      }))
      alert("Preset global do QR salvo com sucesso.")
    } catch (error) {
      console.error(error)
      alert("Nao foi possivel salvar o preset do QR.")
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
      case "grupo": saveGrupo(); break
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
      case "grupo": deleteGrupo(deleteItem.id); break
    }
  }

  // Flatten data for display
  // const allDepartamentos = ... (removed)
  // const allSalas = ... (removed)

  // Filters
  // const filteredDepartamentos = ... (removed)
  // const filteredSalas = ... (removed)

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
    grupo: {
      title: editingItem ? "Editar Grupo" : "Novo Grupo",
      desc: editingItem ? "Altere o nome do grupo" : "Adicione um novo grupo de bens",
    },
  }

  // Get available departamentos for selected secretaria (for Sala form)
  const departamentosForSala = formSecretaria
    ? allSecretarias.find((s: any) => String(s.id) === formSecretaria)?.departamentos || []
    : []

  const stats = [
    { label: "Secretarias", value: secMeta.total || 0, icon: Building2, color: "text-primary" },
    { label: "Departamentos", value: depMeta.total || 0, icon: FolderOpen, color: "text-accent" },
    { label: "Salas", value: salaMeta.total || 0, icon: DoorOpen, color: "text-warning" },
    { label: "Categorias", value: catMeta.total || 0, icon: Tag, color: "text-success" },
    { label: "Marcas", value: marcaMeta.total || 0, icon: Award, color: "text-info" },
    { label: "Grupos", value: grupoMeta.total || 0, icon: FolderOpen, color: "text-primary" },
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
      <Tabs
        value={activeTab}
        className="space-y-4"
        onValueChange={(value) => {
          setActiveTab(value)
          setSearchTerm("")
          setFilterSecretaria("todas")
          if (value === "secretarias") setSecPage(1)
          if (value === "departamentos") setDepPage(1)
          if (value === "salas") setSalaPage(1)
          if (value === "categorias") setCatPage(1)
          if (value === "marcas") setMarcaPage(1)
          if (value === "grupos") setGrupoPage(1)
        }}
      >
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto gap-2">
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
          <TabsTrigger value="grupos" className="text-xs sm:text-sm">
            <FolderOpen className="mr-1.5 h-4 w-4 hidden sm:inline-block" />
            Grupos
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
                    <TableHead className="text-center">Departamentos</TableHead>
                    <TableHead className="text-center">Salas</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {secList.map((sec: any) => (
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
                          {sec.departamentos.reduce((sum: number, d: any) => sum + d.salas.length, 0)}
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
              <PaginationControl
                currentPage={secMeta.page}
                totalPages={secMeta.totalPages}
                onPageChange={setSecPage}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEPARTAMENTOS TAB */}
        <TabsContent value="departamentos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Departamentos e Salas</CardTitle>
                <CardDescription>Gerencie a estrutura organizacional (Departamentos e suas Salas)</CardDescription>
              </div>
              <Button onClick={() => openDialog("departamento")} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Novo Departamento
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar departamentos..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="w-64">
                  <SearchableSelect
                    value={filterSecretaria}
                    onValueChange={setFilterSecretaria}
                    placeholder="Filtrar por secretaria"
                    searchPlaceholder="Buscar secretaria..."
                    items={[
                      { value: "todas", label: "Todas as Secretarias" },
                      ...allSecretarias.map((s: any) => ({ value: String(s.id), label: s.nome })),
                    ]}
                  />
                </div>
              </div>

              {depList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                   Nenhum departamento encontrado.
                </div>
              ) : (
                <Accordion type="multiple" className="w-full space-y-2">
                  {depList.map((dep: any) => (
                    <AccordionItem key={dep.id} value={`dep-${dep.id}`} className="border rounded-lg px-4 bg-card">
                      <div className="flex items-center justify-between py-2">
                        <AccordionTrigger className="hover:no-underline flex-1">
                          <div className="flex items-center gap-3 text-left">
                            <FolderOpen className="h-5 w-5 text-accent" />
                            <div>
                                <div className="font-medium">{dep.nome}</div>
                                <div className="text-xs text-muted-foreground font-normal">{dep.secretaria}</div>
                            </div>
                            <Badge variant="secondary" className="ml-2 text-xs">
                                {dep.salas.length} salas
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <div className="flex items-center gap-1 ml-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={(e) => { e.stopPropagation(); openPrintDialog("DEP", dep); }}
                                title="Imprimir Etiqueta QR"
                            >
                                <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={(e) => { e.stopPropagation(); openDialog("departamento", dep); }}
                                title="Editar Departamento"
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setDeleteItem({
                                        type: "departamento",
                                        id: String(dep.id),
                                        nome: dep.nome,
                                    });
                                    setDeleteDialogOpen(true);
                                }}
                                title="Excluir Departamento"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                      </div>
                      <AccordionContent className="pt-0 pb-4">
                        <div className="pl-4 border-l-2 border-muted ml-2 mt-2">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium text-muted-foreground">Salas do Departamento</h4>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-7 text-xs"
                                    onClick={() => {
                                        // Open dialog for NEW sala with pre-filled department
                                        // Need to find secretaria ID from department object or parent
                                        // The API response for department usually has secretariaId or we can infer it
                                        // Assuming dep object has it. If not, we rely on user selecting it?
                                        // Actually, `dep` object from API should have `secretariaId`
                                        // Let's check `api/departamentos/route.ts`... assume it has.
                                        setDialogType("sala");
                                        setFormDepartamento(String(dep.id));
                                        // Try to set secretaria if available
                                        if (dep.secretariaId) setFormSecretaria(String(dep.secretariaId));
                                        // If not, we might need to look it up from allSecretarias using name
                                        else {
                                            const sec = allSecretarias.find((s: any) => s.nome === dep.secretaria);
                                            if (sec) setFormSecretaria(String(sec.id));
                                        }
                                        setDialogOpen(true);
                                    }}
                                >
                                    <Plus className="mr-1 h-3 w-3" />
                                    Adicionar Sala
                                </Button>
                            </div>
                            
                            {dep.salas.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {dep.salas.map((sala: any) => (
                                        <div key={sala.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 border hover:bg-muted group transition-colors">
                                            <div className="flex items-center gap-2">
                                                <DoorOpen className="h-4 w-4 text-warning/70" />
                                                <span className="text-sm font-medium">{sala.nome}</span>
                                            </div>
                                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => openPrintDialog("SALA", { ...sala, departamento: dep.nome, secretaria: dep.secretaria })}
                                                >
                                                    <Printer className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => {
                                                        // Setup edit for sala
                                                        setDialogType("sala");
                                                        setEditingItem(sala);
                                                        setFormNome(sala.nome);
                                                        setFormDepartamento(String(dep.id));
                                                        // Find sec
                                                        const sec = allSecretarias.find((s: any) => s.nome === dep.secretaria);
                                                        if (sec) setFormSecretaria(String(sec.id));
                                                        setDialogOpen(true);
                                                    }}
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                                    onClick={() => {
                                                        setDeleteItem({
                                                            type: "sala",
                                                            id: String(sala.id),
                                                            nome: sala.nome,
                                                        });
                                                        setDeleteDialogOpen(true);
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">Nenhuma sala cadastrada neste departamento.</p>
                            )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}

              <PaginationControl
                currentPage={depMeta.page}
                totalPages={depMeta.totalPages}
                onPageChange={setDepPage}
              />
              <div className="text-xs text-muted-foreground text-right">
                {renderPaginationSummary(depMeta)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SALAS TAB - Mantemos como visualização alternativa ou removemos?
            Usuário pediu "formular melhor". Pode ser redundante manter a aba separada se tudo está em Departamentos.
            Mas pode ser útil para busca global. Vamos manter mas talvez renomear ou deixar como está.
            Se o usuário disse "fica muito confuso aqui, fica tudo misturado", ele se refere à aba atual.
            Vou manter a aba Salas como "Busca Global de Salas" mas a gestão principal será na aba Departamentos.
        */}
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
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar salas..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="w-64">
                  <SearchableSelect
                    value={filterSecretaria}
                    onValueChange={setFilterSecretaria}
                    placeholder="Filtrar por secretaria"
                    searchPlaceholder="Buscar secretaria..."
                    items={[
                      { value: "todas", label: "Todas as Secretarias" },
                      ...allSecretarias.map((s: any) => ({ value: String(s.id), label: s.nome })),
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
                  {salaList.map((sala: any) => (
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
                  {salaList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhuma sala encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <PaginationControl
                currentPage={salaMeta.page}
                totalPages={salaMeta.totalPages}
                onPageChange={setSalaPage}
              />
              <div className="text-xs text-muted-foreground text-right">
                {renderPaginationSummary(salaMeta)}
              </div>
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
                      placeholder="Buscar categorias..." 
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
                  {categories.map((cat: any) => (
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
              <PaginationControl
                currentPage={catMeta.page}
                totalPages={catMeta.totalPages}
                onPageChange={setCatPage}
              />
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
                  {marcas.map((marca: any) => (
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
              <PaginationControl
                currentPage={marcaMeta.page}
                totalPages={marcaMeta.totalPages}
                onPageChange={setMarcaPage}
              />
            </CardContent>
          </Card>
        </TabsContent>
        {/* GRUPOS TAB */}
        <TabsContent value="grupos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Grupos</CardTitle>
                <CardDescription>Gerencie os grupos de bens</CardDescription>
              </div>
              <Button onClick={() => openDialog("grupo")} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Novo Grupo
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative w-64">
                   <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                   <Input 
                      placeholder="Buscar grupos..." 
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
                  {grupos.map((grupo: any) => (
                    <TableRow key={grupo.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-primary" />
                          {grupo.nome}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openDialog("grupo", grupo)}
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
                              setDeleteItem({ type: "grupo", id: String(grupo.id), nome: grupo.nome })
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
                  {grupos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                        Nenhum grupo cadastrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <PaginationControl
                currentPage={grupoMeta.page}
                totalPages={grupoMeta.totalPages}
                onPageChange={setGrupoPage}
              />
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
                  items={allSecretarias.map((s: any) => ({
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
                  items={departamentosForSala.map((d: any) => ({
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
              <Label htmlFor="print-mode">Formato de Saida</Label>
              <Select value={printConfig.mode} onValueChange={(value: "zebra" | "pdf_comum") => setPrintConfig(prev => ({ ...prev, mode: value }))}>
                <SelectTrigger id="print-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zebra">Etiqueta Zebra</SelectItem>
                  <SelectItem value="pdf_comum">PDF Comum / A4</SelectItem>
                </SelectContent>
              </Select>
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="print-subtitle">Subtitulo do Preset</Label>
              <Input
                id="print-subtitle"
                placeholder="Ex: QR de identificacao"
                value={qrLayoutConfig.subtitle}
                onChange={(e) => setQrLayoutConfig(prev => ({ ...prev, subtitle: e.target.value }))}
              />
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

            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-footer"
                checked={printConfig.showFooter}
                onCheckedChange={(checked) => setPrintConfig(prev => ({ ...prev, showFooter: !!checked }))}
              />
              <Label htmlFor="show-footer" className="cursor-pointer font-normal">
                Mostrar rodape SisPatrimonio
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="qr-size-mm">QR (mm)</Label>
                <Input
                  id="qr-size-mm"
                  type="number"
                  step="0.5"
                  value={qrLayoutConfig.qrSizeMm}
                  onChange={(e) => setQrLayoutConfig(prev => ({ ...prev, qrSizeMm: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offset-x-mm">Offset X Zebra</Label>
                <Input
                  id="offset-x-mm"
                  type="number"
                  step="0.5"
                  value={qrLayoutConfig.offsetXMm}
                  onChange={(e) => setQrLayoutConfig(prev => ({ ...prev, offsetXMm: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offset-y-mm">Offset Y Zebra</Label>
                <Input
                  id="offset-y-mm"
                  type="number"
                  step="0.5"
                  value={qrLayoutConfig.offsetYMm}
                  onChange={(e) => setQrLayoutConfig(prev => ({ ...prev, offsetYMm: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offset-col2-mm">Ajuste 2a Coluna</Label>
                <Input
                  id="offset-col2-mm"
                  type="number"
                  step="0.5"
                  value={qrLayoutConfig.offsetColuna2Mm}
                  onChange={(e) => setQrLayoutConfig(prev => ({ ...prev, offsetColuna2Mm: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={handleSaveQrPreset}>
              Salvar Preset Global
            </Button>
            <Button onClick={executePrint}>
              <Printer className="mr-2 h-4 w-4" />
              {printConfig.mode === "zebra" ? "Gerar Zebra" : "Gerar PDF Comum"}
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
