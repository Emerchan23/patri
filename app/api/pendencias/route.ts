import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { verifyAuth } from "@/lib/api-auth"

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  // Bens sem plaqueta
  const semPlaqueta: any = await query(
    "SELECT id, descricao, numero_patrimonio, secretaria, departamento, sala, estado FROM bens WHERE (numero_patrimonio IS NULL OR numero_patrimonio = '') AND status = 'ativo'"
  )

  // Bens sem localizacao
  const semLocal: any = await query(
    "SELECT id, descricao, numero_patrimonio, secretaria, departamento, sala, estado FROM bens WHERE (secretaria IS NULL OR secretaria = '' OR departamento IS NULL OR departamento = '') AND status = 'ativo'"
  )

  // Bens em mau estado
  const mauEstado: any = await query(
    "SELECT id, descricao, numero_patrimonio, secretaria, departamento, sala, estado FROM bens WHERE estado IN ('ruim', 'inservivel') AND status = 'ativo'"
  )

  // Emprestimos atrasados
  const atrasados: any = await query(
    "SELECT id, bem_descricao, responsavel, data_emprestimo, data_devolucao_prevista FROM emprestimos WHERE status = 'ativo' AND data_devolucao_prevista < CURDATE()"
  )

  return NextResponse.json({
    semPlaqueta,
    semLocal,
    mauEstado,
    atrasados,
    totals: {
      semPlaqueta: semPlaqueta.length,
      semLocal: semLocal.length,
      mauEstado: mauEstado.length,
      atrasados: atrasados.length,
    }
  })
}
