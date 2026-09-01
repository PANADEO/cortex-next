import * as storage from "@cortex/desk-core/desk-storage"
import { whoAmI } from "@cortex/desk-core/identity"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { NextResponse } from "next/server"
import { promises as fs } from "node:fs"
import path from "node:path"

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  csv: "text/csv; charset=utf-8",
  json: "application/json; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

export async function GET(req: Request) {
  const u = await whoAmI()
  const sp = new URL(req.url).searchParams
  const filePath = sp.get("path")
  const translate = await deskT()
  if (!filePath) return NextResponse.json({ error: translate("api.noPath") }, { status: 400 })
  try {
    const full = await storage.fullPath(u.id, filePath)
    const data = await fs.readFile(full)
    const ext = filePath.split(".").pop()?.toLowerCase() ?? ""
    const headers: Record<string, string> = {
      "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    }
    if (sp.get("download")) {
      const name = encodeURIComponent(path.basename(filePath))
      headers["Content-Disposition"] = `attachment; filename*=UTF-8''${name}`
    }
    return new NextResponse(new Uint8Array(data), { headers: headers })
  } catch {
    return NextResponse.json({ error: "nie ma takiego pliku" }, { status: 404 })
  }
}
