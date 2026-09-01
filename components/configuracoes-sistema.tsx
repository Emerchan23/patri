"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Save, RotateCcw, CheckCircle2, Palette, Layout, ShieldCheck } from "lucide-react"
import { api, fetcher } from "@/lib/api-client"
import useSWR from "swr"
import { themes, type ThemeColor } from "@/lib/theme-config"
import { useTheme } from "@/components/theme-provider"

interface SystemSettings {
  themeColor: ThemeColor
  sidebarColor: "light" | "dark" | "navy" | "slate"
  linkExtensaoXml: string
  linkPortalSefaz: string
  sessionDaysWeb: number
  sessionDaysMobile: number
}

const defaultSettings: SystemSettings = {
  themeColor: "blue",
  sidebarColor: "dark",
  linkExtensaoXml: "https://chromewebstore.google.com/detail/fsist-download-xml-nfe/jclbljmbidghoecicnjofjldjndabajp",
  linkPortalSefaz: "https://www.fsist.com.br/",
  sessionDaysWeb: 3,
  sessionDaysMobile: 30,
}

export function ConfiguracoesSistema() {
  const [saved, setSaved] = useState(false)
  const [localSettings, setLocalSettings] = useState<SystemSettings>(defaultSettings)
  const { setTheme, setSidebarColor } = useTheme()

  const { data: serverSettings, mutate } = useSWR<SystemSettings>("/configuracoes/sistema", fetcher)

  useEffect(() => {
    if (serverSettings) {
      setLocalSettings(serverSettings)
      if (serverSettings.themeColor) setTheme(serverSettings.themeColor)
      if (serverSettings.sidebarColor) {
        setSidebarColor(serverSettings.sidebarColor as "light" | "dark" | "navy" | "slate")
      }
    }
  }, [serverSettings, setTheme, setSidebarColor])

  const updateField = (key: keyof SystemSettings, value: string) => {
    const parsedValue =
      key === "sessionDaysWeb" || key === "sessionDaysMobile" ? Number(value || 0) : value
    const newSettings = { ...localSettings, [key]: parsedValue }
    setLocalSettings(newSettings)

    if (key === "themeColor") setTheme(value as ThemeColor)
    if (key === "sidebarColor") setSidebarColor(value as "light" | "dark" | "navy" | "slate")
  }

  const handleSave = async () => {
    try {
      await api.put("/configuracoes/sistema", localSettings)
      await mutate()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error("Erro ao salvar configuracoes:", error)
    }
  }

  const handleReset = async () => {
    setLocalSettings(defaultSettings)
    setTheme(defaultSettings.themeColor)
    setSidebarColor(defaultSettings.sidebarColor)
    try {
      await api.put("/configuracoes/sistema", defaultSettings)
      await mutate()
    } catch (error) {
      console.error("Erro ao resetar configuracoes:", error)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance">
            Personalizacao do Sistema
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Escolha as cores da interface e os tempos de sessao do site e do aplicativo
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

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <ShieldCheck className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm">Expiracao de Sessao</CardTitle>
                <CardDescription className="text-xs">
                  Defina quantos dias a sessao do login deve durar. A nova regra vale apenas para novos logins.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 max-w-3xl">
              <div className="space-y-2">
                <Label htmlFor="sessionDaysWeb">Sessao do site (dias)</Label>
                <Input
                  id="sessionDaysWeb"
                  type="number"
                  min={1}
                  max={365}
                  value={localSettings.sessionDaysWeb}
                  onChange={(e) => updateField("sessionDaysWeb", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Administradores definem o prazo do login web entre 1 e 365 dias.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sessionDaysMobile">Sessao do aplicativo (dias)</Label>
                <Input
                  id="sessionDaysMobile"
                  type="number"
                  min={1}
                  max={365}
                  value={localSettings.sessionDaysMobile}
                  onChange={(e) => updateField("sessionDaysMobile", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  O aplicativo pode usar um prazo maior sem afetar quem ja esta logado.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Palette className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm">Cor Principal</CardTitle>
                <CardDescription className="text-xs">
                  Define a cor de destaque para botoes, links e elementos ativos
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={localSettings.themeColor}
              onValueChange={(v) => updateField("themeColor", v)}
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6"
            >
              {Object.entries(themes).map(([key, theme]) => (
                <div key={key}>
                  <RadioGroupItem value={key} id={key} className="peer sr-only" />
                  <Label
                    htmlFor={key}
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                  >
                    <div
                      className="mb-3 h-6 w-6 rounded-full shadow-sm"
                      style={{ backgroundColor: `hsl(${theme.primary.split(" ")[0]} ${theme.primary.split(" ")[1]} ${theme.primary.split(" ")[2]})` }}
                    />
                    <span className="text-xs font-medium">{theme.label.split(" ")[0]}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Layout className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm">Menu Lateral</CardTitle>
                <CardDescription className="text-xs">
                  Estilo do menu de navegacao
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={localSettings.sidebarColor}
              onValueChange={(v) => updateField("sidebarColor", v)}
              className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl"
            >
              <div>
                <RadioGroupItem value="dark" id="sidebar-dark" className="peer sr-only" />
                <Label
                  htmlFor="sidebar-dark"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-all"
                >
                  <div className="mb-2 h-16 w-full rounded bg-[#0f172a] border border-slate-800 flex">
                    <div className="w-1/3 border-r border-slate-700 bg-[#0f172a] h-full"></div>
                    <div className="w-2/3 bg-white h-full"></div>
                  </div>
                  <span className="text-xs font-medium">Escuro (Padrao)</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="light" id="sidebar-light" className="peer sr-only" />
                <Label
                  htmlFor="sidebar-light"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-all"
                >
                  <div className="mb-2 h-16 w-full rounded bg-white border border-slate-200 flex">
                    <div className="w-1/3 border-r border-slate-200 bg-slate-50 h-full"></div>
                    <div className="w-2/3 bg-white h-full"></div>
                  </div>
                  <span className="text-xs font-medium">Claro</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="navy" id="sidebar-navy" className="peer sr-only" />
                <Label
                  htmlFor="sidebar-navy"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-all"
                >
                  <div className="mb-2 h-16 w-full rounded bg-[#172554] border border-blue-900 flex">
                    <div className="w-1/3 border-r border-blue-800 bg-[#172554] h-full"></div>
                    <div className="w-2/3 bg-white h-full"></div>
                  </div>
                  <span className="text-xs font-medium">Azul Marinho</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="slate" id="sidebar-slate" className="peer sr-only" />
                <Label
                  htmlFor="sidebar-slate"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-all"
                >
                  <div className="mb-2 h-16 w-full rounded bg-[#1e293b] border border-slate-700 flex">
                    <div className="w-1/3 border-r border-slate-600 bg-[#1e293b] h-full"></div>
                    <div className="w-2/3 bg-white h-full"></div>
                  </div>
                  <span className="text-xs font-medium">Cinza Moderno</span>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Layout className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm">Links da Nota Fiscal</CardTitle>
                <CardDescription className="text-xs">
                  Defina separadamente o link da extensao de XML e o portal aberto na consulta da SEFAZ.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-5 max-w-2xl">
              <Label htmlFor="linkExtensaoXml">Link da Extensao</Label>
              <div className="flex gap-2">
                <Input
                  id="linkExtensaoXml"
                  placeholder="Ex: https://chrome.google.com/webstore/detail/..."
                  value={localSettings.linkExtensaoXml || ""}
                  onChange={(e) => updateField("linkExtensaoXml", e.target.value)}
                  className="flex-1"
                />
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
              <p className="text-xs text-muted-foreground">
                Para gravar no banco de dados, clique em Salvar.
              </p>

              <div className="space-y-2">
                <Label htmlFor="linkPortalSefaz">Link do Portal SEFAZ</Label>
                <Input
                  id="linkPortalSefaz"
                  placeholder="Ex: https://www.sefaz.se.gov.br/..."
                  value={localSettings.linkPortalSefaz || ""}
                  onChange={(e) => updateField("linkPortalSefaz", e.target.value)}
                  className="flex-1"
                />
                <p className="text-xs text-muted-foreground">
                  Esse link sera usado no botao "Copiar e Abrir Portal SEFAZ" da entrada por nota fiscal.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
