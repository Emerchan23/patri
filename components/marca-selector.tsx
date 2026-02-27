"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus, Settings, Trash2 } from "lucide-react"
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
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"

interface MarcaSelectorProps {
  value?: string
  onValueChange: (value: string) => void
  className?: string
  placeholder?: string
}

interface Marca {
  id: number
  nome: string
}

export function MarcaSelector({
  value,
  onValueChange,
  className,
  placeholder = "Selecione uma marca",
}: MarcaSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [manageOpen, setManageOpen] = React.useState(false)
  const { data: marcas = [] } = useSWR<Marca[]>("/marcas", fetcher)
  const { toast } = useToast()

  const [newItem, setNewItem] = React.useState("")
  const [isCreating, setIsCreating] = React.useState(false)

  const handleSelect = (currentValue: string) => {
    onValueChange(currentValue)
    setOpen(false)
  }

  const handleCreate = async () => {
    if (!newItem.trim()) return

    try {
      setIsCreating(true)
      const res = await api.createMarca({ nome: newItem })
      
      if (res && res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      } else {
        toast({ title: "Sucesso", description: "Marca criada com sucesso!" })
        setNewItem("")
        mutate("/marcas")
        // Optionally select the new item
        // onValueChange(newItem)
      }
    } catch (error: any) {
      console.error(error)
      toast({ title: "Erro", description: error.message || "Erro ao criar marca.", variant: "destructive" })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: number, nome: string) => {
    if (!confirm(`Tem certeza que deseja remover a marca "${nome}"?`)) return

    try {
      const res = await api.deleteMarca(id)
      if (res && res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      } else {
        toast({ title: "Sucesso", description: "Marca removida com sucesso!" })
        if (value === nome) onValueChange("")
        mutate("/marcas")
      }
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao remover marca", variant: "destructive" })
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
            className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
          >
            {value || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Buscar marca..." />
            <CommandList>
              <CommandEmpty>Nenhuma marca encontrada.</CommandEmpty>
              <CommandGroup>
                {marcas.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.nome}
                    onSelect={() => handleSelect(item.nome)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === item.nome ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {item.nome}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" title="Gerenciar Marcas">
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Marcas</DialogTitle>
          </DialogHeader>
          
          <div className="flex gap-2 my-4">
            <Input 
              placeholder="Nova marca..." 
              value={newItem} 
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button onClick={handleCreate} disabled={!newItem.trim() || isCreating}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-[300px] overflow-y-auto border rounded-md">
            {marcas.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nenhuma marca cadastrada.
              </div>
            ) : (
              <ul className="divide-y">
                {marcas.map((item) => (
                  <li key={item.id} className="flex items-center justify-between p-2 hover:bg-muted/50">
                    <span className="text-sm">{item.nome}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(item.id, item.nome)}
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
