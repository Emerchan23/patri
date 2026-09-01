import { NextRequest, NextResponse } from "next/server"
import { spawn, execSync } from "child_process"
import { writeFile, mkdir, readdir, cp, rm, stat } from "fs/promises"
import { createReadStream, existsSync } from "fs"
import path from "path"
import { randomUUID } from "crypto"

import { execute } from "@/lib/db"
import { ensureEtiquetasSchema } from "@/lib/etiquetas-schema"
import { ensureMovimentacaoSolicitacaoSchema } from "@/lib/movimentacao-solicitacao-schema"
import { ensureUserScopeSchema } from "@/lib/user-scope-schema"
import { ensureAssetLabelWorkflowSchema } from "@/lib/asset-label-workflow-schema"
import { withRole } from "@/lib/api-auth"

async function extractArchive(archivePath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tar = spawn("tar", ["-xzf", archivePath, "-C", destDir])
    let stderr = ""

    tar.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })

    tar.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`Tar extraction failed with code ${code}: ${stderr}`))
    })

    tar.on("error", reject)
  })
}

async function runPostRestorePatches(): Promise<void> {
  console.log("[RESTORE] Aplicando patches de schema pos-restore...")
  await execute(`
    ALTER TABLE bens
    ADD COLUMN IF NOT EXISTS emenda_parlamentar VARCHAR(255) DEFAULT NULL AFTER nota_fiscal_url
  `)
  await ensureEtiquetasSchema()
  await ensureMovimentacaoSolicitacaoSchema()
  await ensureUserScopeSchema()
  await ensureAssetLabelWorkflowSchema()
  console.log("[RESTORE] Patches de schema concluidos com sucesso.")
}

async function restoreDatabase(sqlPath: string): Promise<void> {
  const host = process.env.DB_HOST || "db"
  const user = process.env.DB_USER || "root"
  const password = process.env.DB_PASSWORD || "root"
  const database = process.env.DB_NAME || "sispatrimonio"

  console.log(`[RESTORE] Restaurando banco de dados a partir de ${sqlPath}`)

  const fileStats = await stat(sqlPath)
  if (fileStats.size === 0) {
    throw new Error("Arquivo SQL encontrado esta vazio (0 bytes).")
  }

  return new Promise((resolve, reject) => {
    const mysql = spawn("mysql", [
      `-h${host}`,
      `-u${user}`,
      `-p${password}`,
      "--skip-ssl",
      "--max_allowed_packet=1G",
      "--default-character-set=utf8mb4",
      "--init-command=SET FOREIGN_KEY_CHECKS=0;",
      database,
    ])

    const fileStream = createReadStream(sqlPath)
    fileStream.pipe(mysql.stdin)

    let stderr = ""
    mysql.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })

    mysql.on("close", async (code) => {
      if (code === 0) {
        console.log("[RESTORE] MySQL process exited successfully.")
        try {
          await runPostRestorePatches()
        } catch (patchErr) {
          console.error("[RESTORE] Erro nao critico ao aplicar patch de schema:", patchErr)
        }
        resolve()
        return
      }

      console.error(`[RESTORE] MySQL failed. Code: ${code}. Stderr: ${stderr}`)
      reject(new Error(`MySQL restore failed with code ${code || 1}: ${stderr}`))
    })

    mysql.on("error", (error) => {
      console.error("[RESTORE] MySQL spawn error:", error)
      reject(error)
    })

    fileStream.on("error", (error) => {
      console.error("[RESTORE] File read error:", error)
      reject(error)
    })
  })
}

async function findLargestSqlFile(rootDir: string): Promise<string | null> {
  const queue = [rootDir]
  let largestSqlPath: string | null = null
  let largestSize = -1

  while (queue.length > 0) {
    const currentDir = queue.shift()
    if (!currentDir) continue

    try {
      const entries = await readdir(currentDir)
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry)
        if (fullPath === rootDir) continue
        const entryStats = await stat(fullPath)
        if (entryStats.isDirectory()) {
          queue.push(fullPath)
          continue
        }
        if (entry.toLowerCase().endsWith(".sql") && entryStats.size > largestSize) {
          largestSize = entryStats.size
          largestSqlPath = fullPath
        }
      }
    } catch {}
  }

  if (largestSqlPath) {
    console.log(`[RESTORE] Maior arquivo SQL encontrado: ${largestSqlPath} (${largestSize} bytes)`)
  }

  return largestSqlPath
}

async function findUploadsDir(rootDir: string): Promise<string | null> {
  const directUploads = path.join(rootDir, "uploads")
  if (existsSync(directUploads)) return directUploads

  const queue = [rootDir]
  while (queue.length > 0) {
    const currentDir = queue.shift()
    if (!currentDir) continue

    try {
      const entries = await readdir(currentDir)
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry)
        const entryStats = await stat(fullPath)
        if (!entryStats.isDirectory()) continue
        if (entry === "uploads") return fullPath
        queue.push(fullPath)
      }
    } catch {}
  }

  return null
}

export const maxDuration = 300

export const POST = withRole(["administrador"], async (request) => {
  let tempDir = ""
  let uploadedFilePath = ""

  try {
    const contentType = request.headers.get("content-type") || ""
    console.log(`[RESTORE] Iniciando processo. Content-Type: ${contentType}`)

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const file = formData.get("file") as File | null
      if (!file) {
        return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
      }

      console.log(`[RESTORE] Arquivo recebido: ${file.name}, Tamanho: ${file.size}`)
      const buffer = Buffer.from(await file.arrayBuffer())
      tempDir = path.join(process.cwd(), "public", "restore_temp", randomUUID())
      await mkdir(tempDir, { recursive: true })

      const ext = file.name.endsWith(".tar.gz") || file.name.endsWith(".tgz") ? ".tar.gz" : ".sql"
      uploadedFilePath = path.join(tempDir, `upload${ext}`)
      await writeFile(uploadedFilePath, buffer)
    } else if (contentType.includes("application/json")) {
      const body = await request.json()
      const filename = body?.filename
      if (!filename) {
        return NextResponse.json({ error: "Nome do arquivo nao fornecido" }, { status: 400 })
      }

      const backupDir = path.join(process.cwd(), "public", "backup")
      const sourcePath = path.join(backupDir, path.basename(filename))
      console.log(`[RESTORE] Restaurando backup automatico: ${filename} em ${sourcePath}`)

      if (!existsSync(sourcePath)) {
        return NextResponse.json({ error: "Arquivo de backup nao encontrado" }, { status: 404 })
      }

      tempDir = path.join(process.cwd(), "public", "restore_temp", randomUUID())
      await mkdir(tempDir, { recursive: true })

      const ext = filename.endsWith(".tar.gz") || filename.endsWith(".tgz") ? ".tar.gz" : ".sql"
      uploadedFilePath = path.join(tempDir, `upload${ext}`)
      await cp(sourcePath, uploadedFilePath)
    } else {
      return NextResponse.json({ error: "Content-Type nao suportado" }, { status: 400 })
    }

    if (uploadedFilePath.endsWith(".tar.gz")) {
      console.log(`[RESTORE] Extraindo arquivo: ${uploadedFilePath}`)
      await extractArchive(uploadedFilePath, tempDir)

      const sqlPath = await findLargestSqlFile(tempDir)
      if (!sqlPath) {
        try {
          const tree = execSync(`ls -R "${tempDir}"`).toString()
          console.error(`[RESTORE] Tree: ${tree}`)
        } catch {}
        throw new Error("Arquivo SQL nao encontrado dentro do backup.")
      }

      console.log(`[RESTORE] Restaurando SQL encontrado em: ${sqlPath}`)
      try {
        const head = execSync(`head -n 20 "${sqlPath}"`).toString()
        console.log("--- SQL HEADER PREVIEW ---")
        console.log(head)
        console.log("--------------------------")
      } catch {}

      await restoreDatabase(sqlPath)

      const uploadsSrc = await findUploadsDir(tempDir)
      if (uploadsSrc) {
        const publicUploads = process.env.UPLOADS_PATH || path.join(process.cwd(), "public", "uploads")
        console.log(`[RESTORE] Restaurando uploads de ${uploadsSrc} para ${publicUploads}`)
        await mkdir(publicUploads, { recursive: true })

        try {
          await cp(uploadsSrc, publicUploads, { recursive: true, force: true })
        } catch (error) {
          console.error("[RESTORE] Erro ao copiar uploads:", error)
          try {
            execSync(`cp -r "${uploadsSrc}/." "${publicUploads}/"`)
          } catch (fallbackError) {
            console.error("[RESTORE] Falha no fallback de copia:", fallbackError)
          }
        }
      } else {
        console.warn("[RESTORE] Pasta de uploads nao encontrada no backup.")
      }
    } else {
      await restoreDatabase(uploadedFilePath)
    }

    return NextResponse.json({ success: true, message: "Restauracao concluida com sucesso!" })
  } catch (error: any) {
    console.error("Erro no processo de restore:", error)
    return NextResponse.json(
      { error: "Erro ao processar restauracao" },
      { status: 500 }
    )
  } finally {
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true })
      } catch (error) {
        console.error("Erro ao limpar diretorio temporario", error)
      }
    }
  }
})
