"use client"

import { useState } from "react"
import useSWR from "swr"
import { Settings, Trash2, Plus, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { api, fetcher } from "@/lib/api-client"
import { useToast } from "@/components/ui/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface ResponsavelSelectProps {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  onSelect?: (servidor: any) => void
}

export function ResponsavelSelect({
  value,
  onValueChange,
  placeholder = "Selecione o responsável",
  disabled = false,
  onSelect,
}: ResponsavelSelectProps) {
  const { toast } = useToast()
  const { data: servidores, mutate } = useSWR("/servidores", fetcher)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<"list" | "create">("list")
  const [loading, setLoading] = useState(false)
  const [nome, setNome] = useState("")
  const [cargo, setCargo] = useState("")
  const [cpf, setCpf] = useState("")
  const [deletingId, setDeletingId] = useState<number | string | null>(null)

  const handleCreate = async () => {
    if (!nome || !cargo) {
      toast({
        title: "Erro",
        description: "Nome e Cargo são obrigatórios.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const newServidor = await api.createServidor({ nome, cargo, cpf })
      await mutate()
      onValueChange(newServidor.nome)
      if (onSelect) onSelect(newServidor)
      
      // Reset and go back to list
      setNome("")
      setCargo("")
      setCpf("")
      setView("list")
      
      toast({
        title: "Sucesso",
        description: "Responsável cadastrado com sucesso!",
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "Erro",
        description: "Erro ao cadastrar responsável.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number | string) => {
    setLoading(true)
    try {
      await api.deleteServidor(id)
      await mutate()
      
      // If the deleted one was selected, clear selection
      const deletedServidor = Array.isArray(servidores) ? servidores.find((s: any) => s.id === id) : null
      if (deletedServidor && deletedServidor.nome === value) {
        onValueChange("")
      }

      toast({
        title: "Sucesso",
        description: "Responsável excluído com sucesso!",
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "Erro",
        description: "Erro ao excluir responsável.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setDeletingId(null)
    }
  }

  const items = Array.isArray(servidores)
    ? servidores.map((s: any) => ({
        value: s.nome,
        label: `${s.nome} - ${s.cargo}`,
        searchTerms: `${s.nome} ${s.cargo} ${s.cpf || ""}`,
        original: s,
      }))
    : []

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <SearchableSelect
          value={value}
          onValueChange={(val) => {
            onValueChange(val)
            if (onSelect) {
              const selected = items.find((i: any) => i.value === val)
              if (selected) onSelect(selected.original)
            }
          }}
          items={items}
          placeholder={placeholder}
          searchPlaceholder="Buscar responsável..."
          disabled={disabled}
        />
      </div>
      <Dialog open={open} onOpenChange={(o) => {
        setOpen(o)
        if (!o) setView("list") // Reset to list view when closed
      }}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" title="Gerenciar Responsáveis">
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {view === "list" ? "Gerenciar Responsáveis" : "Novo Responsável"}
            </DialogTitle>
            <DialogDescription>
              {view === "list" 
                ? "Lista de servidores cadastrados como responsáveis."
                : "Cadastre um novo servidor para assumir responsabilidade sobre bens."}
            </DialogDescription>
          </DialogHeader>

          {view === "list" ? (
            <div className="flex flex-col gap-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setView("create")} className="gap-2">
                  <Plus className="h-4 w-4" /> Novo Responsável
                </Button>
              </div>
              <ScrollArea className="h-[300px] w-full rounded-md border p-2">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                    <p className="text-sm">Nenhum responsável cadastrado.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {items.map((item: any) => (
                      <div key={item.original.id} className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.original.nome}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.original.cargo}</p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Responsável?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir <strong>{item.original.nome}</strong>?
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(item.original.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {loading ? "Excluindo..." : "Excluir"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cargo">Cargo</Label>
                  <Input
                    id="cargo"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    placeholder="Cargo / Função"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cpf">CPF (Opcional)</Label>
                  <Input
                    id="cpf"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="ghost" onClick={() => setView("list")} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
                <Button onClick={handleCreate} disabled={loading}>
                  {loading ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
