"use client"

import {
  Package,
  CheckCircle2,
  Clock,
  Tag,
  AlertTriangle,
  ScanBarcode,
  Building2,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  getStatusColor,
  getStatusLabel,
  getCategoryLabel,
  getEtiquetaStatusColor,
  getEtiquetaStatusLabel,
} from "@/lib/data"
import { useAuth } from "@/lib/auth-context"
import useSWR from "swr"
import { api } from "@/lib/api-client"
import { useToast } from "@/components/ui/use-toast"
import { useState } from "react"

export function DashboardAssistente() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [confirmingId, setConfirmingId] = useState<string | number | null>(null)

  // Fetch assets for this user's unit
  const assetsQuery = new URLSearchParams()
  const assistantDepartments = user?.unidade?.departamentos?.length
    ? user.unidade.departamentos
    : user?.unidade?.departamento
      ? [user.unidade.departamento]
      : []
  if (user?.unidade?.secretaria) assetsQuery.set("secretaria", user.unidade.secretaria)
  
  // Only fetch if we have unit info
  const shouldFetch = !!user?.unidade?.secretaria
  
  const { data: result, isLoading, mutate } = useSWR(
    shouldFetch ? ["bens-unidade", assetsQuery.toString()] : null,
    () => api.getBens(assetsQuery.toString())
  )
  
  const unitAssets: any[] = result?.data || []

  const stats = {
    total: unitAssets.length,
    ativos: unitAssets.filter((a) => a.status === "ativo").length,
    provisorios: unitAssets.filter((a) => a.patrimonioTipo === "provisorio").length,
    emManutencao: unitAssets.filter((a) => a.status === "em_manutencao").length,
  }

  const pendentesEtiqueta = unitAssets.filter((a) => a.etiquetaStatus === "enviada")
  const canAccessCadastroProvisorio = Boolean(user?.permissions?.acessarCadastrosProvisorios)
  const canAccessCadastroBem = Boolean(user?.permissions?.cadastrarBem)

  const handleConfirmarColagem = async (asset: any) => {
    setConfirmingId(asset.id)
    try {
        await api.updateBemEtiquetaFluxo(asset.id, "confirmar_colada")
        
        toast({
            title: "Sucesso",
            description: "Colagem confirmada com sucesso!",
        })
        
        mutate() // Refresh list
    } catch (error) {
        console.error(error)
        toast({
            title: "Erro",
            description: "Erro ao confirmar colagem.",
            variant: "destructive"
        })
    } finally {
        setConfirmingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-balance">
          Minha Unidade
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {user?.unidade?.secretaria} - {assistantDepartments.join(", ")}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bens na Unidade</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ativos</p>
              <p className="text-2xl font-bold">{stats.ativos}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Provisorios</p>
              <p className="text-2xl font-bold">{stats.provisorios}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Em Manutencao</p>
              <p className="text-2xl font-bold">{stats.emManutencao}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending labels alert */}
      {pendentesEtiqueta.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-warning" />
              <CardTitle className="text-base">Etiquetas Pendentes</CardTitle>
            </div>
            <CardDescription>
              Estes bens ja tiveram a etiqueta enviada pelo gestor. Depois de colar no equipamento,
              confirme aqui para que o restante da equipe acompanhe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {pendentesEtiqueta.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-3 rounded-lg border border-warning/30 bg-card p-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/10">
                    <Tag className="h-4 w-4 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{asset.descricao}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant="outline"
                        className="text-[10px] border-warning/50 text-warning font-mono"
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {asset.patrimonio || asset.patrimonioProvisorio}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {asset.localizacao.sala}
                      </span>
                      <Badge variant="outline" className={`text-[10px] ${getEtiquetaStatusColor(asset.etiquetaStatus)}`}>
                        {getEtiquetaStatusLabel(asset.etiquetaStatus)}
                      </Badge>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="gap-1.5 text-xs shrink-0 bg-transparent hover:bg-warning/10"
                    onClick={() => handleConfirmarColagem(asset)}
                    disabled={confirmingId === asset.id}
                  >
                    {confirmingId === asset.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Confirmar Colagem
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className={`grid grid-cols-1 gap-4 ${canAccessCadastroProvisorio || canAccessCadastroBem ? "sm:grid-cols-2" : ""}`}>
        <Link href="/scanner">
          <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <ScanBarcode className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Escanear Patrimonio</p>
                <p className="text-xs text-muted-foreground">
                  Use a camera para verificar um bem
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        {(canAccessCadastroProvisorio || canAccessCadastroBem) && (
          <Link href={canAccessCadastroProvisorio ? "/cadastros-provisorios" : "/cadastro"}>
            <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                  <Package className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {canAccessCadastroProvisorio ? "Cadastro Provisório da Unidade" : "Cadastrar Novo Bem"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {canAccessCadastroProvisorio
                      ? "Registrar itens da unidade para revisão do patrimônio"
                      : "Registrar um equipamento na unidade"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* Unit assets list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bens da Minha Unidade</CardTitle>
          <CardDescription>
            {unitAssets.length} bens registrados em {assistantDepartments.join(", ")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unitAssets.length > 0 ? (
            <div className="flex flex-col gap-3">
              {unitAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{asset.descricao}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {asset.patrimonioTipo === "provisorio" ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-warning/50 text-warning font-mono"
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          {asset.patrimonio}
                        </Badge>
                      ) : (
                        <span className="text-xs font-mono text-muted-foreground">
                          {asset.patrimonio}
                        </span>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {getCategoryLabel(asset.categoria)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge className={`text-[10px] ${getStatusColor(asset.status)}`}>
                      {getStatusLabel(asset.status)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{asset.localizacao.sala}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-sm text-muted-foreground">
              Nenhum bem registrado nesta unidade.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
