
import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle2, AlertTriangle, Info } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type PatrimonioType = "definitivo" | "provisorio"

interface PatrimonioTypeSelectorProps {
  value: PatrimonioType
  onChange: (value: PatrimonioType) => void
  provAno: string
  setProvAno: (val: string) => void
  manualProvisorio: boolean
  setManualProvisorio: (val: boolean) => void
  manualStartNumber: string
  setManualStartNumber: (val: string) => void
}

export function PatrimonioTypeSelector({ 
  value, 
  onChange, 
  provAno, 
  setProvAno,
  manualProvisorio, 
  setManualProvisorio,
  manualStartNumber,
  setManualStartNumber
}: PatrimonioTypeSelectorProps) {
  const currentYear = new Date().getFullYear().toString()
  const years = Array.from({ length: 5 }, (_, i) => (parseInt(currentYear) - 2 + i).toString())

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Tipo de Patrimonio</CardTitle>
        </div>
        <CardDescription>
          Escolha como os numeros de patrimonio serao gerados para este cadastro.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
          <button
            type="button"
            onClick={() => onChange("provisorio")}
            className={`flex flex-1 items-center gap-4 rounded-xl border-2 p-4 transition-all ${
              value === "provisorio"
                ? "border-warning bg-warning/5"
                : "border-border hover:border-border/80"
            }`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                value === "provisorio" ? "bg-warning/10" : "bg-muted"
              }`}
            >
              <Clock
                className={`h-5 w-5 ${
                  value === "provisorio" ? "text-warning" : "text-muted-foreground"
                }`}
              />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold">Provisorio</p>
              <p className="text-xs text-muted-foreground">
                Numero temporario (PROV-XXXX)
              </p>
            </div>
            {value === "provisorio" && (
              <Badge className="ml-auto bg-warning text-warning-foreground">Selecionado</Badge>
            )}
          </button>

          <button
            type="button"
            onClick={() => onChange("definitivo")}
            className={`flex flex-1 items-center gap-4 rounded-xl border-2 p-4 transition-all ${
              value === "definitivo"
                ? "border-success bg-success/5"
                : "border-border hover:border-border/80"
            }`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                value === "definitivo" ? "bg-success/10" : "bg-muted"
              }`}
            >
              <CheckCircle2
                className={`h-5 w-5 ${
                  value === "definitivo" ? "text-success" : "text-muted-foreground"
                }`}
              />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold">Definitivo</p>
              <p className="text-xs text-muted-foreground">
                Numero oficial da prefeitura
              </p>
            </div>
            {value === "definitivo" && (
              <Badge className="ml-auto bg-success text-success-foreground">Selecionado</Badge>
            )}
          </button>
        </div>

        {value === "provisorio" && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg bg-warning/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch 
                  id="manual-prov" 
                  checked={manualProvisorio}
                  onCheckedChange={setManualProvisorio}
                />
                <Label htmlFor="manual-prov" className="cursor-pointer">Digitar numero inicial manualmente?</Label>
              </div>
            </div>

            {manualProvisorio ? (
               <div className="flex flex-wrap items-end gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Ano</Label>
                    <Select value={provAno} onValueChange={setProvAno}>
                      <SelectTrigger className="w-24 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                    <Label className="text-xs">Numero Inicial</Label>
                    <div className="flex items-center gap-2">
                       <span className="text-sm font-mono font-medium text-muted-foreground whitespace-nowrap">PROV-{provAno}-</span>
                       <Input 
                         value={manualStartNumber}
                         onChange={(e) => setManualStartNumber(e.target.value.replace(/\D/g, ''))}
                         placeholder="00001"
                         className="font-mono bg-background"
                       />
                    </div>
                  </div>
                  <div className="w-full text-xs text-muted-foreground mt-1">
                    O sistema gerara a sequencia a partir de: <strong>PROV-{provAno}-{manualStartNumber || "XXXXX"}</strong>
                  </div>
               </div>
            ) : (
               <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    O sistema gerara numeros provisorios sequenciais automaticamente (PROV-{provAno}-AUTO).
                  </p>
               </div>
            )}
          </div>
        )}

        {value === "definitivo" && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-success/10 p-3">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              O numero inicial e opcional. Se deixar em branco, o sistema gera automaticamente a sequencia definitiva.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
