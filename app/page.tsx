"use client"

import { AppRouter } from "@/components/app-router"
import { Dashboard } from "@/components/dashboard"
import { DashboardAssistente } from "@/components/dashboard-assistente"
import { useAuth } from "@/lib/auth-context"

function DashboardSwitch() {
  const { user } = useAuth()
  if (user?.role === "assistente") {
    return <DashboardAssistente />
  }
  return <Dashboard />
}

export default function Home() {
  return (
    <AppRouter>
      <DashboardSwitch />
    </AppRouter>
  )
}
