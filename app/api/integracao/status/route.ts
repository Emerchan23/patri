import { NextResponse } from "next/server"
import { hasActiveApiKey } from "@/lib/route-security"

export async function GET() {
  return NextResponse.json({ error: "Metodo nao permitido" }, { status: 405 })
}

export async function POST(request: Request) {
  if (!(await hasActiveApiKey(request))) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
  }

  return NextResponse.json({ 
    status: "online", 
    service: "sis-patrimonio-integracao",
    timestamp: new Date().toISOString()
  })
}
