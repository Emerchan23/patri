type DbExecutor = {
  execute: (sql: string, params?: unknown[]) => Promise<[any, any]>
}

interface RegistrarMovimentacaoPayload {
  assetId?: string | number | null
  assetDescricao: string
  patrimonio: string
  de?: {
    secretaria?: string | null
    departamento?: string | null
    sala?: string | null
  } | null
  para?: {
    secretaria?: string | null
    departamento?: string | null
    sala?: string | null
  } | null
  responsavel: string
  motivo: string
  data?: string | Date | null
}

async function runExecute(executor: DbExecutor, sql: string, params: unknown[]) {
  const [result] = await executor.execute(sql, params)
  return result as { insertId?: number }
}

export async function registrarMovimentacaoInterna(
  executor: DbExecutor,
  payload: RegistrarMovimentacaoPayload
) {
  const insertResult = await runExecute(
    executor,
    `INSERT INTO movimentacoes (bem_id, bem_descricao, patrimonio, de_secretaria, de_departamento, de_sala,
      para_secretaria, para_departamento, para_sala, responsavel, data, motivo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.assetId || null,
      payload.assetDescricao,
      payload.patrimonio,
      payload.de?.secretaria || null,
      payload.de?.departamento || null,
      payload.de?.sala || null,
      payload.para?.secretaria || null,
      payload.para?.departamento || null,
      payload.para?.sala || null,
      payload.responsavel,
      payload.data || new Date(),
      payload.motivo,
    ]
  )

  if (payload.assetId) {
    await runExecute(
      executor,
      `UPDATE bens
          SET localizacao_secretaria = ?, localizacao_departamento = ?, localizacao_sala = ?
        WHERE id = ?`,
      [
        payload.para?.secretaria || null,
        payload.para?.departamento || null,
        payload.para?.sala || null,
        payload.assetId,
      ]
    )
  }

  return {
    insertId: Number(insertResult.insertId || 0),
  }
}
