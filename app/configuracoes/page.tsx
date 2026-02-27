"use client"

import { AppRouter } from "@/components/app-router"
import { ConfiguracoesPdf } from "@/components/configuracoes-pdf"
import { ConfiguracoesSistema } from "@/components/configuracoes-sistema"
import { ConfiguracoesIntegracao } from "@/components/configuracoes-integracao"
import { ConfiguracoesBackup } from "@/components/configuracoes-backup"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ConfiguracoesPage() {
  return (
    <AppRouter requiredPermission="gerenciarUsuarios">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuracoes</h1>
          <p className="text-muted-foreground">
            Gerencie as preferencias do sistema e documentos
          </p>
        </div>

        <Tabs defaultValue="sistema" className="w-full">
          <TabsList>
            <TabsTrigger value="sistema">Sistema & Aparencia</TabsTrigger>
            <TabsTrigger value="pdf">Documentos PDF</TabsTrigger>
            <TabsTrigger value="integracao">Integrações API</TabsTrigger>
            <TabsTrigger value="backup">Backup & Restauração</TabsTrigger>
          </TabsList>
          <TabsContent value="sistema" className="mt-6">
            <ConfiguracoesSistema />
          </TabsContent>
          <TabsContent value="pdf" className="mt-6">
            <ConfiguracoesPdf />
          </TabsContent>
          <TabsContent value="integracao" className="mt-6">
            <ConfiguracoesIntegracao />
          </TabsContent>
          <TabsContent value="backup" className="mt-6">
            <ConfiguracoesBackup />
          </TabsContent>
        </Tabs>
      </div>
    </AppRouter>
  )
}
