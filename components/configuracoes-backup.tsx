
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { AlertTriangle, Download, Upload, Loader2, Database, CalendarClock, History, RotateCcw } from "lucide-react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface BackupFile {
  name: string
  size: number
  created_at: string
}

export function ConfiguracoesBackup() {
  const { toast } = useToast()
  const [isRestoring, setIsRestoring] = useState(false)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  
  // Auto Backup State
  const [autoBackup, setAutoBackup] = useState({
    enabled: false,
    frequency: 'daily',
    time: '00:00',
    keep_count: 7
  })
  const [isSavingAuto, setIsSavingAuto] = useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [backupList, setBackupList] = useState<BackupFile[]>([])
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null)

  const fetchBackups = () => {
    fetch('/api/configuracoes/backup/list')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBackupList(data)
        }
      })
      .catch(err => console.error("Erro ao listar backups:", err))
  }

  useEffect(() => {
    fetch('/api/configuracoes/backup')
      .then(res => res.json())
      .then(data => {
        setAutoBackup(data)
        setIsLoadingSettings(false)
      })
      .catch(err => {
        console.error(err)
        setIsLoadingSettings(false)
      })
      
    fetchBackups()
  }, [])

  const handleSaveAutoBackup = async () => {
    setIsSavingAuto(true)
    try {
      const res = await fetch('/api/configuracoes/backup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoBackup)
      })
      
      if (!res.ok) throw new Error('Falha ao salvar')
      
      toast({
        title: "Configurações Salvas",
        description: "O agendamento de backup foi atualizado.",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive"
      })
    } finally {
      setIsSavingAuto(false)
    }
  }

  const handleBackup = async () => {
    setIsBackingUp(true)
    try {
      toast({
        title: "Iniciando Backup",
        description: "Aguarde enquanto o arquivo é gerado...",
      })

      // Show spinner or progress
      const { dismiss } = toast({
        title: "Gerando Backup Completo",
        description: "Isso pode levar alguns minutos. Por favor, aguarde...",
        duration: Infinity, // Keep until dismissed
      })

      const response = await fetch('/api/backup');
      
      dismiss(); // Remove progress toast

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao gerar backup');
      }

      // Get filename from header if available, or default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'backup-sispatrimonio.tar.gz'; // Default for full backup
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Sucesso",
        description: "Backup realizado com sucesso!",
        variant: "default",
      })
      
      // Refresh list
      fetchBackups()
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro no Backup",
        description: (error as Error).message,
        variant: "destructive",
      })
    } finally {
      setIsBackingUp(false)
    }
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
          title: "Restauração Concluída!",
          description: "O sistema foi restaurado com sucesso. A página será recarregada em 3 segundos.",
          variant: "default",
          duration: 5000,
        })
        setRestoreFile(null)
        // Reset file input
        const fileInput = document.getElementById('restore-file') as HTMLInputElement
        if (fileInput) fileInput.value = ''
        
        // Reload to update data
        setTimeout(() => {
            window.location.reload()
        }, 3000)
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

  const handleRestoreFromList = async (filename: string) => {
    setIsRestoring(true)
    try {
      const response = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Restauração Concluída!",
          description: "O sistema foi restaurado com sucesso. A página será recarregada em 3 segundos.",
          variant: "default",
          duration: 5000,
        })
        
        setTimeout(() => {
            window.location.reload()
        }, 3000)
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
      setSelectedBackup(null)
    }
  }

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle>Backup do Sistema</CardTitle>
          </div>
          <CardDescription>
            Exporte uma cópia completa de todos os dados (banco + arquivos).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
            <div className="space-y-1">
              <p className="font-medium text-sm">Exportar Backup Completo</p>
              <p className="text-xs text-muted-foreground">
                Gera um arquivo contendo SQL e uploads (imagens/PDFs).
              </p>
            </div>
            <Button 
              onClick={handleBackup} 
              variant="outline" 
              className="gap-2"
              disabled={isBackingUp}
            >
              {isBackingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isBackingUp ? "Gerando Backup..." : "Baixar Backup"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <CardTitle>Agendamento Automático</CardTitle>
          </div>
          <CardDescription>
            Configure backups automáticos periódicos para proteger seus dados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="auto-backup" className="flex flex-col space-y-1">
              <span>Ativar Backup Automático</span>
              <span className="font-normal text-xs text-muted-foreground">
                O sistema irá gerar backups automaticamente conforme a programação.
              </span>
            </Label>
            <Switch
              id="auto-backup"
              checked={autoBackup.enabled}
              onCheckedChange={(checked) => setAutoBackup(prev => ({ ...prev, enabled: checked }))}
            />
          </div>

          {autoBackup.enabled && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select 
                  value={autoBackup.frequency} 
                  onValueChange={(val) => setAutoBackup(prev => ({ ...prev, frequency: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal (Segunda)</SelectItem>
                    <SelectItem value="monthly">Mensal (Dia 1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input 
                  type="time" 
                  value={autoBackup.time} 
                  onChange={(e) => setAutoBackup(prev => ({ ...prev, time: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Manter últimos (arquivos)</Label>
                <Input 
                  type="number" 
                  min={1}
                  max={30}
                  value={autoBackup.keep_count} 
                  onChange={(e) => setAutoBackup(prev => ({ ...prev, keep_count: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>
          )}

          <Button 
            onClick={handleSaveAutoBackup} 
            disabled={isSavingAuto || isLoadingSettings}
          >
            {isSavingAuto && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <CardTitle>Backups Automáticos Armazenados</CardTitle>
          </div>
          <CardDescription>
            Lista dos últimos backups gerados automaticamente. Você pode restaurar qualquer um deles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backupList.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Nenhum backup automático encontrado.
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backupList.map((file) => (
                    <TableRow key={file.name}>
                      <TableCell className="font-medium">{file.name}</TableCell>
                      <TableCell>{new Date(file.created_at).toLocaleString()}</TableCell>
                      <TableCell>{formatBytes(file.size)}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setSelectedBackup(file.name)}
                            >
                              <RotateCcw className="h-4 w-4 text-muted-foreground hover:text-primary" />
                              <span className="sr-only">Restaurar</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Restaurar este backup?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Você está prestes a restaurar o backup <strong>{file.name}</strong>.
                                <br/>
                                Isso substituirá todos os dados atuais pelos dados deste backup.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setSelectedBackup(null)}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleRestoreFromList(file.name)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Restaurar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
            <Label htmlFor="restore-file">Arquivo de Backup (.sql, .tar.gz)</Label>
            <Input 
              id="restore-file" 
              type="file" 
              accept=".sql,.tar.gz,.tgz" 
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
