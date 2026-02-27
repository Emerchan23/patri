"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Search,
  ArrowRightLeft,
  ArrowRight,
  Plus,
  MapPin,
  Calendar,
  User,
  Package,
  CheckCircle2,
  Loader2,
  ImageIcon,
} from "lucide-react"
import { formatDate } from "@/lib/data"
import { fetcher, api } from "@/lib/api-client"
import { useToast } from "@/components/ui/use-toast"

import { ResponsavelSelect } from "@/components/responsavel-select"

export function Movimentacoes() {
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [search, setSearch] = useState("")

  const queryParams = new URLSearchParams()
  queryParams.set("page", page.toString())
  queryParams.set("limit", limit.toString())
  if (search) queryParams.set("busca", search)

  const { data: result, mutate } = useSWR(["movimentacoes", queryParams.toString()], () => api.getMovimentacoes(queryParams.toString()))
  const movements = result?.data || []
  const meta = result?.meta || { total: 0, page: 1, limit: 20, totalPages: 1 }

  const { data: bensResult, isLoading: bensLoading } = useSWR("/bens?limit=1000", fetcher)
  const { data: secretariasData, isLoading: secretariasLoading } = useSWR("/secretarias", fetcher)

  const bens = bensResult?.data || []
  const secretarias = Array.isArray(secretariasData) ? secretariasData : (secretariasData?.data || [])

  const [newMovOpen, setNewMovOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Form state
  const [formAssetId, setFormAssetId] = useState("")
  const [formDestinoSec, setFormDestinoSec] = useState("")
  const [formDestinoDep, setFormDestinoDep] = useState("")
  const [formDestinoSala, setFormDestinoSala] = useState("")
  const [formResponsavel, setFormResponsavel] = useState("")
  const [formMotivo, setFormMotivo] = useState("")

  const selectedSec = secretarias.find((s: any) => s.nome === formDestinoSec)
  const deptos = selectedSec?.departamentos || []
  const selectedDep = deptos.find((d: any) => d.nome === formDestinoDep)
  const salas = selectedDep?.salas || []

  const handleSaveMov = async () => {
    // Validation
    const missingFields: string[] = []
    
    if (!formAssetId) missingFields.push("Bem Patrimonial")
    if (!formDestinoSec) missingFields.push("Secretaria de Destino")
    if (!formDestinoDep) missingFields.push("Departamento")
    if (!formDestinoSala) missingFields.push("Sala")
    if (!formResponsavel.trim()) missingFields.push("Responsável")
    if (!formMotivo.trim()) missingFields.push("Motivo")
    
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
      const asset = bens.find((b: any) => b.id === formAssetId)
      await api.createMovimentacao({
        assetId: formAssetId,
        assetDescricao: asset?.descricao || "",
        patrimonio: asset?.patrimonio || "",
        de: asset?.localizacao || {},
        para: { secretaria: formDestinoSec, departamento: formDestinoDep, sala: formDestinoSala },
        responsavel: formResponsavel,
        motivo: formMotivo,
      })
      
      toast({
        title: "Sucesso",
        description: "Movimentação registrada com sucesso!",
      })
      
      setSaved(true)
      await mutate()
      setTimeout(() => {
        setSaved(false)
        setNewMovOpen(false)
        setFormAssetId(""); setFormDestinoSec(""); setFormDestinoDep(""); setFormDestinoSala("")
        setFormResponsavel(""); setFormMotivo("")
      }, 1500)
    } catch (e) { 
      console.error(e) 
      toast({
        title: "Erro ao registrar",
        description: "Não foi possível registrar a movimentação. Tente novamente.",
        variant: "destructive",
      })
    }
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">Movimentacoes</h1>
          <p className="text-sm text-muted-foreground mt-1">Historico de transferencias de bens entre setores</p>
        </div>
        <Dialog open={newMovOpen} onOpenChange={setNewMovOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Nova Movimentacao</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Movimentacao</DialogTitle>
              <DialogDescription>
                Preencha os dados para registrar a movimentação do bem patrimonial.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-2">
                <Label required>Bem Patrimonial</Label>
                <SearchableSelect
                  value={formAssetId}
                  onValueChange={setFormAssetId}
                  items={bens.map((a: any) => ({
                    value: a.id,
                    label: `${a.patrimonio} - ${a.descricao}`,
                    searchTerms: `${a.patrimonio} ${a.descricao}`,
                  }))}
                  placeholder={bensLoading ? "Carregando..." : "Selecione o bem"}
                  searchPlaceholder="Buscar por nome ou patrimônio..."
                  disabled={bensLoading}
                />
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Destino</p>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <Label required>Secretaria de Destino</Label>
                    <Select value={formDestinoSec} onValueChange={(v) => { setFormDestinoSec(v); setFormDestinoDep(""); setFormDestinoSala(""); }} disabled={secretariasLoading}>
                      <SelectTrigger><SelectValue placeholder={secretariasLoading ? "Carregando..." : "Selecione"} /></SelectTrigger>
                      <SelectContent>{secretarias.map((s: any) => (<SelectItem key={s.nome} value={s.nome}>{s.nome}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <Label required>Departamento</Label>
                      <SearchableSelect
                        value={formDestinoDep}
                        onValueChange={(v) => {
                          setFormDestinoDep(v)
                          setFormDestinoSala("")
                        }}
                        items={deptos.map((d: any) => ({
                          value: d.nome,
                          label: d.nome,
                          searchTerms: d.nome,
                        }))}
                        placeholder="Selecione"
                        searchPlaceholder="Buscar departamento..."
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label required>Sala</Label>
                      <SearchableSelect
                        value={formDestinoSala}
                        onValueChange={setFormDestinoSala}
                        items={salas.map((s: any) => ({
                          value: s.nome,
                          label: s.nome,
                          searchTerms: s.nome,
                        }))}
                        placeholder="Selecione"
                        searchPlaceholder="Buscar sala..."
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label required>Responsavel pela Movimentacao</Label>
                <ResponsavelSelect 
                  value={formResponsavel} 
                  onValueChange={setFormResponsavel} 
                  placeholder="Selecione ou cadastre o responsável"
                />
              </div>
              <div className="flex flex-col gap-2"><Label required>Motivo</Label><Textarea placeholder="Descreva o motivo da transferencia..." className="min-h-20" value={formMotivo} onChange={(e) => setFormMotivo(e.target.value)} /></div>
              {saved && (<div className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" />Movimentacao registrada com sucesso!</div>)}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setNewMovOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveMov} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                  Registrar Movimentacao
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar movimentacoes..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <div className="flex flex-col gap-4">
        {movements.map((mov: any) => (
          <Card key={mov.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col lg:flex-row">
                <div className="flex items-center gap-4 border-b border-border p-4 lg:w-72 lg:border-b-0 lg:border-r">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-muted overflow-hidden">
                    {mov.assetImagem ? (
                      <img 
                        src={mov.assetImagem} 
                        alt={mov.assetDescricao}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{mov.assetDescricao}</p>
                    <p className="text-xs font-mono text-muted-foreground">{mov.patrimonio}</p>
                  </div>
                </div>
                <div className="flex-1 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex-1 rounded-lg bg-destructive/5 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive mb-1">Origem</p>
                      <p className="text-sm font-medium">{mov.de?.departamento}</p>
                      <p className="text-xs text-muted-foreground">{mov.de?.sala}</p>
                      <p className="text-xs text-muted-foreground truncate">{mov.de?.secretaria}</p>
                    </div>
                    <div className="flex items-center justify-center shrink-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10"><ArrowRight className="h-4 w-4 text-primary" /></div>
                    </div>
                    <div className="flex-1 rounded-lg bg-success/5 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-success mb-1">Destino</p>
                      <p className="text-sm font-medium">{mov.para?.departamento}</p>
                      <p className="text-xs text-muted-foreground">{mov.para?.sala}</p>
                      <p className="text-xs text-muted-foreground truncate">{mov.para?.secretaria}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{mov.responsavel}</div>
                    <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{formatDate(mov.data)}</div>
                    <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{mov.motivo}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {movements.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma movimentacao encontrada.</CardContent></Card>
        )}
      </div>

      {meta.totalPages > 1 && (
        <div className="flex justify-center mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => {
                 // Show first, last, current, and surrounding pages
                 if (
                   p === 1 ||
                   p === meta.totalPages ||
                   (p >= page - 1 && p <= page + 1)
                 ) {
                   return (
                     <PaginationItem key={p}>
                       <PaginationLink
                         isActive={page === p}
                         onClick={() => setPage(p)}
                         className="cursor-pointer"
                       >
                         {p}
                       </PaginationLink>
                     </PaginationItem>
                   )
                 }
                 
                 // Show ellipsis
                 if (
                   (p === page - 2 && p > 1) ||
                   (p === page + 2 && p < meta.totalPages)
                 ) {
                   return (
                     <PaginationItem key={p}>
                       <PaginationEllipsis />
                     </PaginationItem>
                   )
                 }
                 
                 return null
              })}

              <PaginationItem>
                <PaginationNext 
                  onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                  className={page === meta.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
