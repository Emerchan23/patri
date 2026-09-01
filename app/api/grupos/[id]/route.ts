import { NextResponse } from "next/server"
import { execute, query } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { nome } = body

    if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 })

    // Update references in bens table first (since we store the name there currently)
    // We update 'bens' where 'grupo' matches the OLD name of the group
    await execute(`
        UPDATE bens 
        SET grupo = ? 
        WHERE grupo = (SELECT nome FROM grupos WHERE id = ?)
    `, [nome, id])
    
    // Then update the group itself
    await execute("UPDATE grupos SET nome = ? WHERE id = ?", [nome, id])
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
  
    // Get group name
    const existing = (await query("SELECT nome FROM grupos WHERE id = ?", [id])) as any[]
    if (!existing.length) {
        return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 })
    }
    const nome = existing[0].nome

    // Check usage in Assets
    const usage = (await query(
        "SELECT COUNT(*) as count FROM bens WHERE grupo = ?", 
        [nome]
    )) as any[]
    
    if (usage.length && usage[0].count > 0) {
        return NextResponse.json({ 
        error: `Não é possível excluir o grupo "${nome}" pois ele possui ${usage[0].count} bem(ns) vinculado(s).` 
        }, { status: 400 })
    }
    
    await execute("DELETE FROM grupos WHERE id = ?", [id])
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao excluir" }, { status: 500 })
  }
}
