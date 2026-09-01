import mysql from "mysql2/promise"

let pool: mysql.Pool | null = null

export function getPool(): mysql.Pool {
  if (!pool) {
    // Create pool with better timeouts and keep-alive settings
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "sispatrimonio",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: "utf8mb4",
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      // Add timeouts to fail fast if DB is unreachable (avoid 40s wait)
      connectTimeout: 10000, // 10s
    })
  }
  return pool
}

export async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
  const db = getPool()
  const [rows] = await db.execute(sql, params)
  return rows as T[]
}

export async function queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows.length > 0 ? rows[0] : null
}

export async function execute(sql: string, params?: unknown[]): Promise<mysql.ResultSetHeader> {
  const db = getPool()
  const [result] = await db.execute(sql, params)
  return result as mysql.ResultSetHeader
}

export async function withTransaction<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const connection = await getPool().getConnection()
  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
