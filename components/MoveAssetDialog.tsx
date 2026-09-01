"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import type { Asset } from "@/lib/data"

interface MoveAssetDialogProps {
  asset: Asset | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface Secretaria {
  id: number
  nome: string
  departamentos: {
    id: number
    nome: string
    salas: { id: number; nome: string }[]
  }[]
}

export function MoveAssetDialog({ asset, open, onOpenChange, onSuccess }: MoveAssetDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fetchingLocations, setFetchingLocations] = useState(false)
  const [secretarias, setSecretarias] = useState<Secretaria[]>([])
  
  const [selectedSecretaria, setSelectedSecretaria] = useState<string>("")
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>("")
  const [selectedSala, setSelectedSala] = useState<string>("")
  const [motivo, setMotivo] = useState("")

  // Reset form when dialog opens/closes or asset changes
  useEffect(() => {
    if (open) {
      setSelectedSecretaria("")
      setSelectedDepartamento("")
      setSelectedSala("")
      setMotivo("")
      fetchLocations()
    }
  }, [open, asset])

  const fetchLocations = async () => {
    try {
      setFetchingLocations(true)
      const res = await fetch("/api/secretarias?all=true")
      if (!res.ok) throw new Error("Falha ao carregar locais")
      const data = await res.json()
      if (Array.isArray(data)) {
        setSecretarias(data)
      } else if (data.data && Array.isArray(data.data)) {
        setSecretarias(data.data)
      } else {
        setSecretarias([])
      }
    } catch (error) {
      console.error(error)
      toast({
        title: "Erro",
        description: "Não foi possível carregar as secretarias.",
        variant: "destructive",
      })
    } finally {
      setFetchingLocations(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!asset) return

    const missingFields: string[] = []
    if (!selectedSecretaria) missingFields.push("Secretaria")
    if (!selectedDepartamento) missingFields.push("Departamento")
    if (!selectedSala) missingFields.push("Sala")
    if (!motivo.trim()) missingFields.push("Motivo")

    if (missingFields.length > 0) {
      toast({
        title: "Campos Obrigatórios Faltando",
        description: `Por favor, preencha os seguintes campos: ${missingFields.join(", ")}.`,
        variant: "destructive",
        duration: 5000,
      })
      return
    }

    try {
      setLoading(true)
      
      // Find names for selected IDs
      const sec = secretarias.find(s => s.id.toString() === selectedSecretaria)
      const dep = sec?.departamentos.find(d => d.id.toString() === selectedDepartamento)
      const sala = dep?.salas.find(s => s.id.toString() === selectedSala)

      const payload = {
        assetId: asset.id,
        assetDescricao: asset.descricao,
        patrimonio: asset.patrimonio,
        de: {
          secretaria: asset.localizacao?.secretaria || "-",
          departamento: asset.localizacao?.departamento || "-",
          sala: asset.localizacao?.sala || "-"
        },
        para: {
          secretaria: sec?.nome,
          departamento: dep?.nome,
          sala: sala?.nome
        },
        responsavel: "Sistema Mobile", // Idealmente pegar do usuário logado
        data: new Date().toISOString().split('T')[0],
        motivo: motivo
      }

      const res = await fetch("/api/movimentacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error("Falha ao registrar movimentação")

      toast({
        title: "Sucesso",
        description: "Movimentação registrada com sucesso!",
      })
      
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error(error)
      toast({
        title: "Erro",
        description: "Não foi possível registrar a movimentação.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Filtered lists based on selection
  const departamentos = secretarias.find(s => s.id.toString() === selectedSecretaria)?.departamentos || []
  const salas = departamentos.find(d => d.id.toString() === selectedDepartamento)?.salas || []

  if (!asset) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Movimentar Bem</DialogTitle>
          <DialogDescription className="break-words pr-6">
            Defina o novo local para: <strong className="break-words">{asset.descricao}</strong> ({asset.patrimonio})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium break-words">{asset.descricao}</p>
            <p className="text-xs text-muted-foreground font-mono mt-1">{asset.patrimonio}</p>
          </div>

          <div className="grid gap-2">
            <Label>Nova Secretaria</Label>
            <SearchableSelect
              items={secretarias.map((s) => ({
                value: s.id.toString(),
                label: s.nome,
              }))}
              value={selectedSecretaria}
              onValueChange={(val) => {
                setSelectedSecretaria(val)
                setSelectedDepartamento("")
                setSelectedSala("")
              }}
              disabled={fetchingLocations}
              placeholder="Selecione a secretaria"
              searchPlaceholder="Buscar secretaria..."
              emptyMessage="Nenhuma secretaria encontrada."
            />
          </div>

          <div className="grid gap-2">
            <Label>Novo Departamento</Label>
            <SearchableSelect
              items={departamentos.map((d) => ({
                value: d.id.toString(),
                label: d.nome,
              }))}
              value={selectedDepartamento}
              onValueChange={(val) => {
                setSelectedDepartamento(val)
                setSelectedSala("")
              }}
              disabled={!selectedSecretaria}
              placeholder="Selecione o departamento"
              searchPlaceholder="Buscar departamento..."
              emptyMessage="Nenhum departamento encontrado."
            />
          </div>

          <div className="grid gap-2">
            <Label>Nova Sala</Label>
            <SearchableSelect
              items={salas.map((s) => ({
                value: s.id.toString(),
                label: s.nome,
              }))}
              value={selectedSala}
              onValueChange={setSelectedSala}
              disabled={!selectedDepartamento}
              placeholder="Selecione a sala"
              searchPlaceholder="Buscar sala..."
              emptyMessage="Nenhuma sala encontrada."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="motivo">Motivo da Movimentação</Label>
            <Textarea
              id="motivo"
              placeholder="Ex: Mudança de setor, reforma, etc."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="resize-none"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Movimentação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
