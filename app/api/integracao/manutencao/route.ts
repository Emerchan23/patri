import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { registrarLog } from "@/lib/audit"
import { hasActiveApiKey, maskSecret } from "@/lib/route-security"

// POST /api/integracao/manutencao
// Recebe: { "numeroPatrimonio": "123", "numeroOS": "OS-2025-001", "status": "em_manutencao" | "ativo" }
export async function POST(request: Request) {
  try {
    const apiKeyIsValid = await hasActiveApiKey(request)
    if (!apiKeyIsValid) {
      const receivedKey = request.headers.get("x-api-key")
      console.warn("[Integracao] Rejeitado por API key ausente/invalida", {
        hasKey: Boolean(receivedKey),
        keyPreview: receivedKey ? maskSecret(receivedKey) : undefined,
      })
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { numeroPatrimonio, numeroOS, status } = body

    if (!numeroPatrimonio) {
      return NextResponse.json({ error: "Numero do patrimonio obrigatorio" }, { status: 400 })
    }
    
    // Status default para manter compatibilidade
    const targetStatus = status || 'em_manutencao'
    
    // Validação de status permitidos para integração
    if (targetStatus !== 'em_manutencao' && targetStatus !== 'ativo') {
        return NextResponse.json({ error: "Status invalido. Use 'em_manutencao' ou 'ativo'." }, { status: 400 })
    }

    console.log(`[Integracao] Recebida notificacao. Pat: ${numeroPatrimonio}, OS: ${numeroOS}, Status Alvo: ${targetStatus}`)

    const numeroOriginal = String(numeroPatrimonio).trim()
    const numeroUpper = numeroOriginal.toUpperCase()
    
    // Tenta extrair apenas a parte numérica para buscas flexíveis
    // Ex: "PAT-00123" -> 123
    // Ex: "000456" -> 456
    const matchNumerico = numeroOriginal.match(/(\d+)/)
    let numeroPuro = null
    
    // Se o input já for puramente numérico, usamos ele.
    // Se for alfanumérico, extraímos o primeiro grupo de dígitos.
    if (matchNumerico) {
        // Remove zeros a esquerda para garantir match (123 deve bater com 00123)
        numeroPuro = String(parseInt(matchNumerico[0], 10))
    }

    console.log(`[Integracao] Buscando bem. Original: "${numeroOriginal}", Puro: "${numeroPuro}"`)

    // Construção da query dinâmica
    let queryParams: any[] = []
    let whereClauses: string[] = []

    // 1. Busca Exata (prioridade máxima)
    whereClauses.push("patrimonio = ?")
    queryParams.push(numeroOriginal)
    
    whereClauses.push("patrimonio_provisorio = ?")
    queryParams.push(numeroOriginal)

    // 2. Busca pelo número puro (se existir)
    if (numeroPuro) {
        // Termina com o número puro precedido de separador (hífen, barra, espaço)
        // Ex: PAT-123, PAT/123, PAT 123
        whereClauses.push("patrimonio LIKE ?")
        queryParams.push(`%-${numeroPuro}`)
        
        whereClauses.push("patrimonio LIKE ?")
        queryParams.push(`%/${numeroPuro}`)

        whereClauses.push("patrimonio LIKE ?")
        queryParams.push(`% ${numeroPuro}`)

        // Busca onde o patrimonio CONTÉM o número puro formatado com zeros a esquerda (ex: entrada 123, banco 00123)
        // Isso é perigoso pois 123 pode dar match em 1123. Vamos evitar contains genérico.
        // Vamos tentar match exato do número puro no campo patrimonio (caso o banco tenha guardado só o número)
        whereClauses.push("patrimonio = ?")
        queryParams.push(numeroPuro)

        // Tenta encontrar com zeros a esquerda (até 6 digitos é comum)
        // Ex: numeroPuro = 66 -> busca 000066, 00066, etc
        const p6 = numeroPuro.padStart(6, '0')
        const p5 = numeroPuro.padStart(5, '0')
        const p4 = numeroPuro.padStart(4, '0')
        const p3 = numeroPuro.padStart(3, '0')
        
        whereClauses.push("patrimonio = ?")
        queryParams.push(p6)
        
        whereClauses.push("patrimonio = ?")
        queryParams.push(p5)

        whereClauses.push("patrimonio = ?")
        queryParams.push(p4)

        whereClauses.push("patrimonio = ?")
        queryParams.push(p3)

        // Idem para provisório
        whereClauses.push("patrimonio_provisorio LIKE ?")
        queryParams.push(`%-${numeroPuro}`)
    }

    const sql = `SELECT * FROM bens WHERE ${whereClauses.join(" OR ")}`
    
    const bens = await query<any>(sql, queryParams)

    // Filtragem e Rankeamento de Resultados
    // Se vier mais de um, precisamos decidir qual é o melhor match.
    // Prioridade:
    // 1. Match exato de string
    // 2. Match de número puro exato
    // 3. Match de sufixo
    
    let bemEncontrado = null

    if (bens.length === 1) {
        bemEncontrado = bens[0]
    } else if (bens.length > 1) {
        // Tenta achar match exato
        const exato = bens.find((b: any) => b.patrimonio === numeroOriginal || b.patrimonio_provisorio === numeroOriginal)
        if (exato) {
            bemEncontrado = exato
        } else {
             // Se não tiver exato, tenta match de número puro
             if (numeroPuro) {
                 // Tenta encontrar aquele que termina exatamente com o número puro
                 // Ex: PAT-123 (match) vs PAT-1123 (no match)
                 // A query SQL com LIKE %-123 já filtrou 1123 se usou o hífen.
                 // Mas vamos garantir.
                 const peloSufixo = bens.find((b: any) => {
                     const pat = b.patrimonio || ""
                     const prov = b.patrimonio_provisorio || ""
                     const n = String(numeroPuro)
                     
                     // Verificações mais agressivas
                     // 1. Termina com o número
                     if (pat.endsWith(n) || prov.endsWith(n)) return true
                     
                     // 2. Contém o número (cuidado com falso positivo 166 contém 66)
                     // Mas se a busca SQL já filtrou, aqui é só desempate
                     
                     // 3. É igual ao número com zeros a esquerda
                     if (parseInt(pat) === parseInt(n)) return true
                     
                     return pat.endsWith(`-${n}`) || 
                            pat.endsWith(`/${n}`) || 
                            pat.endsWith(` ${n}`) ||
                            prov.endsWith(`-${n}`)
                 })
                 if (peloSufixo) bemEncontrado = peloSufixo
             }
        }
    }
    
    if (!bemEncontrado && bens.length > 0) {
         // Se não conseguiu desempatar, pega o primeiro (fallback) ou retorna erro?
         // Melhor retornar erro de ambiguidade se realmente não tiver certeza.
         // Mas para integração, as vezes é melhor tentar.
         // Vamos retornar erro se não tiver certeza.
         console.log(`[Integracao] Ambiguidade na busca. Encontrados: ${bens.length}`)
          return NextResponse.json({ 
            error: "Multiplos bens encontrados. Forneca o numero completo."
          }, { status: 409 })
    }

    if (!bemEncontrado) {
      console.log(`[Integracao] Bem nao encontrado: ${numeroOriginal} (Puro: ${numeroPuro})`)
      return NextResponse.json({ error: "Bem nao encontrado com este numero" }, { status: 404 })
    }

    const bem = bemEncontrado
    console.log(`[Integracao] Bem identificado: ID ${bem.id}, Pat: ${bem.patrimonio}`)

    // Se já estiver no status desejado, apenas avisa
    if (bem.status === targetStatus) {
      return NextResponse.json({ 
        success: true, 
        message: `Bem ${bem.descricao} ja estava com status ${targetStatus}.`,
        bem: {
          id: bem.id,
          patrimonio: bem.patrimonio,
          status: targetStatus
        }
      })
    }

    // Atualiza status
    await execute(
      "UPDATE bens SET status = ? WHERE id = ?",
      [targetStatus, bem.id]
    )

    // Registra log
    // Usamos ID 0 ou 1 para sistema, ou deixamos null se o banco permitir (mas o log exige usuario)
    // Vamos usar um usuário "Sistema" fictício nos dados
    await registrarLog({
      acao: "manutencao_integracao",
      descricao: `Status alterado para ${targetStatus} via Integracao (OS: ${numeroOS || 'N/A'})`,
      usuarioId: 1, // Assume admin inicial ou sistema
      usuarioNome: "Integracao Manutencao",
      usuarioRole: "administrador",
      entidadeTipo: "bem",
      entidadeId: String(bem.id),
      entidadeDescricao: bem.descricao,
      dadosAnteriores: { status: bem.status },
      dadosNovos: { status: targetStatus, os: numeroOS }
    })

    console.log(`[Integracao] Sucesso: Bem ${bem.id} atualizado para ${targetStatus}`)

    return NextResponse.json({ 
      success: true, 
      message: `Bem ${bem.descricao} (${bem.patrimonio}) atualizado para ${targetStatus}`,
      bem: {
        id: bem.id,
        patrimonio: bem.patrimonio,
        status: targetStatus
      }
    })

  } catch (error) {
    console.error("Erro na integracao de manutencao:", error)
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 })
  }
}
