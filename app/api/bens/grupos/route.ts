import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"

export const GET = withAuth(async () => {
  const rows = await query<{ grupo: string }>(
    "SELECT DISTINCT grupo FROM bens WHERE grupo IS NOT NULL AND grupo != '' ORDER BY grupo"
  )
  return NextResponse.json(rows.map((row) => row.grupo))
})
