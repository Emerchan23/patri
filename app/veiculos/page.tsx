"use client"

import { AppRouter } from "@/components/app-router"
import { Veiculos } from "@/components/veiculos"

export default function VeiculosPage() {
  return (
    <AppRouter requiredPermission="verVeiculos">
      <Veiculos />
    </AppRouter>
  )
}
