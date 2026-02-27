
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { AlertTriangle, Download, Upload, Loader2, Database } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function ConfiguracoesBackup() {
  const { toast } = useToast()
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)

  const handleBackup = () => {
    // Trigger download
    window.open('/api/backup', '_blank');
    toast({
      title: "Backup Iniciado",
      description: "O download do arquivo SQL começará em instantes.",
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setRestoreFile(e.target.files[0])
    }
  }

  const handleRestore = async () => {
    if (!restoreFile) return

    setIsRestoring(true)
    const formData = new FormData()
    formData.append('file', restoreFile)

    try {
      const response = await fetch('/api/restore', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Banco de dados restaurado com sucesso!",
          variant: "default",
        })
        setRestoreFile(null)
        // Reset file input
        const fileInput = document.getElementById('restore-file') as HTMLInputElement
        if (fileInput) fileInput.value = ''
      } else {
        throw new Error(data.error || 'Erro desconhecido')
      }
    } catch (error) {
      console.error(error)
      toast({
        title: "Erro na Restauração",
        description: (error as Error).message,
        variant: "destructive",
      })
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle>Backup do Banco de Dados</CardTitle>
          </div>
          <CardDescription>
            Exporte uma cópia completa de todos os dados do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
            <div className="space-y-1">
              <p className="font-medium text-sm">Exportar SQL</p>
              <p className="text-xs text-muted-foreground">
                Gera um arquivo .sql com toda a estrutura e dados atuais.
              </p>
            </div>
            <Button onClick={handleBackup} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Baixar Backup
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/20">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <CardTitle>Restaurar Backup</CardTitle>
          </div>
          <CardDescription>
            Importe um arquivo .sql para substituir os dados atuais. Cuidado: isso apagará os dados existentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="restore-file">Arquivo de Backup (.sql)</Label>
            <Input 
              id="restore-file" 
              type="file" 
              accept=".sql" 
              onChange={handleFileChange}
              disabled={isRestoring}
            />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                disabled={!restoreFile || isRestoring}
                className="gap-2"
              >
                {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Restaurar Dados
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso substituirá permanentemente todos os dados atuais do sistema pelos dados do arquivo de backup selecionado.
                  Certifique-se de ter um backup recente dos dados atuais antes de prosseguir.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleRestore} className="bg-destructive hover:bg-destructive/90">
                  Sim, Restaurar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
