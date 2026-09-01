"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search, ImageIcon, Loader2 } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
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
import { api } from "@/lib/api-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

interface AssetSearchSelectorProps {
  onSelect: (asset: any) => void
  placeholder?: string
  className?: string
  align?: "start" | "end" | "center"
}

export function AssetSearchSelector({
  onSelect,
  placeholder = "Buscar modelo existente...",
  className,
  align = "start"
}: AssetSearchSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const debouncedQuery = useDebounce(query, 300)
  const [assets, setAssets] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open) return

    const fetchAssets = async () => {
      setLoading(true)
      try {
        // Fetch only active assets to use as template
        const q = new URLSearchParams()
        if (debouncedQuery) q.set("busca", debouncedQuery)
        q.set("limit", "10")
        
        const res = await api.getBens(q.toString())
        if (res && res.data) {
          setAssets(res.data)
        }
      } catch (error) {
        console.error("Error fetching assets:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchAssets()
  }, [debouncedQuery, open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between ${className}`}
        >
          <span className="truncate text-muted-foreground font-normal">
            {placeholder}
          </span>
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align={align}>
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Digite nome, marca ou modelo..." 
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading && (
              <div className="py-6 text-center text-sm text-muted-foreground flex justify-center items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </div>
            )}
            
            {!loading && assets.length === 0 && (
              <CommandEmpty>Nenhum bem encontrado.</CommandEmpty>
            )}

            {!loading && assets.length > 0 && (
              <CommandGroup heading="Bens Cadastrados">
                {assets.map((asset) => (
                  <CommandItem
                    key={asset.id}
                    value={asset.id}
                    onSelect={() => {
                      onSelect(asset)
                      setOpen(false)
                    }}
                    className="flex items-center gap-3 p-2 cursor-pointer"
                  >
                    <div className="h-10 w-10 shrink-0 rounded-md border bg-muted flex items-center justify-center overflow-hidden">
                        {asset.imagem ? (
                          <img 
                            src={asset.imagem} 
                            alt={asset.descricao} 
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                        )}
                    </div>
                    
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-medium truncate">{asset.descricao}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {asset.marca && <span>{asset.marca} {asset.modelo}</span>}
                            {asset.marca && asset.categoria && <span>•</span>}
                            {asset.categoria && <Badge variant="outline" className="text-[10px] h-4 px-1">{asset.categoria}</Badge>}
                        </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
