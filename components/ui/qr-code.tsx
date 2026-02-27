"use client"

import { useEffect, useRef } from "react"
import QRCode from "qrcode"
import { cn } from "@/lib/utils"

// Generates a Data URL for a QR code
export async function generateQRCodeDataURL(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 300, // Higher resolution for print
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
  } catch (err) {
    console.error("Error generating QR code:", err)
    return ""
  }
}

interface QRCodeCanvasProps {
  data: string
  size?: number
  className?: string
}

export function QRCodeCanvas({
  data,
  size = 80,
  className,
}: QRCodeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // QRCode.toCanvas draws the QR code onto the canvas
    QRCode.toCanvas(canvas, data, {
      width: size,
      margin: 0, // No margin for the component itself, let container handle it
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }, (error) => {
      if (error) console.error("Error rendering QR code:", error)
    })
  }, [data, size])

  return (
    <canvas
      ref={canvasRef}
      className={cn(className)}
      aria-label={`QR Code para ${data}`}
    />
  )
}
