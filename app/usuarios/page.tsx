"use client"

import { AppRouter } from "@/components/app-router"
import { AdminUsuarios } from "@/components/admin-usuarios"

export default function UsuariosPage() {
  return (
    <AppRouter requiredPermission="gerenciarUsuarios">
      <AdminUsuarios />
    </AppRouter>
  )
}
