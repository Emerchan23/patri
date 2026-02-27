import { NextResponse } from "next/server"
import { queryOne, execute, query } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

// Ensure table exists (Auto-migration)
async function ensureTableExists() {
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        theme_color VARCHAR(50) DEFAULT 'blue',
        sidebar_color VARCHAR(50) DEFAULT 'dark',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    // Insert default if empty
    const count = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM system_settings")
    if (count && count.count === 0) {
        await execute("INSERT INTO system_settings (id, theme_color, sidebar_color) VALUES (1, 'blue', 'dark')")
    }
  } catch (error) {
    console.error("Erro ao verificar/criar tabela system_settings:", error)
  }
}

// GET /api/configuracoes/sistema
export const GET = withAuth(async () => {
  await ensureTableExists()
  
  const row = await queryOne<Record<string, unknown>>("SELECT * FROM system_settings LIMIT 1")
  if (!row) {
    return NextResponse.json({
      themeColor: "blue",
      sidebarColor: "dark"
    })
  }

  return NextResponse.json({
    themeColor: row.theme_color,
    sidebarColor: row.sidebar_color
  })
})

// PUT /api/configuracoes/sistema
export const PUT = withAuth(async (request, { user }) => {
  await ensureTableExists()
  const body = await request.json()

  const existing = await query<Record<string, unknown>>("SELECT * FROM system_settings LIMIT 1")

  if (existing.length > 0) {
    await execute(
      "UPDATE system_settings SET theme_color=?, sidebar_color=? WHERE id=?",
      [body.themeColor, body.sidebarColor, existing[0].id]
    )
  } else {
    await execute(
      "INSERT INTO system_settings (theme_color, sidebar_color) VALUES (?, ?)",
      [body.themeColor, body.sidebarColor]
    )
  }

  await registrarLog({
    acao: "edicao",
    descricao: "Configuracoes do sistema atualizadas",
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "configuracao",
    entidadeId: "sistema",
    entidadeDescricao: "Tema e Cores",
    dadosAnteriores: existing.length > 0 ? existing[0] : undefined,
    dadosNovos: body
  })

  return NextResponse.json({ success: true })
})
