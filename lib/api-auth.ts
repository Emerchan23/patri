import { NextResponse } from "next/server"
import { getAuthUserFromRequest, type ScopedDbUser } from "./auth-utils"
import type { Permissions, UserRole } from "./auth"
import { getPermissions } from "./auth"

export type AuthenticatedRequest = Request & {
  user: ScopedDbUser
}

type ApiHandler = (
  request: Request,
  context: { user: ScopedDbUser; params?: Record<string, string> }
) => Promise<NextResponse>

export function withAuth(handler: ApiHandler) {
  return async (request: Request, routeContext?: { params?: Promise<Record<string, string>> }) => {
    try {
      const user = await getAuthUserFromRequest(request)
      if (!user) {
        return NextResponse.json({ error: "Nao autenticado" }, { status: 401 })
      }

      const resolvedParams = routeContext?.params ? await routeContext.params : undefined

      return handler(request, { user, params: resolvedParams })
    } catch (error) {
      console.error("Auth middleware error:", error)
      return NextResponse.json({ error: "Erro interno de autenticacao" }, { status: 500 })
    }
  }
}

export function withPermission(permission: keyof Permissions, handler: ApiHandler) {
  return withAuth(async (request, context) => {
    const userRole = context.user.role as UserRole
    const perms = context.user.permissions || getPermissions(userRole, context.user.permissionOverrides)

    if (!perms[permission]) {
      return NextResponse.json({ error: "Sem permissao para esta acao" }, { status: 403 })
    }

    return handler(request, context)
  })
}

export function withRole(roles: UserRole[], handler: ApiHandler) {
  return withAuth(async (request, context) => {
    if (!roles.includes(context.user.role as UserRole)) {
      return NextResponse.json({ error: "Sem permissao para esta acao" }, { status: 403 })
    }

    return handler(request, context)
  })
}

export async function verifyAuth(request: Request) {
  return getAuthUserFromRequest(request)
}
