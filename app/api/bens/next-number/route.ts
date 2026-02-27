import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"

export const GET = withAuth(async (request) => {
  const url = new URL(request.url)
  const prefix = url.searchParams.get("prefix") || ""
  
  // Get all existing patrimonios
  // We need to filter by prefix if provided, or just get all and parse
  let sql = "SELECT patrimonio FROM bens"
  const params: any[] = []
  
  if (prefix) {
    sql += " WHERE patrimonio LIKE ?"
    params.push(`${prefix}%`)
  }
  
  const rows = await query(sql, params) as { patrimonio: string }[]
  
  const usedNumbers = new Set<number>()
  
  for (const row of rows) {
    // Try to extract number from the end of the string
    // e.g. "PAT-00123" -> 123
    // "123" -> 123
    // "ABC" -> null
    
    // If prefix is provided, remove it first
    let clean = row.patrimonio
    if (prefix && clean.startsWith(prefix)) {
        clean = clean.substring(prefix.length)
    }
    
    // Extract first sequence of digits
    const match = clean.match(/(\d+)/)
    if (match) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num > 0 && num < 1000000) { // Safety limit
            usedNumbers.add(num)
        }
    }
  }
  
  // Find first gap
  let nextNum = 1
  while (usedNumbers.has(nextNum)) {
    nextNum++
  }
  
  return NextResponse.json({ nextNumber: nextNum })
})
