"use client"

import { AppRouter } from "@/components/app-router"
import { Scanner } from "@/components/scanner"

export default function ScannerPage() {
  return (
    <AppRouter requiredPermission="usarScanner">
      <Scanner />
    </AppRouter>
  )
}
