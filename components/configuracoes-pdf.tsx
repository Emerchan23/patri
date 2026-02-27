"use client"

import React from "react"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Save,
  RotateCcw,
  Eye,
  Upload,
  Trash2,
  FileText,
  Building2,
  Stamp,
  Settings2,
  CheckCircle2,
  ImageIcon,
} from "lucide-react"
import { type PdfSettings, defaultPdfSettings } from "@/lib/data"
import { api, fetcher } from "@/lib/api-client"
import useSWR from "swr"

function PdfPreview({ settings }: { settings: PdfSettings }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-border bg-card p-6 text-foreground">
      {/* Header Preview */}
      <div className="flex items-center gap-3 border-b-2 border-primary pb-3 mb-4">
        {settings.mostrarLogo && (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl || "/placeholder.svg"}
                alt="Logo"
                className="h-10 w-10 object-contain"
                crossOrigin="anonymous"
              />
            ) : (
              <span className="text-xs font-bold text-primary-foreground">SP</span>
            )}
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm font-bold">{settings.nomeOrgao}</p>
          <p className="text-[10px] text-muted-foreground">{settings.subtitulo}</p>
          <p className="text-[9px] text-muted-foreground">{settings.endereco}</p>
          <p className="text-[9px] text-muted-foreground">
            CNPJ: {settings.cnpj} | Tel: {settings.telefone}
          </p>
        </div>
        {settings.mostrarDataHora && (
          <div className="text-right">
            <p className="text-[9px] text-muted-foreground">Emitido em</p>
            <p className="text-[10px] font-medium">
              {new Intl.DateTimeFormat("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date())}
            </p>
          </div>
        )}
      </div>

      {/* Body Preview */}
      <div className="mb-4">
        <div className="text-center mb-4">
          <p className="text-sm font-bold text-primary">Titulo do Relatorio</p>
          <p className="text-[10px] text-muted-foreground">Subtitulo do documento</p>
        </div>

        <div className="rounded border border-border overflow-hidden">
          <div className="grid grid-cols-4 gap-0 bg-muted">
            <div className="p-1.5 text-[9px] font-semibold text-muted-foreground">Patrimonio</div>
            <div className="p-1.5 text-[9px] font-semibold text-muted-foreground">Descricao</div>
            <div className="p-1.5 text-[9px] font-semibold text-muted-foreground">Local</div>
            <div className="p-1.5 text-[9px] font-semibold text-muted-foreground">Valor</div>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-4 gap-0 border-t border-border">
              <div className="p-1.5 text-[9px] font-mono">PAT-2024-{String(i).padStart(4, "0")}</div>
              <div className="p-1.5 text-[9px]">Item exemplo {i}</div>
              <div className="p-1.5 text-[9px]">Sala {i}01</div>
              <div className="p-1.5 text-[9px]">R$ {(i * 1500).toLocaleString("pt-BR")}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Preview */}
      <div className="border-t border-border pt-3">
        {settings.mostrarAssinatura && (
          <div className="mx-auto mb-4 w-48 text-center">
            <div className="border-t border-foreground pt-1.5 mt-6">
              <p className="text-[10px] font-medium">{settings.assinaturaTexto}</p>
              <p className="text-[9px] text-muted-foreground">{settings.assinaturaCargo}</p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between text-[8px] text-muted-foreground">
          <span>{settings.rodape}</span>
          {settings.mostrarNumeroPagina && <span>Pagina 1</span>}
        </div>
      </div>
    </div>
  )
}

export function ConfiguracoesPdf() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saved, setSaved] = useState(false)
  const [localSettings, setLocalSettings] = useState<PdfSettings>(defaultPdfSettings)

  const { data: serverSettings, mutate } = useSWR<PdfSettings>("/configuracoes/pdf", fetcher)

  // Sync server settings to local state when loaded
  React.useEffect(() => {
    if (serverSettings) {
      setLocalSettings(serverSettings)
    }
  }, [serverSettings])

  const updateField = useCallback(
    <K extends keyof PdfSettings>(key: K, value: PdfSettings[K]) => {
      setLocalSettings((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const handleSave = async () => {
    try {
      await api.updatePdfSettings(localSettings)
      await mutate() // Refresh SWR cache
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error("Erro ao salvar configuracoes:", error)
    }
  }

  const handleReset = async () => {
    setLocalSettings(defaultPdfSettings)
    try {
      await api.updatePdfSettings(defaultPdfSettings)
      await mutate()
    } catch (error) {
      console.error("Erro ao resetar configuracoes:", error)
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      updateField("logoUrl", ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const removeLogo = () => {
    updateField("logoUrl", null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // Use localSettings for UI rendering to allow immediate feedback
  const settings = localSettings

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">
            Personalizacao de Documentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure o cabecalho, rodape, logo e assinatura dos PDFs gerados
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 bg-transparent" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
            Restaurar Padrao
          </Button>
          <Button className="gap-2" onClick={handleSave}>
            {saved ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Salvo
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Settings Column */}
        <div className="flex flex-col gap-5">
          {/* Orgao Info */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm">Dados do Orgao</CardTitle>
                  <CardDescription className="text-xs">
                    Informacoes exibidas no cabecalho do documento
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="nomeOrgao" required>Nome do Orgao</Label>
                <Input
                  id="nomeOrgao"
                  value={settings.nomeOrgao}
                  onChange={(e) => updateField("nomeOrgao", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="subtitulo">Subtitulo</Label>
                <Input
                  id="subtitulo"
                  value={settings.subtitulo}
                  onChange={(e) => updateField("subtitulo", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="endereco">Endereco</Label>
                <Input
                  id="endereco"
                  value={settings.endereco}
                  onChange={(e) => updateField("endereco", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cnpj" required>CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={settings.cnpj}
                    onChange={(e) => updateField("cnpj", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={settings.telefone}
                    onChange={(e) => updateField("telefone", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={settings.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="site">Site</Label>
                  <Input
                    id="site"
                    value={settings.site}
                    onChange={(e) => updateField("site", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logo */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info/10">
                  <ImageIcon className="h-4 w-4 text-info" />
                </div>
                <div>
                  <CardTitle className="text-sm">Logo</CardTitle>
                  <CardDescription className="text-xs">
                    Imagem exibida no cabecalho dos documentos
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="mostrarLogo">Exibir logo no documento</Label>
                <Switch
                  id="mostrarLogo"
                  checked={settings.mostrarLogo}
                  onCheckedChange={(v) => updateField("mostrarLogo", v)}
                />
              </div>

              {settings.mostrarLogo && (
                <div className="flex flex-col gap-3">
                  {settings.logoUrl ? (
                    <div className="flex items-center gap-4 rounded-lg border border-border p-4">
                      <img
                        src={settings.logoUrl || "/placeholder.svg"}
                        alt="Logo preview"
                        className="h-14 w-14 rounded-lg object-contain border border-border"
                        crossOrigin="anonymous"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Logo carregado</p>
                        <p className="text-xs text-muted-foreground">Clique abaixo para alterar ou remover</p>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-transparent"
                        onClick={removeLogo}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Remover logo</span>
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Clique para enviar o logo</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG ou SVG</p>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer & Signature */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                  <Stamp className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-sm">Rodape e Assinatura</CardTitle>
                  <CardDescription className="text-xs">
                    Configuracoes do rodape e campo de assinatura
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rodape">Texto do Rodape</Label>
                <Textarea
                  id="rodape"
                  value={settings.rodape}
                  onChange={(e) => updateField("rodape", e.target.value)}
                  className="min-h-16"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="mostrarDataHora">Exibir data/hora de emissao</Label>
                <Switch
                  id="mostrarDataHora"
                  checked={settings.mostrarDataHora}
                  onCheckedChange={(v) => updateField("mostrarDataHora", v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="mostrarNumeroPagina">Exibir numero da pagina</Label>
                <Switch
                  id="mostrarNumeroPagina"
                  checked={settings.mostrarNumeroPagina}
                  onCheckedChange={(v) => updateField("mostrarNumeroPagina", v)}
                />
              </div>

              <div className="border-t border-border pt-4 mt-2">
                <div className="flex items-center justify-between mb-4">
                  <Label htmlFor="mostrarAssinatura">Incluir campo de assinatura</Label>
                  <Switch
                    id="mostrarAssinatura"
                    checked={settings.mostrarAssinatura}
                    onCheckedChange={(v) => updateField("mostrarAssinatura", v)}
                  />
                </div>

                {settings.mostrarAssinatura && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="assinaturaTexto">Nome do Responsavel</Label>
                      <Input
                        id="assinaturaTexto"
                        value={settings.assinaturaTexto}
                        onChange={(e) => updateField("assinaturaTexto", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="assinaturaCargo">Cargo</Label>
                      <Input
                        id="assinaturaCargo"
                        value={settings.assinaturaCargo}
                        onChange={(e) => updateField("assinaturaCargo", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Column */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Pre-visualizacao do Documento</p>
            <Badge variant="secondary" className="text-[10px]">Tempo real</Badge>
          </div>
          <div className="sticky top-4">
            <PdfPreview settings={settings} />
          </div>
        </div>
      </div>
    </div>
  )
}
