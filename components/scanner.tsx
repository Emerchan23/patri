"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from "html5-qrcode"
import { MoveAssetDialog } from "@/components/MoveAssetDialog"
import {
  ScanBarcode,
  Search,
  Package,
  MapPin,
  User,
  DollarSign,
  Tag,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Wrench,
  FileText,
  Smartphone,
  QrCode,
  Loader2,
  Camera,
  StopCircle,
  Edit,
  ImageIcon,
} from "lucide-react"
import {
  getStatusLabel,
  getStatusColor,
  getCategoryLabel,
  formatCurrency,
  formatDate,
} from "@/lib/data"
import type { Asset } from "@/lib/data"
import Link from "next/link"

export function Scanner() {
  const { toast } = useToast()
  const [manualCode, setManualCode] = useState("")
  const [foundAsset, setFoundAsset] = useState<Asset | null>(null)
  const [candidateAssets, setCandidateAssets] = useState<Asset[]>([])
  const [roomAssets, setRoomAssets] = useState<Asset[]>([])
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "found" | "not_found" | "room_found" | "ambiguous">("idle")
  const [roomLookupLabel, setRoomLookupLabel] = useState("")
  const [isCameraRunning, setIsCameraRunning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  
  // Movement Dialog State
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState()
          if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
            scannerRef.current.stop().catch(console.warn)
          }
          scannerRef.current.clear()
        } catch (e) {
          console.warn("Scanner cleanup warning:", e)
        }
      }
    }
  }, [])

  // Initialize scanner when isCameraRunning becomes true
  useEffect(() => {
    if (isCameraRunning && !scannerRef.current) {
      const initScanner = async () => {
        try {
          // Wait for DOM update
          await new Promise(resolve => setTimeout(resolve, 100))
          
          if (!document.getElementById("reader")) {
             throw new Error("Elemento reader não encontrado")
          }

          if (scannerRef.current) {
            return
          }

          const html5QrCode = new Html5Qrcode("reader", { 
            verbose: false,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.ITF,
            ] 
          })
          scannerRef.current = html5QrCode

          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 300, height: 150 }, // Wider box for barcodes
            },
            (decodedText) => {
              handleSearch(decodedText)
              stopScanner()
            },
            (errorMessage) => {
              // ignore frames without QR
            }
          )
        } catch (err: any) {
          console.error(err)
          setIsCameraRunning(false)
          
          let title = "Erro na Câmera"
          let desc = "Não foi possível iniciar a câmera. Tente novamente."

          if (err.name === "NotReadableError" || err.toString().includes("NotReadableError")) {
             title = "Câmera em uso"
             desc = "A câmera está sendo usada por outro aplicativo ou aba. Feche-os e tente novamente."
          } else if (err.name === "NotAllowedError") {
             title = "Permissão negada"
             desc = "Você bloqueou o acesso à câmera. Permita o acesso nas configurações do site."
          }

          setCameraError(desc)
          toast({
            title: title,
            description: desc,
            variant: "destructive",
          })
        }
      }
      
      initScanner()
    }
  }, [isCameraRunning, toast])

  const startScanner = async () => {
    try {
      if (scannerRef.current) {
        return
      }

      setCameraError(null)

      // Check for cameras first
      try {
        const devices = await Html5Qrcode.getCameras()
        if (!devices || devices.length === 0) {
          throw new Error("Nenhuma câmera encontrada no dispositivo.")
        }
      } catch (err: any) {
        console.error("Erro ao listar câmeras:", err)
        
        let errorMsg = "Não foi possível acessar a câmera."
        let errorDesc = "Verifique se você possui uma webcam conectada e se as permissões foram concedidas."

        if (err.name === "NotReadableError" || err.message?.includes("Device in use")) {
            errorMsg = "Câmera em uso por outro aplicativo"
            errorDesc = "Feche outros programas que estejam usando a câmera (Zoom, Teams, Meet, etc) e tente novamente."
        } else if (err.name === "NotAllowedError" || err.message?.includes("Permission denied")) {
            errorMsg = "Permissão negada"
            errorDesc = "Você precisa permitir o acesso à câmera nas configurações do navegador."
        } else if (err.name === "NotFoundError") {
            errorMsg = "Nenhuma câmera encontrada"
            errorDesc = "Não detectamos nenhuma câmera conectada ao dispositivo."
        }

        setCameraError(errorMsg)
        toast({
          title: errorMsg,
          description: errorDesc,
          variant: "destructive",
        })
        return
      }

      setIsCameraRunning(true)
    } catch (err: any) {
      console.error(err)
      
      let errorMsg = "Erro ao iniciar a câmera"
      if (err.name === "NotReadableError") {
          errorMsg = "Câmera ocupada por outro app"
      }
      
      setCameraError(errorMsg)
      toast({
        title: "Erro na Câmera",
        description: errorMsg === "Câmera ocupada por outro app" 
            ? "Feche outros apps que usam a câmera e tente novamente."
            : "Não foi possível iniciar a câmera. Verifique as permissões.",
        variant: "destructive",
      })
    }
  }

  const stopScanner = async () => {
    if (!scannerRef.current) return
    
    try {
      // Check state before stopping
      // Html5Qrcode.getState() returns an enum/number. 
      // 1 = SCANNING, 2 = PAUSED
      const state = scannerRef.current.getState()
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scannerRef.current.stop()
      }
      scannerRef.current.clear()
    } catch (err) {
      console.warn("Scanner stop warning:", err)
    }
    setIsCameraRunning(false)
  }

  const handleSearch = async (code: string = manualCode) => {
    const trimmedCode = code.trim()
    if (!trimmedCode) return

    setScanStatus("scanning")
    setFoundAsset(null)
    setCandidateAssets([])
    setRoomAssets([])
    setRoomLookupLabel("")
    setManualCode(trimmedCode)

    try {
      // Clean code: remove leading zeros if it's numeric
      // Example: 009994 -> 9994
      let searchTerm = trimmedCode;
      if (/^\d+$/.test(trimmedCode)) {
        searchTerm = String(parseInt(trimmedCode, 10));
      }
      
      // Handle Special QR Codes (SALA:id)
      if (trimmedCode.startsWith("SALA:")) {
        const salaId = trimmedCode.split(":")[1];
        try {
          const salaRes = await fetch(`/api/salas/${salaId}`);
          if (salaRes.ok) {
            const salaData = await salaRes.json();
            if (salaData && salaData.nome) {
              searchTerm = salaData.nome;
              // Optional: Update input to show resolved name
              // setManualCode(salaData.nome); 
            }
          }
        } catch (e) {
          console.error("Error fetching sala details", e);
        }
      }

      // 1. Try to find as Asset
      // Use the clean search term (without zeros)
      const assetRes = await fetch(`/api/bens?patrimonio=${encodeURIComponent(searchTerm)}&scanner_lookup=true`)
      const assetsResponse = await assetRes.json()
      const assets = assetsResponse.data || []

      if (assets && assets.length === 1) {
        setFoundAsset(assets[0])
        setScanStatus("found")
        return
      }

      if (assets && assets.length > 1) {
        setCandidateAssets(assets)
        setScanStatus("ambiguous")
        return
      }

      // 2. Try to find as Room (list assets in room)
      // Use the clean search term if it's a name, or handle specific SALA logic above
      const roomRes = await fetch(`/api/bens?sala=${encodeURIComponent(searchTerm)}`)
      const roomResponse = await roomRes.json()
      const roomAssetsData = roomResponse.data || []

      if (roomAssetsData && roomAssetsData.length > 0) {
        setRoomAssets(roomAssetsData)
        setRoomLookupLabel(searchTerm)
        setScanStatus("room_found")
        return
      }

      setScanStatus("not_found")
    } catch (error) {
      console.error(error)
      toast({
        title: "Erro na busca",
        description: "Ocorreu um erro ao buscar o patrimônio.",
        variant: "destructive",
      })
      setScanStatus("idle")
    }
  }

  const handleMoveClick = (asset: Asset) => {
    setSelectedAsset(asset)
    setMoveDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <MoveAssetDialog 
        asset={selectedAsset} 
        open={moveDialogOpen} 
        onOpenChange={setMoveDialogOpen}
        onSuccess={() => {
          // Refresh data
          handleSearch(manualCode)
        }}
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-balance">Escanear Patrimônio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Busque um bem ou sala pelo QR Code ou digitando o código completo, só os últimos números, com ou sem PROV e hífens.
        </p>
      </div>

      {/* Scanner area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left - scanner */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          {/* Camera View */}
          <Card className="overflow-hidden">
            <div className="relative flex flex-col items-center justify-center bg-black min-h-[300px]">
              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center text-white z-20">
                    <XCircle className="h-10 w-10 text-destructive mb-2" />
                    <p className="font-medium">Câmera Indisponível</p>
                    <p className="text-xs text-white/70 mt-1">{cameraError}</p>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="mt-4"
                        onClick={() => setCameraError(null)}
                    >
                        Tentar Novamente
                    </Button>
                </div>
              )}

              {!isCameraRunning ? (
                <div className="flex flex-col items-center gap-4 py-12 px-6 text-white">
                  <div className="rounded-full bg-white/10 p-4">
                    <Camera className="h-8 w-8" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium">Câmera Desligada</p>
                    <p className="text-xs text-white/70 mt-1">
                      Toque para iniciar o escaneamento
                    </p>
                  </div>
                  <Button onClick={startScanner} variant="secondary" size="sm">
                    Iniciar Câmera
                  </Button>
                </div>
              ) : (
                <div className="w-full h-full relative">
                   <div id="reader" className="w-full h-full"></div>
                   <Button 
                    onClick={stopScanner} 
                    variant="destructive" 
                    size="sm"
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10"
                   >
                    <StopCircle className="h-4 w-4 mr-2" />
                    Parar
                   </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Manual input */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Busca Manual</CardTitle>
              <CardDescription className="text-xs">
                Digite o patrimônio completo, só o final do provisório ou o nome da sala
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: PROV-2026-00331, 00331, 331 ou Sala 101"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="font-mono"
                />
                <Button onClick={() => handleSearch()} size="icon" className="shrink-0">
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {/* Simulation Buttons */}
              <div className="mt-2 border-t pt-3">
                <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-2">Simulação Rápida</p>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => handleSearch("PAT-2024-00142")}>Bem: PAT-00142</Button>
                    <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => handleSearch("00331")}>Prov: 00331</Button>
                    <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => handleSearch("Sala 101")}>Sala: 101</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right - result */}
        <div className="lg:col-span-2">
          {scanStatus === "idle" && (
            <Card className="h-full">
              <CardContent className="flex h-full flex-col items-center justify-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <ScanBarcode className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mt-4 text-sm font-medium text-muted-foreground">
                  Aguardando leitura
                </p>
              </CardContent>
            </Card>
          )}

          {scanStatus === "scanning" && (
            <Card className="h-full">
              <CardContent className="flex h-full flex-col items-center justify-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 animate-pulse">
                  <Search className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 text-sm font-medium">Buscando...</p>
              </CardContent>
            </Card>
          )}

          {scanStatus === "not_found" && (
            <Card className="h-full border-destructive/30">
              <CardContent className="flex h-full flex-col items-center justify-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <p className="mt-4 text-sm font-semibold text-destructive">
                  Nada encontrado
                </p>
                <p className="text-xs text-muted-foreground mt-1 text-center max-w-xs">
                  Não encontramos nenhum bem ou sala com &quot;{manualCode}&quot;. Você pode tentar o código completo, só os últimos números do PROV ou o nome da sala.
                </p>
              </CardContent>
            </Card>
          )}

          {scanStatus === "ambiguous" && (
            <Card className="border-warning/40">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-warning text-warning-foreground">
                    <Search className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-semibold">Mais de um bem encontrado</span>
                </div>
                <CardTitle className="text-lg">Escolha o patrimônio correto</CardTitle>
                <CardDescription>
                  A busca por &quot;{manualCode}&quot; encontrou mais de um patrimônio provisório. Selecione o item certo abaixo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {candidateAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => {
                        setFoundAsset(asset)
                        setScanStatus("found")
                      }}
                      className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{asset.patrimonioProvisorio || asset.patrimonio}</p>
                          <p className="text-sm">{asset.descricao}</p>
                          <p className="text-xs text-muted-foreground">
                            {asset.localizacao.secretaria} - {asset.localizacao.departamento} - {asset.localizacao.sala}
                          </p>
                        </div>
                        <Badge className={`${getStatusColor(asset.status)} text-xs`}>
                          {getStatusLabel(asset.status)}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* SINGLE ASSET RESULT */}
          {scanStatus === "found" && foundAsset && (
            <Card className="border-success/30">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success">
                    <CheckCircle2 className="h-4 w-4 text-success-foreground" />
                  </div>
                  <span className="text-sm font-semibold text-success">Bem Encontrado</span>
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{foundAsset.descricao}</CardTitle>
                    {foundAsset.marca && (
                      <CardDescription className="mt-1">
                        {foundAsset.marca} {foundAsset.modelo}
                      </CardDescription>
                    )}
                  </div>
                  <Badge className={`${getStatusColor(foundAsset.status)} text-xs`}>
                    {getStatusLabel(foundAsset.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {/* Image */}
                <div className="flex justify-center rounded-lg border bg-muted/30 p-2">
                   {foundAsset.imagem ? (
                     <img 
                       src={foundAsset.imagem} 
                       alt={foundAsset.descricao}
                       className="max-h-[200px] w-auto rounded-md object-contain"
                     />
                   ) : (
                     <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                       <ImageIcon className="h-12 w-12 mb-2" />
                       <p className="text-xs">Sem foto</p>
                     </div>
                   )}
                </div>

                {/* Patrimony badge */}
                <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
                  <Tag className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Patrimônio</p>
                    <p className="text-sm font-mono font-bold">{foundAsset.patrimonio}</p>
                  </div>
                </div>

                <Separator />

                {/* Detail grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Localização</p>
                      <p className="text-sm font-medium">{foundAsset.localizacao.secretaria}</p>
                      <p className="text-xs text-muted-foreground">
                        {foundAsset.localizacao.departamento} - {foundAsset.localizacao.sala}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Responsável</p>
                      <p className="text-sm font-medium">
                         {typeof foundAsset.responsavel === 'string' ? foundAsset.responsavel : foundAsset.responsavel?.nome}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <DollarSign className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Valor / Aquisição</p>
                      <p className="text-sm font-medium">{formatCurrency(foundAsset.valor)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(foundAsset.dataAquisicao)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick actions */}
                <Separator />
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="gap-1.5"
                    onClick={() => handleMoveClick(foundAsset)}
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Movimentar
                  </Button>
                  
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleSearch(manualCode)}>
                    <ScanBarcode className="h-3.5 w-3.5" />
                    Atualizar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ROOM RESULT */}
          {scanStatus === "room_found" && (
             <Card>
                <CardHeader>
                    <CardTitle>Itens na Sala: {roomLookupLabel || manualCode}</CardTitle>
                    <CardDescription>Busca resolvida como sala. {roomAssets.length} itens encontrados nesta localização.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-4">
                            {roomAssets.map(asset => (
                                <div key={asset.id} className="flex items-center gap-3 border p-3 rounded-lg">
                                    <div className="h-12 w-12 shrink-0 rounded-md border bg-muted flex items-center justify-center overflow-hidden">
                                        {asset.imagem ? (
                                            <img 
                                                src={asset.imagem} 
                                                alt={asset.descricao}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className="font-medium text-sm line-clamp-1">{asset.descricao}</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs text-muted-foreground">{asset.patrimonio}</p>
                                            <Badge variant="outline" className="text-[10px] h-4 px-1">{getStatusLabel(asset.status)}</Badge>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 shrink-0">
                                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleMoveClick(asset)}>
                                            <ArrowRightLeft className="h-3 w-3 mr-1" /> Mover
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
             </Card>
          )}
        </div>
      </div>
    </div>
  )
}
