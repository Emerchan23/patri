"use client"

import { AppRouter } from "@/components/app-router"
import { CadastroForm } from "@/components/cadastro-form"

export default function CadastroPage() {
  return (
    <AppRouter requiredPermission="cadastrarBem">
      <CadastroForm />
    </AppRouter>
  )
}
