"use client"

import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Camera, RefreshCw, X } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface WebcamModalProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (imageSrc: string) => void
}

export function WebcamModal({ isOpen, onClose, onCapture }: WebcamModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string>("")
  const { toast } = useToast()

  const startCamera = async () => {
    try {
      setError("")
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } // Tenta usar câmera traseira em mobile, se disponível
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (err) {
      console.error("Erro ao acessar webcam:", err)
      const msg = "Não foi possível acessar a câmera. Verifique as permissões."
      setError(msg)
      toast({
        title: "Erro na Câmera",
        description: msg,
        variant: "destructive"
      })
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  // Iniciar câmera quando modal abrir
  useEffect(() => {
    if (isOpen) {
      // Pequeno delay para garantir que o modal renderizou o video element
      const timer = setTimeout(() => {
        startCamera()
      }, 300)
      return () => clearTimeout(timer)
    } else {
      stopCamera()
    }
  }, [isOpen])

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      
      // Configurar canvas com as dimensões do vídeo
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const context = canvas.getContext('2d')
      if (context) {
        // Espelhar se for câmera frontal (opcional, aqui não estamos detectando, então desenha normal)
        // context.translate(canvas.width, 0);
        // context.scale(-1, 1);
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8) // JPEG com qualidade 0.8 para otimizar
        onCapture(dataUrl)
        handleClose()
      }
    }
  }

  const handleClose = () => {
    stopCamera()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-black border-zinc-800">
        <DialogHeader className="p-4 bg-background/90 backdrop-blur absolute top-0 left-0 right-0 z-10 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>Tirar Foto</DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="relative aspect-video bg-black flex items-center justify-center mt-[60px] mb-[80px]">
          {error ? (
            <div className="text-white text-center p-4">
              <p className="mb-2">{error}</p>
              <Button onClick={startCamera} variant="secondary" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar Novamente
              </Button>
            </div>
          ) : (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className="w-full h-full object-contain"
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 bg-background/90 backdrop-blur border-t flex justify-center items-center gap-4 z-10">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleCapture} disabled={!!error || !stream} className="px-8">
            <Camera className="mr-2 h-4 w-4" />
            Capturar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
