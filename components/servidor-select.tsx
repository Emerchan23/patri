
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus, Pencil, Trash2, Settings, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { api } from "@/lib/api-client"

type Servidor = {
  id: number
  nome: string
  cargo: string
  cpf: string
}

interface ServidorSelectProps {
  onSelect: (servidor: Servidor) => void
  className?: string
}

export function ServidorSelect({ onSelect, className }: ServidorSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [servidores, setServidores] = React.useState<Servidor[]>([])
  const [loading, setLoading] = React.useState(false)
  const [manageOpen, setManageOpen] = React.useState(false)
  const [editingServidor, setEditingServidor] = React.useState<Servidor | null>(null)
  const [formData, setFormData] = React.useState({ nome: "", cargo: "", cpf: "" })
  const { toast } = useToast()

  React.useEffect(() => {
    fetchServidores()
  }, [])

  const fetchServidores = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/servidores")
      if (response.ok) {
        const data = await response.json()
        setServidores(data)
      }
    } catch (error) {
      console.error("Erro ao buscar servidores", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.nome || !formData.cargo) {
      toast({ title: "Nome e Cargo são obrigatórios", variant: "destructive" })
      return
    }

    try {
      if (editingServidor) {
        // Update
        const response = await fetch(`/api/servidores/${editingServidor.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        })
        if (!response.ok) throw new Error("Falha ao atualizar")
        toast({ title: "Servidor atualizado!" })
      } else {
        // Create
        const response = await fetch("/api/servidores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        })
        if (!response.ok) throw new Error("Falha ao criar")
        toast({ title: "Servidor cadastrado!" })
      }
      
      setEditingServidor(null)
      setFormData({ nome: "", cargo: "", cpf: "" })
      fetchServidores()
    } catch (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este servidor?")) return

    try {
      const response = await fetch(`/api/servidores/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Falha ao excluir")
      
      toast({ title: "Servidor removido!" })
      fetchServidores()
    } catch (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" })
    }
  }

  const startEdit = (s: Servidor) => {
    setEditingServidor(s)
    setFormData({ nome: s.nome, cargo: s.cargo, cpf: s.cpf || "" })
  }

  const cancelEdit = () => {
    setEditingServidor(null)
    setFormData({ nome: "", cargo: "", cpf: "" })
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <span className="truncate text-muted-foreground font-normal">
              Selecionar profissional cadastrado...
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar servidor..." />
            <CommandList>
              <CommandEmpty>Nenhum servidor encontrado.</CommandEmpty>
              <CommandGroup heading="Servidores">
                {servidores.map((servidor) => (
                  <CommandItem
                    key={servidor.id}
                    value={servidor.nome}
                    onSelect={() => {
                      onSelect(servidor)
                      setOpen(false)
                    }}
                  >
                    <User className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{servidor.nome}</span>
                      <span className="text-xs text-muted-foreground">{servidor.cargo}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false)
                    setManageOpen(true)
                  }}
                  className="text-blue-600 font-medium cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Gerenciar Profissionais
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Gerenciar Profissionais / Comissão</DialogTitle>
            <DialogDescription>
              Cadastre, edite ou remova profissionais para uso nas comissões.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-6 flex-1 overflow-hidden py-4">
            {/* Formulario */}
            <div className="w-1/3 space-y-4 border-r pr-6">
              <h3 className="font-medium text-sm">
                {editingServidor ? "Editar Profissional" : "Novo Profissional"}
              </h3>
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input 
                  value={formData.nome} 
                  onChange={e => setFormData({...formData, nome: e.target.value})}
                  placeholder="Ex: João da Silva"
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo *</Label>
                <Input 
                  value={formData.cargo} 
                  onChange={e => setFormData({...formData, cargo: e.target.value})}
                  placeholder="Ex: Diretor Administrativo"
                />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input 
                  value={formData.cpf} 
                  onChange={e => setFormData({...formData, cpf: e.target.value})}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="flex gap-2 pt-2">
                {editingServidor && (
                  <Button variant="outline" size="sm" onClick={cancelEdit} className="flex-1">
                    Cancelar
                  </Button>
                )}
                <Button size="sm" onClick={handleSave} className="flex-1">
                  {editingServidor ? "Atualizar" : "Cadastrar"}
                </Button>
              </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-auto pl-2">
              <h3 className="font-medium text-sm mb-4">Profissionais Cadastrados ({servidores.length})</h3>
              <div className="space-y-2">
                {servidores.length === 0 && (
                  <p className="text-muted-foreground text-sm italic">Nenhum profissional cadastrado.</p>
                )}
                {servidores.map(servidor => (
                  <div key={servidor.id} className="flex items-center justify-between p-3 border rounded-md bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div>
                      <p className="font-medium text-sm">{servidor.nome}</p>
                      <p className="text-xs text-muted-foreground">{servidor.cargo} • {servidor.cpf || "Sem CPF"}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(servidor)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(servidor.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
