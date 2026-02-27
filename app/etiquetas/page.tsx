"use client"

import { AppRouter } from "@/components/app-router"
import { EtiquetasProvisoriasGenerator } from "@/components/etiquetas-provisorias"

export default function EtiquetasPage() {
  return (
    <AppRouter requiredPermission="gerarEtiquetas">
      <EtiquetasProvisoriasGenerator />
    </AppRouter>
  )
}
