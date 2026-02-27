"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { getPermissions, type User, type Permissions } from "./auth"

interface AuthContextType {
  user: User | null
  permissions: Permissions | null
  login: (email: string, senha: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  isAuthenticated: boolean
  hasPermission: (permission: keyof Permissions) => boolean
  isLoading: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

// Convert API user response to the User interface used by the frontend
function apiUserToUser(apiUser: Record<string, unknown>): User {
  return {
    id: String(apiUser.id),
    nome: apiUser.nome as string,
    email: apiUser.email as string,
    senha: "", // never sent from API
    cargo: apiUser.cargo as string,
    role: apiUser.role as User["role"],
    ativo: apiUser.ativo as boolean,
    avatar: apiUser.avatar as string,
    unidade: apiUser.unidade as User["unidade"],
    secretariasGerenciadas: apiUser.secretariasGerenciadas as string[] | undefined,
    criadoEm: apiUser.criadoEm as string,
    ultimoAcesso: apiUser.ultimoAcesso as string | undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check session on mount via /api/auth/me
  const checkSession = useCallback(async () => {
    // Se ja estiver logado, nao precisa verificar novamente
    if (user) {
        setIsLoading(false)
        return
    }

    try {
      const res = await fetch("/api/auth/me", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setUser(apiUserToUser(data.user))
      } else {
        // Se falhar (401), apenas define null, sem limpar nada agressivamente
        // Apenas se user era diferente de null
        if (user !== null) setUser(null)
      }
    } catch {
        if (user !== null) setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  const permissions = user ? getPermissions(user.role) : null

  const login = useCallback(async (email: string, senha: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, senha }),
      })

      const data = await res.json()

      if (!res.ok) {
        return { success: false, error: data.error || "Erro ao fazer login" }
      }

      setUser(apiUserToUser(data.user))
      return { success: true }
    } catch {
      return { success: false, error: "Erro de conexao com o servidor" }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })
    } catch {
      // Ignore errors, clear local state regardless
    }
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    await checkSession()
  }, [checkSession])

  const checkPermission = useCallback(
    (permission: keyof Permissions) => {
      if (!permissions) return false
      return permissions[permission]
    },
    [permissions]
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        login,
        logout,
        isAuthenticated: !!user,
        hasPermission: checkPermission,
        isLoading,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
