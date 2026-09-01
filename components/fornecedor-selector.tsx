"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus, Settings, Trash2 } from "lucide-react"
import useSWR, { mutate } from "swr"
import { fetcher, api, getApiErrorMessage } from "@/lib/api-client"

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
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

interface FornecedorSelectorProps {
  value?: string
  onValueChange: (value: string) => void
  className?: string
  placeholder?: string
}

interface Fornecedor {
  id: string
  nome: string // Nome Fantasia ou genérico
  nome_fantasia?: string
  razao_social?: string
  cnpj?: string
  telefone?: string
  endereco?: string
  cidade?: string
  estado?: string
}

const formatCNPJ = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1')
}

export function FornecedorSelector({
  value,
  onValueChange,
  className,
  placeholder = "Selecione",
}: FornecedorSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [manageOpen, setManageOpen] = React.useState(false)
  const { data: fornecedoresData } = useSWR("/fornecedores?all=true", fetcher)
  const fornecedores = (Array.isArray(fornecedoresData) ? fornecedoresData : (fornecedoresData?.data || [])) as Fornecedor[]
  const { toast } = useToast()

  // Form states
  const [nome, setNome] = React.useState("") // Usado como Nome Fantasia principal
  const [razaoSocial, setRazaoSocial] = React.useState("")
  const [cnpj, setCnpj] = React.useState("")
  const [telefone, setTelefone] = React.useState("")
  const [endereco, setEndereco] = React.useState("")
  const [cidade, setCidade] = React.useState("")
  const [estado, setEstado] = React.useState("")
  
  const [isCreating, setIsCreating] = React.useState(false)

  const handleSelect = (currentValue: string) => {
    onValueChange(currentValue)
    setOpen(false)
  }

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCnpj(formatCNPJ(e.target.value))
  }

  const resetForm = () => {
    setNome("")
    setRazaoSocial("")
    setCnpj("")
    setTelefone("")
    setEndereco("")
    setCidade("")
    setEstado("")
  }

  const handleCreate = async () => {
    if (!nome.trim()) {
        toast({ title: "Erro", description: "Nome Fantasia é obrigatório.", variant: "destructive" })
        return
    }
    if (!cnpj.trim()) {
        toast({ title: "Erro", description: "CNPJ é obrigatório.", variant: "destructive" })
        return
    }

    try {
      setIsCreating(true)
      const payload = {
        nome: nome,
        nome_fantasia: nome,
        razao_social: razaoSocial,
        cnpj: cnpj,
        telefone: telefone,
        endereco: endereco,
        cidade: cidade,
        estado: estado
      }

      const res = await api.createFornecedor(payload)
      
      if (res && res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      } else {
        toast({ title: "Sucesso", description: "Fornecedor criado com sucesso!" })
        resetForm()
        mutate("/fornecedores?all=true")
      }
    } catch (error: any) {
      console.error(error)
      const msg = getApiErrorMessage(error, "Erro ao criar fornecedor.")
      toast({ title: "Erro", description: msg, variant: "destructive" })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja remover o fornecedor "${nome}"?`)) return

    try {
      const res = await api.deleteFornecedor(id)
      if (res && res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      } else {
        toast({ title: "Sucesso", description: "Fornecedor removido com sucesso!" })
        if (value === nome) onValueChange("")
        mutate("/fornecedores?all=true")
      }
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao remover fornecedor", variant: "destructive" })
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
            <CommandInput placeholder="Buscar fornecedor..." />
            <CommandList>
              <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
              <CommandGroup>
                {fornecedores.map((item) => (
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
                    <div className="flex flex-col">
                        <span className="font-medium">{item.nome}</span>
                        {item.cnpj && <span className="text-xs text-muted-foreground">{item.cnpj}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" title="Gerenciar Fornecedores">
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Fornecedores</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4 border-b pb-6">
            <h3 className="text-sm font-medium leading-none">Novo Fornecedor</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="nome">Nome Fantasia *</Label>
                    <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Loja de Informática" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="razao">Razão Social</Label>
                    <Input id="razao" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Ex: Informática Ltda" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ *</Label>
                    <Input id="cnpj" value={cnpj} onChange={handleCnpjChange} placeholder="00.000.000/0000-00" maxLength={18} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 0000-0000" />
                </div>
                <div className="space-y-2 col-span-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, Número, Bairro" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex: São Paulo" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="estado">Estado</Label>
                    <Input id="estado" value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} placeholder="UF" maxLength={2} />
                </div>
            </div>
            <Button onClick={handleCreate} disabled={isCreating} className="w-full mt-2">
              <Plus className="mr-2 h-4 w-4" /> Cadastrar Fornecedor
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium leading-none">Fornecedores Cadastrados</h3>
            <div className="max-h-[300px] overflow-y-auto border rounded-md">
                {fornecedores.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhum fornecedor cadastrado.
                </div>
                ) : (
                <ul className="divide-y">
                    {fornecedores.map((item) => (
                    <li key={item.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                        <div className="flex flex-col gap-1">
                            <div className="font-medium">{item.nome}</div>
                            <div className="text-xs text-muted-foreground flex gap-2">
                                {item.cnpj && <span>CNPJ: {item.cnpj}</span>}
                                {item.cidade && <span>| {item.cidade}-{item.estado}</span>}
                            </div>
                        </div>
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
