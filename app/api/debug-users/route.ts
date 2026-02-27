import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const rows = await query("SELECT id, nome, email, role FROM usuarios")
    return NextResponse.json(rows)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
