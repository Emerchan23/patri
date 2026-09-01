"use client"

import { AppRouter } from "@/components/app-router"
import { CadastrosProvisoriosPage } from "@/components/cadastros-provisorios-page"

export default function CadastrosProvisoriosRoute() {
  return (
    <AppRouter requiredPermission="acessarCadastrosProvisorios">
      <CadastrosProvisoriosPage />
    </AppRouter>
  )
}
