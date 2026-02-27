"use client"

import { AppRouter } from "@/components/app-router"
import { AuditLogs } from "@/components/audit-logs"

export default function LogsPage() {
  return (
    <AppRouter requiredPermission="gerenciarUsuarios">
      <AuditLogs />
    </AppRouter>
  )
}
