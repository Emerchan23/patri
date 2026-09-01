"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, ArrowRight, Check, Search, Trash2, UserPlus, Plus, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { ServidorSelect } from "@/components/servidor-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AppRouter } from "@/components/app-router"

// Tipos
type AlienacaoForm = {
  tipo: string
  numero_processo: string
  numero_edital: string
  data_abertura: string
  observacoes: string
  comissao: Array<{ nome: string; cargo: string; cpf: string; tipo_membro: string }>
  bens: number[] // IDs dos bens
}

export default function NovaAlienacaoPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<string[]>([])
  
  // Estado do Formulario
  const [formData, setFormData] = useState<AlienacaoForm>({
    tipo: "leilao",
    numero_processo: "",
    numero_edital: "",
    data_abertura: new Date().toISOString().split('T')[0],
    observacoes: "",
    comissao: [
      { nome: "", cargo: "", cpf: "", tipo_membro: "presidente" },
      { nome: "", cargo: "", cpf: "", tipo_membro: "membro" },
      { nome: "", cargo: "", cpf: "", tipo_membro: "secretario" }
    ],
    bens: []
  })

  // Estado para busca de bens
  const [bensDisponiveis, setBensDisponiveis] = useState<any[]>([])
  const [bensSelecionadosDetalhes, setBensSelecionadosDetalhes] = useState<any[]>([])
  const [buscaBem, setBuscaBem] = useState("")

  useEffect(() => {
    if (step === 3) {
      loadBens()
    }
  }, [step])

  async function loadBens() {
    try {
      // Buscar bens ativos
      const response = await api.getBens("status=ativo")
      setBensDisponiveis(response.data || [])
    } catch (error) {
      console.error(error)
      toast({ title: "Erro ao buscar bens", variant: "destructive" })
    }
  }

  const handleNext = () => {
    const newFieldErrors: string[] = []

    if (step === 1) {
      if (!formData.numero_processo) newFieldErrors.push("numero_processo")
      if (!formData.data_abertura) newFieldErrors.push("data_abertura")
      
      if (newFieldErrors.length > 0) {
        setFieldErrors(newFieldErrors)
        toast({ title: "Preencha os campos obrigatórios", variant: "destructive" })
        return
      }
    }
    if (step === 2) {
      // Validate each member
      formData.comissao.forEach((m, i) => {
          if (!m.nome) newFieldErrors.push(`comissao-${i}-nome`)
          if (!m.cargo) newFieldErrors.push(`comissao-${i}-cargo`)
      })

      const membrosValidos = formData.comissao.filter(m => m.nome && m.cargo)
      if (membrosValidos.length < 3) {
        setFieldErrors(newFieldErrors)
        toast({ title: "A comissão deve ter no mínimo 3 membros identificados", variant: "destructive" })
        return
      }
    }
    if (step === 3) {
      if (formData.bens.length === 0) {
        toast({ title: "Selecione pelo menos um bem", variant: "destructive" })
        return
      }
    }
    setFieldErrors([])
    setStep(step + 1)
  }

  const handleBack = () => setStep(step - 1)

  const handleSubmit = async () => {
    try {
      setLoading(true)
      const membrosValidos = formData.comissao.filter(m => m.nome && m.cargo)
      
      const payload = {
        ...formData,
        comissao: membrosValidos
      }

      await api.createAlienacao(payload)
      
      toast({
        title: "Alienação criada com sucesso!",
        className: "bg-green-500 text-white"
      })
      
      router.push("/alienacoes")
    } catch (error) {
      toast({
        title: "Erro ao criar alienação",
        description: "Verifique os dados e tente novamente.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Renderizadores de Etapas
  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Alienação</Label>
          <Select 
            value={formData.tipo} 
            onValueChange={(val) => setFormData({...formData, tipo: val})}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="leilao">Leilão</SelectItem>
              <SelectItem value="venda">Venda Direta</SelectItem>
              <SelectItem value="doacao">Doação</SelectItem>
              <SelectItem value="permuta">Permuta</SelectItem>
              <SelectItem value="descarte">Descarte / Inservível</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label required className={fieldErrors.includes("data_abertura") ? "text-destructive" : ""}>Data de Abertura</Label>
          <Input 
            type="date" 
            value={formData.data_abertura}
            onChange={(e) => {
                setFormData({...formData, data_abertura: e.target.value})
                if (fieldErrors.includes("data_abertura")) setFieldErrors(prev => prev.filter(e => e !== "data_abertura"))
            }}
            className={fieldErrors.includes("data_abertura") ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label required className={fieldErrors.includes("numero_processo") ? "text-destructive" : ""}>Número do Processo Administrativo</Label>
          <Input 
            placeholder="Ex: 2024/00123"
            value={formData.numero_processo}
            onChange={(e) => {
                setFormData({...formData, numero_processo: e.target.value})
                if (fieldErrors.includes("numero_processo")) setFieldErrors(prev => prev.filter(e => e !== "numero_processo"))
            }}
            className={fieldErrors.includes("numero_processo") ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label>Número do Edital (Opcional)</Label>
          <Input 
            placeholder="Ex: 05/2024"
            value={formData.numero_edital}
            onChange={(e) => setFormData({...formData, numero_edital: e.target.value})}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observações Iniciais</Label>
        <Textarea 
          placeholder="Descreva o objetivo desta alienação..."
          value={formData.observacoes}
          onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
        />
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-md text-blue-800 text-sm mb-4">
        A comissão de avaliação deve ser composta por no mínimo 3 servidores efetivos.
      </div>
      
      {formData.comissao.map((membro, index) => (
        <Card key={index} className="p-4 relative group">
          {index > 2 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Remover Membro"
              onClick={() => {
                const newComissao = formData.comissao.filter((_, i) => i !== index)
                setFormData({...formData, comissao: newComissao})
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            Membro {index + 1} - {membro.tipo_membro}
          </h4>
          
          <div className="mb-4 bg-slate-50 p-3 rounded-md border border-slate-100">
            <Label className="mb-2 block text-xs font-medium text-muted-foreground uppercase">Buscar Profissional Cadastrado</Label>
            <ServidorSelect 
              onSelect={(servidor) => {
                const newComissao = [...formData.comissao]
                newComissao[index].nome = servidor.nome
                newComissao[index].cargo = servidor.cargo
                newComissao[index].cpf = servidor.cpf || ""
                setFormData({...formData, comissao: newComissao})
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className={fieldErrors.includes(`comissao-${index}-nome`) ? "text-destructive" : ""}>Nome Completo <span className="text-red-500">*</span></Label>
              <Input 
                value={membro.nome}
                onChange={(e) => {
                  const newComissao = [...formData.comissao]
                  newComissao[index].nome = e.target.value
                  setFormData({...formData, comissao: newComissao})
                  if (fieldErrors.includes(`comissao-${index}-nome`)) setFieldErrors(prev => prev.filter(e => e !== `comissao-${index}-nome`))
                }}
                className={fieldErrors.includes(`comissao-${index}-nome`) ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label className={fieldErrors.includes(`comissao-${index}-cargo`) ? "text-destructive" : ""}>Cargo <span className="text-red-500">*</span></Label>
              <Input 
                value={membro.cargo}
                onChange={(e) => {
                  const newComissao = [...formData.comissao]
                  newComissao[index].cargo = e.target.value
                  setFormData({...formData, comissao: newComissao})
                  if (fieldErrors.includes(`comissao-${index}-cargo`)) setFieldErrors(prev => prev.filter(e => e !== `comissao-${index}-cargo`))
                }}
                className={fieldErrors.includes(`comissao-${index}-cargo`) ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label>CPF (Opcional)</Label>
              <Input 
                value={membro.cpf}
                onChange={(e) => {
                  const newComissao = [...formData.comissao]
                  newComissao[index].cpf = e.target.value
                  setFormData({...formData, comissao: newComissao})
                }}
              />
            </div>
          </div>
        </Card>
      ))}
      
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => setFormData({
          ...formData, 
          comissao: [...formData.comissao, { nome: "", cargo: "", cpf: "", tipo_membro: "membro" }]
        })}
      >
        <UserPlus className="mr-2 h-4 w-4" /> Adicionar Membro
      </Button>
    </div>
  )

  const renderStep3 = () => {
    const filteredBens = bensDisponiveis.filter(b => 
      !formData.bens.includes(b.id) &&
      (b.descricao.toLowerCase().includes(buscaBem.toLowerCase()) || 
       b.patrimonio.toLowerCase().includes(buscaBem.toLowerCase()))
    ).slice(0, 10) // Limitar exibicao

    return (
      <div className="space-y-6">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar bens por nome ou patrimônio..." 
              className="pl-8"
              value={buscaBem}
              onChange={(e) => setBuscaBem(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Card className="h-[400px] flex flex-col">
            <CardHeader className="py-3">
              <CardTitle className="text-base">Bens Disponíveis</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <Table>
                <TableBody>
                  {filteredBens.map(bem => (
                    <TableRow key={bem.id}>
                      <TableCell className="py-2">
                        <div>
                          <p className="font-medium text-sm">{bem.descricao}</p>
                          <span className="text-xs text-muted-foreground">{bem.patrimonio}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => {
                            setFormData({
                              ...formData, 
                              bens: [...formData.bens, bem.id]
                            })
                            setBensSelecionadosDetalhes([...bensSelecionadosDetalhes, bem])
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredBens.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                        Nenhum bem encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="h-[400px] flex flex-col border-blue-200 bg-blue-50/30">
            <CardHeader className="py-3">
              <CardTitle className="text-base">Selecionados ({formData.bens.length})</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <Table>
                <TableBody>
                  {bensSelecionadosDetalhes.map(bem => (
                    <TableRow key={bem.id}>
                      <TableCell className="py-2">
                        <div>
                          <p className="font-medium text-sm">{bem.descricao}</p>
                          <span className="text-xs text-muted-foreground">{bem.patrimonio}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setFormData({
                              ...formData, 
                              bens: formData.bens.filter(id => id !== bem.id)
                            })
                            setBensSelecionadosDetalhes(bensSelecionadosDetalhes.filter(b => b.id !== bem.id))
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const renderStep4 = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Resumo da Alienação</CardTitle>
          <CardDescription>Verifique os dados antes de finalizar a abertura do processo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold text-muted-foreground block">Tipo:</span>
              <span className="capitalize">{formData.tipo}</span>
            </div>
            <div>
              <span className="font-semibold text-muted-foreground block">Processo:</span>
              <span>{formData.numero_processo}</span>
            </div>
            <div>
              <span className="font-semibold text-muted-foreground block">Data:</span>
              <span>{new Date(formData.data_abertura).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="font-semibold text-muted-foreground block">Itens:</span>
              <span>{formData.bens.length} bens selecionados</span>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <h4 className="font-semibold mb-2">Comissão de Avaliação</h4>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {formData.comissao.filter(m => m.nome).map((m, i) => (
                <li key={i}>{m.nome} ({m.cargo}) - {m.tipo_membro}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <AppRouter>
      <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Nova Alienação</h1>
        <p className="text-muted-foreground">Assistente de abertura de processo de alienação</p>
      </div>

      {/* Stepper Simplificado */}
      <div className="flex justify-between mb-8 relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -z-10" />
        {[1, 2, 3, 4].map((s) => (
          <div 
            key={s} 
            className={`flex flex-col items-center bg-white px-2 ${step >= s ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2 transition-colors
              ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-500'}
            `}>
              {step > s ? <Check className="h-4 w-4" /> : s}
            </div>
            <span className="text-xs font-medium uppercase">
              {s === 1 && "Dados"}
              {s === 2 && "Comissão"}
              {s === 3 && "Bens"}
              {s === 4 && "Revisão"}
            </span>
          </div>
        ))}
      </div>

      <div className="min-h-[400px]">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>

      <div className="flex justify-between mt-8 pt-4 border-t">
        <Button 
          variant="outline" 
          onClick={step === 1 ? () => router.push("/alienacoes") : handleBack}
        >
          {step === 1 ? "Cancelar" : "Voltar"}
        </Button>
        
        {step < 4 ? (
          <Button onClick={handleNext}>
            Próximo <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? "Criando..." : "Finalizar Abertura"} <Check className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
    </AppRouter>
  )
}

function Separator({ className }: { className?: string }) {
  return <div className={`h-[1px] w-full bg-border ${className}`} />
}
