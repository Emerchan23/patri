"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, CheckCircle, Printer, Plus, Trash2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { gerarTermoAlienacao } from "@/lib/pdf-generator"
import { AppRouter } from "@/components/app-router"
import { useAuth } from "@/lib/auth-context"

export default function AlienacaoDetalhesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const [alienacao, setAlienacao] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("detalhes")
  const [concluirDialogOpen, setConcluirDialogOpen] = useState(false)
  const [concluirData, setConcluirData] = useState({
    destinatario_nome: "",
    destinatario_documento: "",
    destinatario_endereco: "",
    observacoes: ""
  })

  useEffect(() => {
    loadAlienacao()
  }, [id])

  async function loadAlienacao() {
    try {
      setLoading(true)
      const data = await api.getAlienacao(id)
      setAlienacao(data)
      setConcluirData({
        destinatario_nome: data.destinatario_nome || "",
        destinatario_documento: data.destinatario_documento || "",
        destinatario_endereco: data.destinatario_endereco || "",
        observacoes: data.observacoes || ""
      })
    } catch (error) {
      toast({
        title: "Erro ao carregar alienação",
        description: "Não foi possível buscar os detalhes.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleConcluir() {
    try {
      await api.updateAlienacao(alienacao.id, {
        ...concluirData,
        concluir: true
      })
      toast({
        title: "Alienação concluída!",
        description: "Os bens foram baixados e o processo finalizado.",
        className: "bg-green-500 text-white"
      })
      setConcluirDialogOpen(false)
      loadAlienacao()
    } catch (error) {
      toast({
        title: "Erro ao concluir",
        description: "Verifique se todos os campos estão preenchidos.",
        variant: "destructive",
      })
    }
  }

  async function handleRemoverItem(bemId: number) {
    if (!confirm("Tem certeza que deseja remover este bem da alienação?")) return
    try {
      await api.removeAlienacaoItem(alienacao.id, bemId)
      toast({ title: "Item removido" })
      loadAlienacao()
    } catch (error) {
      toast({ title: "Erro ao remover item", variant: "destructive" })
    }
  }

  const handleImprimirTermo = () => {
    if (!alienacao) return
    gerarTermoAlienacao(alienacao)
  }

  if (loading) return <div className="p-8 text-center">Carregando detalhes...</div>
  if (!alienacao) return <div className="p-8 text-center">Alienação não encontrada</div>

  return (
    <AppRouter>
      <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.push("/alienacoes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Processo #{alienacao.numero_processo}
            {alienacao.status === "concluido" ? (
              <Badge className="bg-green-500">Concluído</Badge>
            ) : (
              <Badge variant="secondary">Em Aberto</Badge>
            )}
          </h1>
          <p className="text-muted-foreground capitalize">
            Tipo: {alienacao.tipo} • Aberto em {new Date(alienacao.data_abertura).toLocaleDateString()}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
            {alienacao.status !== "concluido" && (user?.role === 'administrador' || user?.role === 'gestor') && (
                <Dialog open={concluirDialogOpen} onOpenChange={setConcluirDialogOpen}>
                <DialogTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="mr-2 h-4 w-4" /> Concluir Processo
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                    <DialogTitle>Concluir Alienação</DialogTitle>
                    <DialogDescription>
                        Esta ação irá baixar todos os bens vinculados e encerrar o processo.
                        Preencha os dados finais do destinatário.
                    </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                        <Label>Nome do Destinatário / Comprador</Label>
                        <Input 
                            value={concluirData.destinatario_nome} 
                            onChange={(e) => setConcluirData({...concluirData, destinatario_nome: e.target.value})}
                        />
                        </div>
                        <div className="space-y-2">
                        <Label>CPF / CNPJ</Label>
                        <Input 
                            value={concluirData.destinatario_documento} 
                            onChange={(e) => setConcluirData({...concluirData, destinatario_documento: e.target.value})}
                        />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Endereço Completo</Label>
                        <Input 
                            value={concluirData.destinatario_endereco} 
                            onChange={(e) => setConcluirData({...concluirData, destinatario_endereco: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Observações Finais / Termo de Encerramento</Label>
                        <Textarea 
                            value={concluirData.observacoes} 
                            onChange={(e) => setConcluirData({...concluirData, observacoes: e.target.value})}
                        />
                    </div>
                    </div>
                    <DialogFooter>
                    <Button variant="outline" onClick={() => setConcluirDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleConcluir}>Confirmar Baixa e Encerramento</Button>
                    </DialogFooter>
                </DialogContent>
                </Dialog>
            )}
          <Button variant="outline" onClick={handleImprimirTermo}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir Termo
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
          <TabsTrigger value="itens">Itens ({alienacao.itens?.length || 0})</TabsTrigger>
          <TabsTrigger value="comissao">Comissão ({alienacao.comissao?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="detalhes">
          <Card>
            <CardHeader>
              <CardTitle>Informações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-muted-foreground">Número do Processo</Label>
                <p className="font-medium text-lg">{alienacao.numero_processo}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Modalidade</Label>
                <p className="font-medium text-lg capitalize">{alienacao.tipo}</p>
              </div>
              {alienacao.numero_edital && (
                <div>
                  <Label className="text-muted-foreground">Número do Edital</Label>
                  <p className="font-medium">{alienacao.numero_edital}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Data de Abertura</Label>
                <p className="font-medium">{new Date(alienacao.data_abertura).toLocaleDateString()}</p>
              </div>
              {alienacao.data_conclusao && (
                <div>
                  <Label className="text-muted-foreground">Data de Conclusão</Label>
                  <p className="font-medium">{new Date(alienacao.data_conclusao).toLocaleDateString()}</p>
                </div>
              )}
              <div className="col-span-2">
                <Label className="text-muted-foreground">Observações</Label>
                <p className="text-sm mt-1 bg-muted p-3 rounded-md">{alienacao.observacoes || "Sem observações."}</p>
              </div>
              
              <Separator className="col-span-2 my-4" />
              
              <div className="col-span-2">
                <h3 className="font-semibold mb-4">Dados do Destinatário</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Nome</Label>
                    <p>{alienacao.destinatario_nome || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Documento</Label>
                    <p>{alienacao.destinatario_documento || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Endereço</Label>
                    <p>{alienacao.destinatario_endereco || "-"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="itens">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Bens Alienados</CardTitle>
                <CardDescription>
                  Valor Total Avaliado: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(alienacao.valor_total_avaliacao)}
                </CardDescription>
              </div>
              {alienacao.status !== 'concluido' && (
                  <Button size="sm" variant="outline">
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Item
                  </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patrimônio</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor Contábil</TableHead>
                    <TableHead>Valor Avaliação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alienacao.itens?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.patrimonio}</TableCell>
                      <TableCell>{item.descricao}</TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.valor_contabil)}
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.valor_avaliacao)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.status_item}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {alienacao.status !== 'concluido' && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemoverItem(item.bem_id)}
                            >
                            <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comissao">
          <Card>
            <CardHeader>
              <CardTitle>Membros da Comissão</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Função</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alienacao.comissao?.map((membro: any) => (
                    <TableRow key={membro.id}>
                      <TableCell>{membro.nome}</TableCell>
                      <TableCell>{membro.cargo}</TableCell>
                      <TableCell className="capitalize">{membro.tipo_membro}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </AppRouter>
  )
}
