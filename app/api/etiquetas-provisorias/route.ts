import { NextResponse } from "next/server"
import { query, withTransaction } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { ensureEtiquetasSchema } from "@/lib/etiquetas-schema"
import { analyzeEtiquetaRealignment, getEtiquetaSequenceInfo } from "@/lib/etiquetas-sequence"

function formatEtiquetaCode(ano: string, seq: number) {
  return `PROV-${ano}-${String(seq).padStart(5, "0")}`
}

function buildRangeCodes(ano: string, seqInicial: number, seqFinal: number) {
  return Array.from({ length: seqFinal - seqInicial + 1 }, (_, index) => {
    const seq = seqInicial + index
    return {
      seq,
      codigo: formatEtiquetaCode(ano, seq),
    }
  })
}

export const GET = withAuth(async (request) => {
  await ensureEtiquetasSchema()
  const url = new URL(request.url)
  const status = url.searchParams.get("status")
  const loteId = Number(url.searchParams.get("loteId") || 0)

  if (loteId) {
    const tags = await query<any>(
      `SELECT id, codigo, status, observacao, emenda_parlamentar
         FROM etiquetas_provisorias
        WHERE lote_id = ?
          AND status IN ('reservada', 'em_uso', 'disponivel')
        ORDER BY codigo ASC`,
      [loteId]
    )

    return NextResponse.json({ data: tags })
  }

  let sql = `
    SELECT l.*,
           COALESCE(SUM(CASE WHEN e.status = 'usada' THEN 1 ELSE 0 END), 0) as usadas,
           COALESCE(SUM(CASE WHEN e.status IN ('reservada', 'em_uso', 'disponivel') THEN 1 ELSE 0 END), 0) as pendentes,
           COALESCE(SUM(CASE WHEN e.status = 'disponivel_para_reuso' THEN 1 ELSE 0 END), 0) as reutilizaveis
      FROM etiquetas_provisorias_lotes l
      LEFT JOIN etiquetas_provisorias e ON e.lote_id = l.id
  `
  const params: unknown[] = []
  if (status && status !== "pendentes") {
    sql += " WHERE l.status = ?"
    params.push(status)
  }
  sql += " GROUP BY l.id"
  if (status === "pendentes") {
    sql += " HAVING pendentes > 0"
  }
  sql += " ORDER BY l.criado_em DESC"

  const lotes = await query<any>(sql, params)
  return NextResponse.json({ data: lotes })
})

export const POST = withAuth(async (request, { user }) => {
  await ensureEtiquetasSchema()
  const body = await request.json()
  const { quantidade, ano, observacao, emendaParlamentar } = body
  const mode = body.mode === "faixa" ? "faixa" : "automatico"

  const currentYear = ano || new Date().getFullYear().toString()

  try {
    if (mode === "faixa") {
      const seqInicial = Number(body.seqInicial)
      const seqFinalRaw = body.seqFinal !== undefined && body.seqFinal !== null && body.seqFinal !== ""
        ? Number(body.seqFinal)
        : null
      const quantidadeFaixaRaw = body.quantidade !== undefined && body.quantidade !== null && body.quantidade !== ""
        ? Number(body.quantidade)
        : null
      const strict = body.strict !== false

      if (!seqInicial || seqInicial < 1) {
        return NextResponse.json({ error: "Numero inicial invalido" }, { status: 400 })
      }

      let seqFinal = seqFinalRaw
      let quantidadeFaixa = quantidadeFaixaRaw

      if (seqFinal && seqFinal >= seqInicial) {
        quantidadeFaixa = seqFinal - seqInicial + 1
      } else if (quantidadeFaixa && quantidadeFaixa > 0) {
        seqFinal = seqInicial + quantidadeFaixa - 1
      } else {
        return NextResponse.json({ error: "Informe a quantidade ou o numero final da faixa" }, { status: 400 })
      }

      if (!seqFinal || seqFinal < seqInicial || !quantidadeFaixa || quantidadeFaixa < 1) {
        return NextResponse.json({ error: "Faixa informada invalida" }, { status: 400 })
      }

      const rangeCodes = buildRangeCodes(currentYear, seqInicial, seqFinal)
      const codeList = rangeCodes.map((item) => item.codigo)

      const etiquetaRows = await query<{ codigo: string; status: string }>(
        `SELECT codigo, status
           FROM etiquetas_provisorias
          WHERE codigo IN (${codeList.map(() => "?").join(",")})`,
        codeList
      )
      const assetRows = await query<{ codigo: string }>(
        `SELECT patrimonio as codigo
           FROM bens
          WHERE patrimonio IN (${codeList.map(() => "?").join(",")})
          UNION
         SELECT patrimonio_provisorio as codigo
           FROM bens
          WHERE patrimonio_provisorio IN (${codeList.map(() => "?").join(",")})`,
        [...codeList, ...codeList]
      )

      const etiquetaMap = new Map(etiquetaRows.map((row) => [row.codigo, row.status]))
      const assetCodeSet = new Set(assetRows.map((row) => row.codigo).filter(Boolean))
      const livres: string[] = []
      const reaproveitaveis: string[] = []
      const bloqueados: Array<{ codigo: string; motivo: string }> = []

      for (const { codigo } of rangeCodes) {
        if (assetCodeSet.has(codigo)) {
          bloqueados.push({ codigo, motivo: "Vinculado a bem patrimonial" })
          continue
        }

        const statusAtual = etiquetaMap.get(codigo)
        if (!statusAtual) {
          livres.push(codigo)
          continue
        }

        if (statusAtual === "cancelada" || statusAtual === "disponivel_para_reuso") {
          reaproveitaveis.push(codigo)
          continue
        }

        bloqueados.push({ codigo, motivo: `Ja esta ${statusAtual}` })
      }

      if (strict && bloqueados.length > 0) {
        return NextResponse.json(
          {
            error: "A faixa escolhida possui numeros bloqueados e nao pode ser reservada no modo estrito.",
            conflitos: bloqueados,
            faixaInicial: rangeCodes[0]?.codigo || null,
            faixaFinal: rangeCodes[rangeCodes.length - 1]?.codigo || null,
            countReservadas: 0,
          },
          { status: 409 }
        )
      }

      const result = await withTransaction(async (connection) => {
        const generatedTags: Array<{ codigo: string; emendaParlamentar: string | null; observacao: string | null }> = []

        if (reaproveitaveis.length > 0) {
          await connection.execute(
            `UPDATE etiquetas_provisorias
                SET status = 'reservada',
                    observacao = ?,
                    emenda_parlamentar = ?,
                    reservado_por_usuario_id = ?,
                    reservado_por_nome = ?,
                    cancelado_em = NULL,
                    usado_em = NULL
              WHERE codigo IN (${reaproveitaveis.map(() => "?").join(",")})`,
            [observacao || null, emendaParlamentar || null, user.id, user.nome, ...reaproveitaveis]
          )
        }

        for (const codigo of livres) {
          await connection.execute(
            `INSERT INTO etiquetas_provisorias
              (codigo, status, observacao, emenda_parlamentar, reservado_por_usuario_id, reservado_por_nome)
             VALUES (?, 'reservada', ?, ?, ?, ?)`,
            [codigo, observacao || null, emendaParlamentar || null, user.id, user.nome]
          )
        }

        for (const codigo of [...reaproveitaveis, ...livres].sort()) {
          generatedTags.push({
            codigo,
            emendaParlamentar: emendaParlamentar || null,
            observacao: observacao || null,
          })
        }

        const [lotResult] = await connection.execute(
          `INSERT INTO etiquetas_provisorias_lotes
            (ano, quantidade, origem_reserva, faixa_inicial, faixa_final, status, observacao, emenda_parlamentar, criado_por_usuario_id, criado_por_nome)
           VALUES (?, ?, 'faixa_manual', ?, ?, 'reservado', ?, ?, ?, ?)`,
          [
            currentYear,
            generatedTags.length,
            rangeCodes[0]?.codigo || formatEtiquetaCode(currentYear, seqInicial),
            rangeCodes[rangeCodes.length - 1]?.codigo || formatEtiquetaCode(currentYear, seqFinal),
            observacao || null,
            emendaParlamentar || null,
            user.id,
            user.nome,
          ]
        )

        const loteId = (lotResult as any).insertId
        if (generatedTags.length > 0) {
          await connection.execute(
            `UPDATE etiquetas_provisorias
                SET lote_id = ?
              WHERE codigo IN (${generatedTags.map(() => "?").join(",")})`,
            [loteId, ...generatedTags.map((tag) => tag.codigo)]
          )
        }

        return { loteId, generatedTags }
      })

      return NextResponse.json(
        {
          success: true,
          tags: result.generatedTags,
          loteId: result.loteId,
          count: result.generatedTags.length,
          countReservadas: result.generatedTags.length,
          faixaInicial: rangeCodes[0]?.codigo || null,
          faixaFinal: rangeCodes[rangeCodes.length - 1]?.codigo || null,
          conflitos: bloqueados,
          codigosReservados: result.generatedTags.map((tag) => tag.codigo),
        },
        { status: 201 }
      )
    }

    if (!quantidade || quantidade < 1) {
      return NextResponse.json({ error: "Quantidade invalida" }, { status: 400 })
    }

    const result = await withTransaction(async (connection) => {
      const generatedTags: Array<{ codigo: string; emendaParlamentar: string | null; observacao: string | null }> = []
      let firstCode = ""
      let lastCode = ""

      for (let i = 0; i < quantidade; i++) {
        const info = await getEtiquetaSequenceInfo(currentYear, connection)
        const codigo = info.formatted
        if (!firstCode) firstCode = codigo
        lastCode = codigo

        if (info.reuseCode) {
          await connection.execute(
            `UPDATE etiquetas_provisorias
                SET status = 'reservada',
                    observacao = ?,
                    emenda_parlamentar = ?,
                    reservado_por_usuario_id = ?,
                    reservado_por_nome = ?,
                    cancelado_em = NULL,
                    usado_em = NULL
              WHERE codigo = ?`,
            [observacao || null, emendaParlamentar || null, user.id, user.nome, info.reuseCode]
          )
        } else {
          await connection.execute(
            `INSERT INTO etiquetas_provisorias
              (codigo, status, observacao, emenda_parlamentar, reservado_por_usuario_id, reservado_por_nome)
             VALUES (?, 'reservada', ?, ?, ?, ?)`,
            [codigo, observacao || null, emendaParlamentar || null, user.id, user.nome]
          )
        }

        generatedTags.push({
          codigo,
          emendaParlamentar: emendaParlamentar || null,
          observacao: observacao || null,
        })
      }

      const [lotResult] = await connection.execute(
        `INSERT INTO etiquetas_provisorias_lotes
          (ano, quantidade, origem_reserva, faixa_inicial, faixa_final, status, observacao, emenda_parlamentar, criado_por_usuario_id, criado_por_nome)
         VALUES (?, ?, 'automatico', ?, ?, 'reservado', ?, ?, ?, ?)`,
        [currentYear, quantidade, firstCode, lastCode, observacao || null, emendaParlamentar || null, user.id, user.nome]
      )

      const loteId = (lotResult as any).insertId
      await connection.execute(
        `UPDATE etiquetas_provisorias
            SET lote_id = ?
          WHERE codigo IN (${generatedTags.map(() => "?").join(",")})`,
        [loteId, ...generatedTags.map((tag) => tag.codigo)]
      )

      return { loteId, generatedTags }
    })

    return NextResponse.json(
      {
        success: true,
        tags: result.generatedTags,
        count: result.generatedTags.length,
        loteId: result.loteId,
        countReservadas: result.generatedTags.length,
        faixaInicial: result.generatedTags[0]?.codigo || null,
        faixaFinal: result.generatedTags[result.generatedTags.length - 1]?.codigo || null,
        conflitos: [],
        codigosReservados: result.generatedTags.map((tag) => tag.codigo),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Erro ao gerar etiquetas:", error)
    return NextResponse.json({ error: "Erro ao gerar etiquetas" }, { status: 500 })
  }
})

export const PATCH = withAuth(async (request, { user }) => {
  await ensureEtiquetasSchema()
  const body = await request.json()
  const action = body.action

  if (!action) {
    return NextResponse.json({ error: "Acao obrigatoria" }, { status: 400 })
  }

  if (action === "cancelar_saldo") {
    const loteId = Number(body.loteId)
    if (!loteId) {
      return NextResponse.json({ error: "Lote obrigatorio" }, { status: 400 })
    }

    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE etiquetas_provisorias
            SET status = 'disponivel_para_reuso',
                cancelado_em = NOW()
          WHERE lote_id = ?
            AND status IN ('reservada', 'em_uso', 'disponivel')`,
        [loteId]
      )

      const [summaryRows] = await connection.execute(
        `SELECT
           SUM(CASE WHEN status = 'usada' THEN 1 ELSE 0 END) as usadas,
           SUM(CASE WHEN status IN ('reservada', 'em_uso', 'disponivel') THEN 1 ELSE 0 END) as pendentes
          FROM etiquetas_provisorias
         WHERE lote_id = ?`,
        [loteId]
      )
      const summary = (summaryRows as any[])[0] || {}
      const loteStatus = Number(summary.usadas || 0) > 0 ? "parcialmente_usado" : "cancelado"

      await connection.execute(
        `UPDATE etiquetas_provisorias_lotes SET status = ? WHERE id = ?`,
        [loteStatus, loteId]
      )
    })

    return NextResponse.json({ success: true })
  }

  if (action === "registrar_faixa_livre") {
    const ano = String(body.ano || new Date().getFullYear()).slice(0, 4)
    const seqInicial = Number(body.seqInicial)
    const seqFinal = Number(body.seqFinal)
    const observacao = body.observacao ? String(body.observacao) : null

    if (!seqInicial || !seqFinal || seqInicial < 1 || seqFinal < seqInicial) {
      return NextResponse.json({ error: "Faixa informada invalida" }, { status: 400 })
    }

    const codes = Array.from({ length: seqFinal - seqInicial + 1 }, (_, index) => {
      const seq = seqInicial + index
      return `PROV-${ano}-${String(seq).padStart(5, "0")}`
    })

    const existing = await query<{ codigo: string; status: string }>(
      `SELECT codigo, status
         FROM etiquetas_provisorias
        WHERE codigo IN (${codes.map(() => "?").join(",")})`,
      codes
    )
    const existingMap = new Map(existing.map((row) => [row.codigo, row.status]))

    let inserted = 0
    let updated = 0
    let skipped = 0

    await withTransaction(async (connection) => {
      for (const code of codes) {
        const currentStatus = existingMap.get(code)
        if (!currentStatus) {
          await connection.execute(
            `INSERT INTO etiquetas_provisorias
              (codigo, status, observacao, reservado_por_usuario_id, reservado_por_nome, cancelado_em)
             VALUES (?, 'disponivel_para_reuso', ?, ?, ?, NOW())`,
            [code, observacao || "Faixa livre registrada manualmente", null, user.nome]
          )
          inserted += 1
          continue
        }

        if (currentStatus === "cancelada" || currentStatus === "disponivel_para_reuso") {
          await connection.execute(
            `UPDATE etiquetas_provisorias
                SET status = 'disponivel_para_reuso',
                    observacao = ?,
                    cancelado_em = NOW()
              WHERE codigo = ?`,
            [observacao || "Faixa livre registrada manualmente", code]
          )
          updated += 1
          continue
        }

        skipped += 1
      }

      await connection.execute(
        `INSERT INTO etiquetas_provisorias_faixas_livres
          (ano, seq_inicial, seq_final, quantidade_registrada, observacao, criado_por_usuario_id, criado_por_nome)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ano, seqInicial, seqFinal, inserted + updated, observacao, user.id, user.nome]
      )
    })

    return NextResponse.json({ success: true, inserted, updated, skipped })
  }

  if (action === "realinhar_patrimonios") {
    const ano = String(body.ano || new Date().getFullYear()).slice(0, 4)
    const realignment = await analyzeEtiquetaRealignment(ano)

    await withTransaction(async (connection) => {
      if (realignment.source === "realinhamento_seguro" && realignment.smallestGapSeq) {
        await connection.execute(
          `INSERT INTO etiquetas_provisorias_sequence_settings
            (ano, proximo_numero_manual, origem_ajuste, atualizado_por_usuario_id, atualizado_por_nome)
           VALUES (?, ?, 'realinhamento_seguro', ?, ?)
           ON DUPLICATE KEY UPDATE
            proximo_numero_manual = VALUES(proximo_numero_manual),
            origem_ajuste = VALUES(origem_ajuste),
            atualizado_por_usuario_id = VALUES(atualizado_por_usuario_id),
            atualizado_por_nome = VALUES(atualizado_por_nome)`,
          [ano, realignment.smallestGapSeq, user.id, user.nome]
        )
      } else if (realignment.source === "sequencia_normal" || (realignment.source === "reuso" && !realignment.smallestGapSeq)) {
        await connection.execute(
          `INSERT INTO etiquetas_provisorias_sequence_settings
            (ano, proximo_numero_manual, origem_ajuste, atualizado_por_usuario_id, atualizado_por_nome)
           VALUES (?, NULL, NULL, ?, ?)
           ON DUPLICATE KEY UPDATE
            proximo_numero_manual = VALUES(proximo_numero_manual),
            origem_ajuste = VALUES(origem_ajuste),
            atualizado_por_usuario_id = VALUES(atualizado_por_usuario_id),
            atualizado_por_nome = VALUES(atualizado_por_nome)`,
          [ano, user.id, user.nome]
        )
      } else if (realignment.smallestGapSeq) {
        await connection.execute(
          `INSERT INTO etiquetas_provisorias_sequence_settings
            (ano, proximo_numero_manual, origem_ajuste, atualizado_por_usuario_id, atualizado_por_nome)
           VALUES (?, ?, 'realinhamento_seguro', ?, ?)
           ON DUPLICATE KEY UPDATE
            proximo_numero_manual = VALUES(proximo_numero_manual),
            origem_ajuste = VALUES(origem_ajuste),
            atualizado_por_usuario_id = VALUES(atualizado_por_usuario_id),
            atualizado_por_nome = VALUES(atualizado_por_nome)`,
          [ano, realignment.smallestGapSeq, user.id, user.nome]
        )
      }

      await connection.execute(
        `INSERT INTO etiquetas_provisorias_realinhamentos
          (ano, proximo_numero_aplicado, origem_resultado, lacunas_detectadas, reutilizaveis_encontrados, criado_por_usuario_id, criado_por_nome)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          ano,
          realignment.nextSeq,
          realignment.source,
          realignment.gapsDetected,
          realignment.reusableCount,
          user.id,
          user.nome,
        ]
      )
    })

    const refreshed = await getEtiquetaSequenceInfo(ano)
    return NextResponse.json({
      success: true,
      nextSeq: refreshed.nextSeq,
      formatted: refreshed.formatted,
      source: refreshed.source,
      gapsDetected: realignment.gapsDetected,
      reusableCount: realignment.reusableCount,
      summary: {
        nextSeq: refreshed.nextSeq,
        formatted: refreshed.formatted,
        source: refreshed.source,
        gapsDetected: realignment.gapsDetected,
        reusableCount: realignment.reusableCount,
      },
    })
  }

  return NextResponse.json({ error: "Acao nao suportada" }, { status: 400 })
})
