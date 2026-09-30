import { queryOne } from "@/lib/db"

const requiredColumns = [
  "id",
  "nome",
  "cnpj",
  "cnpj_normalizado",
  "nome_fantasia",
  "razao_social",
  "estado",
  "cidade",
  "telefone",
  "endereco",
]

export async function mobileSupplierSchemaReady() {
  const [columns, uniqueDocumentIndex, normalizedColumn] = await Promise.all([
    queryOne<{ total: number | string }>(
      `SELECT COUNT(DISTINCT COLUMN_NAME) AS total
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'fornecedores'
          AND COLUMN_NAME IN (${requiredColumns.map(() => "?").join(",")})`,
      requiredColumns,
    ),
    queryOne<{ total: number | string }>(
      `SELECT COUNT(*) AS total FROM (
         SELECT INDEX_NAME
           FROM INFORMATION_SCHEMA.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fornecedores'
          GROUP BY INDEX_NAME
          HAVING COUNT(*) = 1
             AND SUM(NON_UNIQUE) = 0
             AND MAX(COLUMN_NAME = 'cnpj_normalizado') = 1
             AND MAX(SUB_PART IS NULL) = 1
       ) AS unique_document_indexes`,
    ),
    queryOne<{ generation_expression: string; extra: string }>(
      `SELECT GENERATION_EXPRESSION AS generation_expression, EXTRA AS extra
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'fornecedores'
          AND COLUMN_NAME = 'cnpj_normalizado'
        LIMIT 1`,
    ),
  ])
  return Number(columns?.total) === requiredColumns.length &&
    Number(uniqueDocumentIndex?.total) > 0 &&
    String(normalizedColumn?.generation_expression ?? "")
      .toUpperCase()
      .includes("REGEXP_REPLACE") &&
    String(normalizedColumn?.extra ?? "").toUpperCase().includes("GENERATED")
}

export function normalizeSupplierDocument(value: unknown) {
  return String(value ?? "").replace(/\D/g, "")
}

export function validateMobileSupplier(body: Record<string, unknown>) {
  const nome = String(body.nome ?? "").trim()
  const documento = String(body.cnpj ?? body.documento ?? "").trim()
  const normalizedDocument = normalizeSupplierDocument(documento)
  const estado = String(body.estado ?? "").trim().toUpperCase()

  if (nome.length < 2 || nome.length > 255) {
    return { error: "Informe o nome/razão social (2 a 255 caracteres)." }
  }
  if (![11, 14].includes(normalizedDocument.length)) {
    return { error: "Informe CPF ou CNPJ com 11 ou 14 dígitos." }
  }
  if (estado && !/^[A-Z]{2}$/.test(estado)) {
    return { error: "Informe a UF com duas letras." }
  }

  const optional = (key: string, max: number) => {
    const value = String(body[key] ?? "").trim()
    return { value: value || null, valid: value.length <= max }
  }
  const nomeFantasia = optional("nome_fantasia", 255)
  const razaoSocial = optional("razao_social", 255)
  const cidade = optional("cidade", 100)
  const telefone = optional("telefone", 50)
  const endereco = optional("endereco", 2000)
  if (
    [nomeFantasia, razaoSocial, cidade, telefone, endereco].some(
      (field) => !field.valid,
    )
  ) {
    return { error: "Um ou mais campos excedem o tamanho permitido." }
  }

  return {
    data: {
      nome,
      documento: normalizedDocument,
      normalizedDocument,
      nomeFantasia: nomeFantasia.value ?? nome,
      razaoSocial: razaoSocial.value,
      estado: estado || null,
      cidade: cidade.value,
      telefone: telefone.value,
      endereco: endereco.value,
    },
  }
}
