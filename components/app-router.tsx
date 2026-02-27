"use client"

import React from "react"

import { useAuth } from "@/lib/auth-context"
import { LoginPage } from "./login"
import { AppShell } from "./app-shell"
import type { Permissions } from "@/lib/auth"
import { Shield } from "lucide-react"

interface AppRouterProps {
  children: React.ReactNode
  requiredPermission?: keyof Permissions
}

export function AppRouter({ children, requiredPermission }: AppRouterProps) {
  const { isAuthenticated, hasPermission, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Shield className="h-7 w-7 text-primary-foreground animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 mb-4">
            <svg
              className="h-8 w-8 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m0 0v2m0-2h2m-2 0H10m5-7V7a5 5 0 00-10 0v4a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">Acesso Restrito</h2>
          <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
            Voce nao tem permissao para acessar esta pagina.
            Entre em contato com o administrador do sistema.
          </p>
        </div>
      </AppShell>
    )
  }

  return <AppShell>{children}</AppShell>
}
