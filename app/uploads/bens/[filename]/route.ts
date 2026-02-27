import fs from "fs"
import path from "path"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params
    const filePath = path.join(process.cwd(), "public", "uploads", "bens", filename)

    if (!fs.existsSync(filePath)) {
      return new NextResponse("File not found", { status: 404 })
    }

    const fileBuffer = fs.readFileSync(filePath)
    
    // Determine content type based on extension
    let contentType = "application/octet-stream"
    if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
      contentType = "image/jpeg"
    } else if (filename.endsWith(".png")) {
      contentType = "image/png"
    } else if (filename.endsWith(".webp")) {
      contentType = "image/webp"
    } else if (filename.endsWith(".gif")) {
      contentType = "image/gif"
    }

    // Set cache headers to avoid stale content issues immediately after upload
    // but allow caching for a short period
    const headers = new Headers()
    headers.set("Content-Type", contentType)
    headers.set("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=30")

    return new NextResponse(fileBuffer, { headers })
  } catch (error) {
    console.error("Error serving file:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
