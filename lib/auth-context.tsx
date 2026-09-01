"use client"

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import { getPermissions, resolveUserPermissionOverrides, type User, type Permissions } from "./auth"
import { onAuthExpired } from "./api-client"
import { useToast } from "@/components/ui/use-toast"

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
    departamentosAssistente: apiUser.departamentosAssistente as string[] | undefined,
    permissionOverrides: resolveUserPermissionOverrides({
      role: apiUser.role as User["role"],
      podeCadastrarBem: apiUser.podeCadastrarBem,
      podeCadastroProvisorioUnidade: apiUser.podeCadastroProvisorioUnidade,
      permissionOverrides: apiUser.permissionOverrides as User["permissionOverrides"] | undefined,
    }),
    permissions: apiUser.permissions as Permissions | undefined,
    criadoEm: apiUser.criadoEm as string,
    ultimoAcesso: apiUser.ultimoAcesso as string | undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const checkSessionRunId = useRef(0)
  const loginInFlightRef = useRef(false)

  // Monitor auth expiration
  useEffect(() => {
    const unsubscribe = onAuthExpired(() => {
      // Only act if user is logged in to avoid multiple toasts/renders
      if (user) {
        setUser(null)
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente para continuar.",
          variant: "destructive",
        })
      }
    })
    return () => unsubscribe()
  }, [user, toast])

  // Check session on mount via /api/auth/me
  const checkSession = useCallback(async () => {
    const runId = ++checkSessionRunId.current

    try {
      if (loginInFlightRef.current) return
      const res = await fetch("/api/auth/me", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        if (runId === checkSessionRunId.current) {
          setUser(apiUserToUser(data.user))
        }
      } else {
        if (runId === checkSessionRunId.current) {
          setUser(null)
        }
      }
    } catch {
      if (runId === checkSessionRunId.current) {
        setUser(null)
      }
    } finally {
      if (runId === checkSessionRunId.current) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  const permissions = user ? (user.permissions || getPermissions(user.role, user.permissionOverrides)) : null

  const login = useCallback(async (email: string, senha: string) => {
    loginInFlightRef.current = true
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, senha }),
      })

      const data = await res.json()

      if (!res.ok) {
        loginInFlightRef.current = false
        return { success: false, error: data.error || "Erro ao fazer login" }
      }

      setUser(apiUserToUser(data.user))
      setIsLoading(false)
      loginInFlightRef.current = false
      return { success: true }
    } catch {
      loginInFlightRef.current = false
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
