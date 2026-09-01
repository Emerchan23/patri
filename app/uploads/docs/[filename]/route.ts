import fs from "fs"
import path from "path"
import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { isSafeFilenameSegment } from "@/lib/route-security"

export const GET = withAuth(async (
  request,
  { params }
) => {
  try {
    const filename = params?.filename
    if (!filename || !isSafeFilenameSegment(filename)) {
      return new NextResponse("Invalid file name", { status: 400 })
    }
    const filePath = path.join(process.cwd(), "public", "uploads", "docs", filename)

    if (!fs.existsSync(filePath)) {
      return new NextResponse("File not found", { status: 404 })
    }

    const fileBuffer = fs.readFileSync(filePath)
    
    // Determine content type
    let contentType = "application/octet-stream"
    if (filename.endsWith(".pdf")) {
      contentType = "application/pdf"
    } else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
      contentType = "image/jpeg"
    } else if (filename.endsWith(".png")) {
      contentType = "image/png"
    }

    // Set cache headers
    const headers = new Headers()
    headers.set("Content-Type", contentType)
    headers.set("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=30")

    return new NextResponse(fileBuffer, { headers })
  } catch (error) {
    console.error("Error serving file:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
})
