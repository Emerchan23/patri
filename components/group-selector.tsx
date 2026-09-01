"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus, Settings, Trash2, X } from "lucide-react"
import useSWR, { mutate } from "swr"
import { fetcher, api } from "@/lib/api-client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"

interface GroupSelectorProps {
  value?: string
  onValueChange: (value: string) => void
  className?: string
  placeholder?: string
}

interface Grupo {
  id: number
  nome: string
}

export function GroupSelector({
  value,
  onValueChange,
  className,
  placeholder = "Selecione",
}: GroupSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [manageOpen, setManageOpen] = React.useState(false)
  const { data: result } = useSWR("/api/grupos?all=true", fetcher)
  const groups = Array.isArray(result) ? result : (result?.data || [])
  const { toast } = useToast()

  // Gerenciamento de grupos
  const [newGroup, setNewGroup] = React.useState("")
  const [isCreating, setIsCreating] = React.useState(false)

  const handleSelect = (currentValue: string) => {
    onValueChange(currentValue)
    setOpen(false)
  }

  const handleCreateGroup = async () => {
    if (!newGroup.trim()) return

    try {
      setIsCreating(true)
      const res = await api.createGrupo({ nome: newGroup })
      
      if (res && res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      } else {
        toast({ title: "Sucesso", description: "Grupo criado com sucesso!" })
        setNewGroup("")
        mutate("/api/grupos?all=true")
        // Also mutate the paginated list if visible
        mutate("/api/grupos")
      }
    } catch (error: any) {
      console.error("Error creating group:", error)
      const msg = error.response?.data?.error || error.message || "Erro ao criar grupo."
      toast({ title: "Erro", description: msg, variant: "destructive" })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteGroup = async (id: number, nome: string) => {
    if (!confirm(`Tem certeza que deseja remover o grupo "${nome}"?`)) return

    try {
      const res = await api.deleteGrupo(id)
      if (res && res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      } else {
        toast({ title: "Sucesso", description: "Grupo removido com sucesso!" })
        if (value === nome) onValueChange("")
        mutate("/api/grupos?all=true")
        mutate("/api/grupos")
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || "Erro ao remover grupo"
      toast({ title: "Erro", description: msg, variant: "destructive" })
    }
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between", className)}
          >
            {value || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Buscar grupo..." />
            <CommandList>
              <CommandEmpty>Nenhum grupo encontrado.</CommandEmpty>
              <CommandGroup>
                {groups.map((group: any) => (
                  <CommandItem
                    key={group.id}
                    value={group.nome}
                    onSelect={() => handleSelect(group.nome)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === group.nome ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {group.nome}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" title="Gerenciar Grupos">
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Grupos</DialogTitle>
          </DialogHeader>
          
          <div className="flex gap-2 my-4">
            <Input 
              placeholder="Novo grupo..." 
              value={newGroup} 
              onChange={(e) => setNewGroup(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
            />
            <Button onClick={handleCreateGroup} disabled={!newGroup.trim() || isCreating}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-[300px] overflow-y-auto border rounded-md">
            {groups.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nenhum grupo cadastrado.
              </div>
            ) : (
              <ul className="divide-y">
                {groups.map((group: any) => (
                  <li key={group.id} className="flex items-center justify-between p-2 hover:bg-muted/50">
                    <span className="text-sm">{group.nome}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteGroup(group.id, group.nome)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
