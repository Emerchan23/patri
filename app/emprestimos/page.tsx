"use client"

import { AppRouter } from "@/components/app-router"
import { Emprestimos } from "@/components/emprestimos"

export default function EmprestimosPage() {
  return (
    <AppRouter requiredPermission="gerenciarEmprestimos">
      <Emprestimos />
    </AppRouter>
  )
}
