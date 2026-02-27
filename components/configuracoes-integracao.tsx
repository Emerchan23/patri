"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Trash2, Key, Copy, CheckCircle2, Plus, Eye, EyeOff } from "lucide-react"
import { api, fetcher } from "@/lib/api-client"
import useSWR from "swr"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface ApiKey {
  id: number
  nome: string
  chave: string
  ativo: number
  criado_em: string
}

export function ConfiguracoesIntegracao() {
  const { data: keys, mutate } = useSWR<ApiKey[]>("/api/chaves", fetcher)
  const [isCreating, setIsCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Set<number>>(new Set())

  const toggleKeyVisibility = (id: number) => {
    const newVisibleKeys = new Set(visibleKeys)
    if (newVisibleKeys.has(id)) {
      newVisibleKeys.delete(id)
    } else {
      newVisibleKeys.add(id)
    }
    setVisibleKeys(newVisibleKeys)
  }

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error("O nome da chave é obrigatório")
      return
    }

    setIsCreating(true)
    try {
      await api.post("/api/chaves", { nome: newKeyName })
      await mutate()
      toast.success("Chave de API criada com sucesso")
      setNewKeyName("")
      setIsDialogOpen(false)
    } catch (error) {
      console.error("Erro ao criar chave:", error)
      toast.error("Erro ao criar chave de API")
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteKey = async (id: number) => {
    if (!confirm("Tem certeza que deseja revogar esta chave? O sistema conectado perderá o acesso imediatamente.")) {
      return
    }

    try {
      await api.delete(`/api/chaves/${id}`)
      await mutate()
      toast.success("Chave revogada com sucesso")
    } catch (error) {
      console.error("Erro ao excluir chave:", error)
      toast.error("Erro ao revogar chave")
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(text)
    toast.success("Chave copiada para a área de transferência")
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">
            Integrações e API
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie as chaves de acesso para sistemas externos (ex: Manutenção)
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Chave de API
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Chave de API</DialogTitle>
              <DialogDescription>
                Esta chave permitirá que um sistema externo atualize o status dos bens.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome do Sistema</Label>
                <Input
                  id="name"
                  placeholder="Ex: Sistema de Manutenção"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateKey} disabled={isCreating}>
                {isCreating ? "Criando..." : "Gerar Chave"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Key className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm">Chaves de Acesso Ativas</CardTitle>
              <CardDescription className="text-xs">
                Lista de sistemas autorizados a interagir com o Patrimônio
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!keys || keys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhuma chave de API configurada. Crie uma para começar a integração.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Sistema</TableHead>
                  <TableHead>Chave de Acesso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.nome}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm max-w-[250px] overflow-hidden text-ellipsis whitespace-nowrap">
                          {visibleKeys.has(key.id) 
                            ? key.chave 
                            : `${key.chave.substring(0, 10)}...${key.chave.substring(key.chave.length - 5)}`}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleKeyVisibility(key.id)}
                          title={visibleKeys.has(key.id) ? "Ocultar chave" : "Mostrar chave"}
                        >
                          {visibleKeys.has(key.id) ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(key.chave)}
                          title="Copiar chave"
                        >
                          {copiedKey === key.chave ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={key.ativo ? "default" : "secondary"}>
                        {key.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(key.criado_em).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteKey(key.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Documentação Rápida</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Para integrar, configure o sistema externo com a URL deste sistema e uma das chaves acima.</p>
          <div className="bg-muted p-3 rounded-md font-mono text-xs">
            POST /api/integracao/manutencao<br />
            Headers: x-api-key: SEU_TOKEN_AQUI<br />
            Body: &#123; "numeroPatrimonio": "123", "numeroOS": "OS-001", "status": "em_manutencao" &#125;
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
