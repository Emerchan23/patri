"use client"

import { AppRouter } from "@/components/app-router"
import { PendenciasPatrimonio } from "@/components/pendencias-patrimonio"

export default function PendenciasPage() {
  return (
    <AppRouter requiredPermission="verPendenciasPatrimonio">
      <PendenciasPatrimonio />
    </AppRouter>
  )
}
