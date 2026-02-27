"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, FileText, Gavel, Handshake, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { AppRouter } from "@/components/app-router"

export default function AlienacoesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [alienacoes, setAlienacoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    loadAlienacoes()
  }, [])

  async function loadAlienacoes() {
    try {
      setLoading(true)
      const data = await api.getAlienacoes()
      setAlienacoes(data)
    } catch (error) {
      toast({
        title: "Erro ao carregar alienações",
        description: "Não foi possível buscar os dados.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredAlienacoes = alienacoes.filter(
    (a) =>
      a.numero_processo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.destinatario_nome && a.destinatario_nome.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "aberto":
        return <Badge variant="secondary">Em Aberto</Badge>
      case "concluido":
        return <Badge className="bg-green-500 hover:bg-green-600">Concluído</Badge>
      case "cancelado":
        return <Badge variant="destructive">Cancelado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case "leilao":
        return <Gavel className="h-4 w-4 mr-2" />
      case "doacao":
        return <Handshake className="h-4 w-4 mr-2" />
      default:
        return <FileText className="h-4 w-4 mr-2" />
    }
  }

  return (
    <AppRouter>
      <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alienações</h1>
          <p className="text-muted-foreground">
            Gerencie processos de venda, leilão, doação e permuta de bens.
          </p>
        </div>
        <Button onClick={() => router.push("/alienacoes/nova")}>
          <Plus className="h-4 w-4 mr-2" /> Nova Alienação
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por processo ou destinatário..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Processos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredAlienacoes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum processo de alienação encontrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Processo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data Abertura</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlienacoes.map((alienacao) => (
                  <TableRow key={alienacao.id}>
                    <TableCell className="font-medium">{alienacao.numero_processo}</TableCell>
                    <TableCell>
                      <div className="flex items-center capitalize">
                        {getTipoIcon(alienacao.tipo)}
                        {alienacao.tipo}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(alienacao.data_abertura).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>{alienacao.total_itens_count || 0}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(alienacao.valor_total_avaliacao || 0)}
                    </TableCell>
                    <TableCell>{getStatusBadge(alienacao.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/alienacoes/${alienacao.id}`)}
                      >
                        Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </AppRouter>
  )
}
