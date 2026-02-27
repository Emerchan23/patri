"use client"

import { AppRouter } from "@/components/app-router"
import { Relatorios } from "@/components/relatorios"

export default function RelatoriosPage() {
  return (
    <AppRouter requiredPermission="verRelatorios">
      <Relatorios />
    </AppRouter>
  )
}
