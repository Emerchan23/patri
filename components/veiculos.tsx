"use client"

import { useState, useRef } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Car, Fuel, Gauge, Wrench, MapPin, User, Calendar, Tag, Clock, CheckCircle2, Eye, Trash2, Loader2, Edit, Save, Upload, X, ImageIcon } from "lucide-react"
import { getStatusLabel, getStatusColor, formatCurrency, formatDate } from "@/lib/data"
import type { Asset } from "@/lib/data"
import { fetcher, api } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/components/ui/use-toast"

export function Veiculos() {
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const { data: vehicles, isLoading, error, mutate } = useSWR<Asset[]>("/veiculos", fetcher)
  const [selectedVehicle, setSelectedVehicle] = useState<Asset | null>(null)
  
  // Edit State
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editForm, setEditForm] = useState({
    patrimonio: "",
    descricao: "",
    marca: "",
    modelo: "",
    placa: "",
    ano: "",
    kmAtual: "",
    valor: "",
    status: "",
    imagem: null as string | null,
  })

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

  const handleEditClick = (vehicle: Asset) => {
    setSelectedVehicle(vehicle)
    setEditForm({
      patrimonio: vehicle.patrimonio || "",
      descricao: vehicle.descricao,
      marca: vehicle.marca || "",
      modelo: vehicle.modelo || "",
      placa: vehicle.placa || "",
      ano: vehicle.ano?.toString() || "",
      kmAtual: vehicle.kmAtual?.toString() || "",
      valor: vehicle.valor ? vehicle.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "",
      status: vehicle.status,
      imagem: vehicle.imagem || null,
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

  const handleSaveEdit = async () => {
    if (!selectedVehicle) return
    
    // Validation
    const missingFields: string[] = []
    if (!editForm.descricao.trim()) missingFields.push("Descrição")
    if (!editForm.patrimonio.trim()) missingFields.push("Patrimônio")
    if (!editForm.status) missingFields.push("Status")
    if (!editForm.valor) missingFields.push("Valor")
    
    if (missingFields.length > 0) {
      toast({
        title: "Campos Obrigatórios Faltando",
        description: `Por favor, preencha os seguintes campos: ${missingFields.join(", ")}.`,
        variant: "destructive",
        duration: 5000,
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        patrimonio: editForm.patrimonio,
        descricao: editForm.descricao,
        marca: editForm.marca,
        modelo: editForm.modelo,
        placa: editForm.placa,
        ano: parseInt(editForm.ano) || 0,
        kmAtual: parseInt(editForm.kmAtual) || 0,
        valor: parseCurrencyInput(editForm.valor),
        status: editForm.status,
        imagem: editForm.imagem,
      }
      
      await api.updateVeiculo(selectedVehicle.id, payload)
      await mutate()
      
      toast({
        title: "Sucesso",
        description: "Veículo atualizado com sucesso!",
      })
      
      setShowEditDialog(false)
      setSelectedVehicle(null)
    } catch (err) {
      console.error("Erro ao editar veículo:", err)
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar o veículo. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<Asset | null>(null)
  const [deleteReason, setDeleteReason] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteClick = (vehicle: Asset) => {
    setItemToDelete(vehicle)
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
      await api.deleteVeiculo(itemToDelete.id, deleteReason)
      await mutate()
      
      toast({
        title: "Sucesso",
        description: "Veículo excluído com sucesso!",
      })
      
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    } catch (err) {
      console.error("Erro ao excluir veiculo:", err)
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o veículo. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando frota de veiculos...</div>
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        <p>Erro ao carregar veiculos. Tente recarregar a pagina.</p>
        <p className="text-xs mt-2 text-muted-foreground">{error.message}</p>
      </div>
    )
  }

  const veiculosList = vehicles || []

  if (veiculosList.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">Controle de Veiculos</h1>
          <p className="text-sm text-muted-foreground mt-1">Nenhum veiculo encontrado no sistema.</p>
        </div>
        <div className="p-12 border border-dashed rounded-lg text-center">
          <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Nenhum veiculo cadastrado</h3>
          <p className="text-muted-foreground">Cadastre um bem com a categoria "Veiculo" para ve-lo aqui.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-balance">Controle de Veiculos</h1>
        <p className="text-sm text-muted-foreground mt-1">Frota municipal - {veiculosList.length} veiculos cadastrados</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Car className="h-5 w-5 text-primary" /></div><div><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{veiculosList.length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10"><CheckCircle2 className="h-5 w-5 text-success" /></div><div><p className="text-xs text-muted-foreground">Ativos</p><p className="text-xl font-bold">{veiculosList.filter((v) => v.status === "ativo").length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10"><Wrench className="h-5 w-5 text-warning" /></div><div><p className="text-xs text-muted-foreground">Manutencao</p><p className="text-xl font-bold">{veiculosList.filter((v) => v.status === "em_manutencao").length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info/10"><Gauge className="h-5 w-5 text-info" /></div><div><p className="text-xs text-muted-foreground">KM Total</p><p className="text-xl font-bold">{(veiculosList.reduce((sum, v) => sum + (v.kmAtual || 0), 0) / 1000).toFixed(0)}k</p></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {veiculosList.map((vehicle) => {
          const maxKm = 150000
          const kmPercent = Math.min(((vehicle.kmAtual || 0) / maxKm) * 100, 100)
          return (
            <Card key={vehicle.id} className="overflow-hidden">
              <div className="h-2 bg-primary" />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div><CardTitle className="text-base">{vehicle.descricao}</CardTitle><CardDescription className="mt-1">{vehicle.marca} {vehicle.modelo}</CardDescription></div>
                  <Badge className={`text-xs ${getStatusColor(vehicle.status)}`}>{getStatusLabel(vehicle.status)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 rounded-lg bg-muted p-2.5"><Tag className="h-4 w-4 text-muted-foreground shrink-0" /><div><p className="text-[10px] text-muted-foreground">Placa</p><p className="text-sm font-bold">{vehicle.placa}</p></div></div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted p-2.5"><Calendar className="h-4 w-4 text-muted-foreground shrink-0" /><div><p className="text-[10px] text-muted-foreground">Ano</p><p className="text-sm font-bold">{vehicle.ano}</p></div></div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5"><span className="text-xs text-muted-foreground">Quilometragem</span><span className="text-xs font-semibold">{(vehicle.kmAtual || 0).toLocaleString("pt-BR")} km</span></div>
                  <Progress value={kmPercent} className="h-2" />
                </div>
                <div className="flex items-center gap-2">
                  {vehicle.patrimonioTipo === "provisorio" ? (
                    <Badge variant="outline" className="text-[10px] border-warning/50 text-warning"><Clock className="h-3 w-3 mr-1" />{vehicle.patrimonio}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">{vehicle.patrimonio}</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><User className="h-3.5 w-3.5" /><span className="truncate max-w-32">{typeof vehicle.responsavel === 'object' ? vehicle.responsavel?.nome : vehicle.responsavel}</span></div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setSelectedVehicle(vehicle)}><Eye className="h-3.5 w-3.5" />Detalhes</Button>
                    {hasPermission("gerenciarVeiculos") && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEditClick(vehicle)}>
                        <Edit className="h-3.5 w-3.5" />
                        <span className="sr-only">Editar</span>
                      </Button>
                    )}
                    {hasPermission("excluirBem") && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteClick(vehicle)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Excluir</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={!!selectedVehicle && !showEditDialog} onOpenChange={(open) => !open && setSelectedVehicle(null)}>
        <DialogContent className="max-w-lg">
          {selectedVehicle && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <DialogTitle>{selectedVehicle.descricao}</DialogTitle>
                  <DialogDescription className="sr-only">Detalhes do veículo</DialogDescription>
                  <Badge className={`text-xs ${getStatusColor(selectedVehicle.status)}`}>{getStatusLabel(selectedVehicle.status)}</Badge>
                </div>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="flex flex-col gap-1 rounded-lg bg-muted p-3"><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Placa</span><span className="text-lg font-bold">{selectedVehicle.placa}</span></div>
                <div className="flex flex-col gap-1 rounded-lg bg-muted p-3"><span className="text-[10px] text-muted-foreground uppercase tracking-wider">KM Atual</span><span className="text-lg font-bold">{(selectedVehicle.kmAtual || 0).toLocaleString("pt-BR")}</span></div>
              </div>
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex items-start gap-3"><Car className="h-4 w-4 mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Marca / Modelo</p><p className="text-sm font-medium">{selectedVehicle.marca} {selectedVehicle.modelo} ({selectedVehicle.ano})</p></div></div>
                <div className="flex items-start gap-3"><Tag className="h-4 w-4 mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Patrimonio</p><div className="flex items-center gap-2"><p className="text-sm font-mono font-medium">{selectedVehicle.patrimonio}</p>{selectedVehicle.patrimonioTipo === "provisorio" && (<Badge variant="outline" className="text-[10px] border-warning/50 text-warning">Provisorio</Badge>)}</div></div></div>
                <div className="flex items-start gap-3"><MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Secretaria</p><p className="text-sm font-medium">{selectedVehicle.localizacao?.secretaria}</p><p className="text-xs text-muted-foreground">{selectedVehicle.localizacao?.departamento}</p></div></div>
                <div className="flex items-start gap-3"><User className="h-4 w-4 mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Responsavel</p><p className="text-sm font-medium">{typeof selectedVehicle.responsavel === 'object' ? selectedVehicle.responsavel?.nome : selectedVehicle.responsavel}</p><p className="text-xs text-muted-foreground">{typeof selectedVehicle.responsavel === 'object' ? selectedVehicle.responsavel?.cargo : ""}</p></div></div>
                <div className="flex items-start gap-3"><Fuel className="h-4 w-4 mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Valor</p><p className="text-sm font-medium">{formatCurrency(selectedVehicle.valor)}</p></div></div>
                <div className="flex items-start gap-3"><Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Data de Aquisicao</p><p className="text-sm font-medium">{formatDate(selectedVehicle.dataAquisicao)}</p></div></div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Vehicle Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        if (!open) { setShowEditDialog(false); setSelectedVehicle(null); }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Veículo</DialogTitle>
            <DialogDescription>
              Faça as alterações necessárias nos dados do veículo.
            </DialogDescription>
          </DialogHeader>
          {selectedVehicle && (
            <div className="flex flex-col gap-6 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                   <div className="flex flex-col gap-2">
                     <Label htmlFor="edit-patrimonio" required>Patrimônio</Label>
                     <Input 
                       id="edit-patrimonio" 
                       value={editForm.patrimonio} 
                       onChange={(e) => setEditForm({...editForm, patrimonio: e.target.value})}
                     />
                   </div>
                   <div className="flex flex-col gap-2">
                     <Label htmlFor="edit-descricao" required>Descrição</Label>
                     <Input 
                       id="edit-descricao" 
                       value={editForm.descricao} 
                       onChange={(e) => setEditForm({...editForm, descricao: e.target.value})}
                     />
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                     <div className="flex flex-col gap-2">
                       <Label htmlFor="edit-marca">Marca</Label>
                       <Input 
                         id="edit-marca" 
                         value={editForm.marca} 
                         onChange={(e) => setEditForm({...editForm, marca: e.target.value})}
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

                   <div className="grid grid-cols-2 gap-4">
                     <div className="flex flex-col gap-2">
                       <Label htmlFor="edit-placa">Placa</Label>
                       <Input 
                         id="edit-placa" 
                         value={editForm.placa} 
                         onChange={(e) => setEditForm({...editForm, placa: e.target.value})}
                       />
                     </div>
                     <div className="flex flex-col gap-2">
                       <Label htmlFor="edit-ano">Ano</Label>
                       <Input 
                         id="edit-ano"
                         type="number"
                         value={editForm.ano} 
                         onChange={(e) => setEditForm({...editForm, ano: e.target.value})}
                       />
                     </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                     <div className="flex flex-col gap-2">
                       <Label htmlFor="edit-km">KM Atual</Label>
                       <Input 
                         id="edit-km"
                         type="number"
                         value={editForm.kmAtual} 
                         onChange={(e) => setEditForm({...editForm, kmAtual: e.target.value})}
                       />
                     </div>
                     <div className="flex flex-col gap-2">
                       <Label htmlFor="edit-valor" required>Valor</Label>
                       <Input 
                         id="edit-valor" 
                         value={editForm.valor} 
                         onChange={(e) => setEditForm({...editForm, valor: formatCurrencyInput(e.target.value)})}
                       />
                     </div>
                   </div>

                   <div className="flex flex-col gap-2">
                     <Label htmlFor="edit-status" required>Status</Label>
                     <Select 
                       value={editForm.status} 
                       onValueChange={(v) => setEditForm({...editForm, status: v})}
                     >
                       <SelectTrigger id="edit-status">
                         <SelectValue placeholder="Selecione" />
                       </SelectTrigger>
                       <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="em_manutencao">Em Manutenção</SelectItem>
                          <SelectItem value="baixado">Baixado</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
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
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => { setShowEditDialog(false); setSelectedVehicle(null); }}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveEdit} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Alterações
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Veículo</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este veículo? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="delete-reason" required>Motivo da Exclusão</Label>
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
    </div>
  )
}
