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
import type { AssetCategory } from "@/lib/data"

interface CategoriaSelectorProps {
  value?: string
  onValueChange: (value: AssetCategory) => void
  className?: string
  placeholder?: string
}

interface Categoria {
  id: number
  nome: string
  slug: string
}

export function CategoriaSelector({ value, onValueChange, placeholder = "Selecione", className }: CategoriaSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [manageOpen, setManageOpen] = React.useState(false)
  const { data: result } = useSWR("/categorias?all=true", fetcher)
  const categorias = (Array.isArray(result) ? result : (result?.data || [])) as Categoria[]
  const { toast } = useToast()

  const [newItem, setNewItem] = React.useState("")
  const [newSlug, setNewSlug] = React.useState("")
  const [isCreating, setIsCreating] = React.useState(false)

  const handleSelect = (currentSlug: string) => {
    onValueChange(currentSlug as AssetCategory)
    setOpen(false)
  }

  const handleNameChange = (val: string) => {
    setNewItem(val)
    // Auto-generate slug
    const slug = val.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanum with hyphen
      .replace(/^-+|-+$/g, "") // Trim hyphens
    setNewSlug(slug)
  }

  const handleCreate = async () => {
    if (!newItem.trim() || !newSlug.trim()) return

    try {
      setIsCreating(true)
      const res = await api.createCategoria({ nome: newItem, slug: newSlug })
      
      if (res && res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      } else {
        toast({ title: "Sucesso", description: "Categoria criada com sucesso!" })
        setNewItem("")
        setNewSlug("")
        mutate("/categorias?all=true")
      }
    } catch (error: any) {
      console.error(error)
      const msg = error.response?.data?.error || error.message || "Erro ao criar categoria."
      toast({ title: "Erro", description: msg, variant: "destructive" })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: number, slug: string) => {
    if (!confirm(`Tem certeza que deseja remover a categoria?`)) return

    try {
      const res = await api.deleteCategoria(id)
      if (res && res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      } else {
        toast({ title: "Sucesso", description: "Categoria removida com sucesso!" })
        if (value === slug) onValueChange("" as AssetCategory)
        mutate("/categorias?all=true")
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || "Erro ao remover categoria"
      toast({ title: "Erro", description: msg, variant: "destructive" })
    }
  }

  const selectedItem = categorias.find(c => c.slug === value)

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
            {value
              ? categorias.find((c) => c.slug === value)?.nome || value
              : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Buscar categoria..." />
            <CommandList>
              <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
              <CommandGroup>
                {categorias.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.nome}
                    onSelect={() => handleSelect(item.slug)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === item.slug ? "opacity-100" : "opacity-0"
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
          <Button variant="outline" size="icon" title="Gerenciar Categorias">
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col gap-2 my-4">
            <div className="flex gap-2">
                <Input 
                placeholder="Nova categoria..." 
                value={newItem} 
                onChange={(e) => handleNameChange(e.target.value)}
                />
                <Button onClick={handleCreate} disabled={!newItem.trim() || isCreating}>
                <Plus className="h-4 w-4" />
                </Button>
            </div>
            <Input 
              placeholder="Slug (auto)" 
              value={newSlug} 
              onChange={(e) => setNewSlug(e.target.value)}
              className="text-xs text-muted-foreground font-mono"
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto border rounded-md">
            {categorias.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nenhuma categoria cadastrada.
              </div>
            ) : (
              <ul className="divide-y">
                {categorias.map((item) => (
                  <li key={item.id} className="flex items-center justify-between p-2 hover:bg-muted/50">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium">{item.nome}</span>
                        <span className="text-xs text-muted-foreground">{item.slug}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(item.id, item.slug)}
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
