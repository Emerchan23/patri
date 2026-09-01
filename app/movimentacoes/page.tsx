"use client"

import { AppRouter } from "@/components/app-router"
import { Movimentacoes } from "@/components/movimentacoes"

export default function MovimentacoesPage() {
  return (
    <AppRouter requiredPermission="acessarMovimentacoes">
      <Movimentacoes />
    </AppRouter>
  )
}
