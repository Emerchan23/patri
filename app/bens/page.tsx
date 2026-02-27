"use client"

import { AppRouter } from "@/components/app-router"
import { BensList } from "@/components/bens-list"

export default function BensPage() {
  return (
    <AppRouter>
      <BensList />
    </AppRouter>
  )
}
