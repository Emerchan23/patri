import { NextResponse } from "next/server"
import { execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"

export const DELETE = withAuth(async (req: Request, { params }: { user: any, params?: Record<string, string> }) => {
  if (!params?.id) return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  const id = params.id
  
  // Check usage
  // Se quisermos impedir deleção de grupos em uso:
  // const usage = await query("SELECT COUNT(*) as count FROM bens WHERE grupo = (SELECT nome FROM grupos WHERE id = ?)", [id])
  
  // Mas como o usuário quer poder remover grupos errados, vamos permitir.
  // O ideal seria atualizar os bens para 'Geral' ou NULL.
  
  await execute("UPDATE bens SET grupo = 'Geral' WHERE grupo = (SELECT nome FROM grupos WHERE id = ?)", [id])
  await execute("DELETE FROM grupos WHERE id = ?", [id])
  
  return NextResponse.json({ success: true })
})

export const PUT = withAuth(async (req: Request, { params }: { user: any, params?: Record<string, string> }) => {
    if (!params?.id) return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    const id = params.id
    const body = await req.json()
    const { nome } = body

    if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 })

    // Update references in bens table first (since we store the name there currently)
    // We need to get old name first
    // This is a bit tricky with race conditions but acceptable for this scope.
    
    // Better approach:
    // 1. Get old name
    // 2. Update groups table
    // 3. Update bens table
    
    /* 
       Note: Ideally 'bens' should store 'grupo_id', but we are maintaining compatibility.
       So we update the string in 'bens' too.
    */
    
    try {
        await execute(`
            UPDATE bens 
            SET grupo = ? 
            WHERE grupo = (SELECT nome FROM grupos WHERE id = ?)
        `, [nome, id])
        
        await execute("UPDATE grupos SET nome = ? WHERE id = ?", [nome, id])
        
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
    }
})
