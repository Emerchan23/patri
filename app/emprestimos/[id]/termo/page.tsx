
"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { api, getApiErrorMessage } from "@/lib/api-client"
import { Loan, formatDate } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { Printer, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { LoginPage } from "@/components/login"

export default function TermoEmprestimoPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const params = useParams()
  const id = params?.id as string
  const [loan, setLoan] = useState<Loan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [pdfSettings, setPdfSettings] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAuthenticated && id) {
      setLoading(true)
      Promise.all([api.getEmprestimo(id), api.getPdfSettings()])
        .then(([loanData, settings]) => { setLoan(loanData); setPdfSettings(settings) })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [id, isAuthenticated])

  if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  if (!isAuthenticated) {
    return <LoginPage />
  }

  if (loading) return <div className="flex h-screen items-center justify-center print:hidden"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (error) return <div className="flex h-screen items-center justify-center text-destructive print:hidden">Erro: {error}</div>
  if (!loan) return <div className="flex h-screen items-center justify-center print:hidden">Emprestimo nao encontrado</div>

  const uploadSignedTerm = async (file: File) => {
    setUploading(true)
    setUploadMessage("")
    try {
      await api.uploadTermoEmprestimo(id, file)
      const refreshed = await api.getEmprestimo(id)
      setLoan(refreshed)
      setUploadMessage("Termo assinado anexado com sucesso.")
    } catch (uploadError) {
      setUploadMessage(getApiErrorMessage(uploadError, "Nao foi possivel anexar o termo assinado."))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const settings = pdfSettings || {
    nomeOrgao: "SisPatrimonio",
    subtitulo: "Controle Patrimonial",
    endereco: "",
    telefone: "",
    cnpj: "",
    logoUrl: null,
  }

  return (
    <div className="min-h-screen bg-white p-8 print:p-0">
      <div className="mx-auto max-w-4xl space-y-8 print:space-y-6">
        {/* Institutional letterhead */}
        <div className="flex items-center gap-4 border-b-2 border-primary pb-5 print:border-black print:pb-4">
          {settings.mostrarLogo && settings.logoUrl && <img src={settings.logoUrl} alt="Logo institucional" className="h-16 w-24 object-contain" />}
          <div className="flex-1 text-center">
            <p className="text-lg font-bold uppercase">{settings.nomeOrgao}</p>
            <p className="text-xs text-muted-foreground print:text-black">{settings.subtitulo}</p>
            {settings.endereco && <p className="text-[10px] text-muted-foreground print:text-black">{settings.endereco}</p>}
            {(settings.cnpj || settings.telefone) && <p className="text-[10px] text-muted-foreground print:text-black">{settings.cnpj}{settings.cnpj && settings.telefone ? " | " : ""}{settings.telefone}</p>}
            <h1 className="mt-4 text-2xl font-bold uppercase">Termo de Responsabilidade de Emprestimo</h1>
            <p className="text-muted-foreground print:text-black">Controle Patrimonial - Emprestimo de Equipamentos</p>
          </div>
          <div className="w-24" />
        </div>

        {/* Action Buttons (Hidden on Print) */}
        <div className="flex justify-end print:hidden">
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir Termo
          </Button>
          <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadSignedTerm(file) }} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Anexar termo assinado
          </Button>
        </div>
        {uploadMessage && <div className={`rounded border p-3 text-sm print:hidden ${uploadMessage.includes("sucesso") ? "border-green-200 bg-green-50 text-green-800" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>{uploadMessage}</div>}

        <div className="rounded border p-3 text-sm print:hidden">
          <strong>Status do termo:</strong> {loan.termo?.status === "assinado" ? "Assinado e anexado" : "Aguardando assinatura"}
          {loan.termo?.assinadoEm && <span className="ml-2 text-muted-foreground">em {new Date(loan.termo.assinadoEm).toLocaleDateString("pt-BR")}</span>}
          {loan.termo?.arquivoAssinado && <a className="ml-3 text-primary underline" href={loan.termo.arquivoAssinado} target="_blank" rel="noreferrer">Abrir PDF assinado</a>}
        </div>

        {/* Content */}
        <div className="space-y-6 text-justify leading-relaxed font-serif text-lg">
          <p>
            Pelo presente termo, a <strong>{loan.origem?.secretaria}</strong> ({loan.origem?.departamento}), neste ato representada por <strong>{loan.responsavelEmprestimo}</strong>, entrega a titulo de emprestimo para a <strong>{loan.destino?.secretaria}</strong> ({loan.destino?.departamento}), representada por <strong>{loan.responsavelRecebimento}</strong>{loan.solicitante ? `, e retirado por ${loan.solicitante}` : ""}, o bem patrimonial abaixo descrito:
          </p>

          <Card className="border-2 shadow-none print:border-black">
            <CardContent className="p-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold print:text-black">Patrimonio</p>
                <p className="font-mono text-xl font-bold">{loan.patrimonio}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold print:text-black">Descricao</p>
                <p className="text-xl">{loan.assetDescricao}</p>
              </div>
              {loan.solicitante && (
                <div className="col-span-2 border-t pt-4 mt-2 print:border-black">
                  <p className="text-xs text-muted-foreground uppercase font-bold print:text-black">Retirado Por (Solicitante)</p>
                  <p className="font-medium text-lg">{loan.solicitante}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-8 py-4">
            <div className="border p-4 rounded bg-muted/10 print:bg-transparent print:border-black">
              <p className="font-bold mb-1 uppercase text-sm">Data do Emprestimo</p>
              <p className="text-xl">{formatDate(loan.dataEmprestimo)}</p>
            </div>
            <div className="border p-4 rounded bg-muted/10 print:bg-transparent print:border-black">
              <p className="font-bold mb-1 uppercase text-sm">Previsao de Devolucao</p>
              <p className="text-xl">{formatDate(loan.dataPrevistaDevolucao)}</p>
            </div>
          </div>

          <p>
            O recebedor declara ter recebido o equipamento em perfeitas condicoes de uso e funcionamento, comprometendo-se a zelar pela sua guarda e conservacao, bem como a devolve-lo na data prevista ou quando solicitado, nas mesmas condicoes em que o recebeu, ressalvado o desgaste natural pelo uso.
          </p>
          
          {loan.observacoes && (
            <div className="mt-4">
              <p className="font-bold mb-1 uppercase text-sm">Observacoes:</p>
              <p className="italic border-l-4 pl-4 py-2 bg-muted/30 print:bg-transparent print:border-black">{loan.observacoes}</p>
            </div>
          )}
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-12 pt-20 mt-16 page-break-inside-avoid">
          <div className="text-center space-y-2">
            <div className="border-t border-black w-3/4 mx-auto pt-2"></div>
            <p className="font-bold">{loan.responsavelEmprestimo}</p>
            <p className="text-xs text-muted-foreground uppercase print:text-black">Responsavel Emprestimo (Origem)</p>
          </div>
          <div className="text-center space-y-2">
            <div className="border-t border-black w-3/4 mx-auto pt-2"></div>
            <p className="font-bold">{loan.responsavelRecebimento}</p>
            <p className="text-xs text-muted-foreground uppercase print:text-black">Responsavel Recebimento (Destino)</p>
          </div>
          
          {loan.solicitante && (
            <div className="text-center space-y-2 col-span-2 pt-12">
              <div className="border-t border-black w-1/2 mx-auto pt-2"></div>
              <p className="font-bold">{loan.solicitante}</p>
              <p className="text-xs text-muted-foreground uppercase print:text-black">Solicitante / Retirado Por</p>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-muted-foreground pt-12 print:fixed print:bottom-4 print:left-0 print:w-full print:text-black">
          Documento gerado pelo SisPatrimonio em {new Date().toLocaleDateString()} as {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}
