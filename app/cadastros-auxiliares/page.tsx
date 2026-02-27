"use client"

import { AppRouter } from "@/components/app-router"
import { CadastrosAuxiliares } from "@/components/cadastros-auxiliares"

export default function CadastrosAuxiliaresPage() {
  return (
    <AppRouter requiredPermission="gerenciarCadastrosAuxiliares">
      <CadastrosAuxiliares />
    </AppRouter>
  )
}
