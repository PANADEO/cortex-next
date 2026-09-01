import * as audit from "@cortex/desk-core/audit-log"
import * as storage from "@cortex/desk-core/desk-storage"
import { whoAmI } from "@cortex/desk-core/identity"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const u = await whoAmI()
  const sp = new URL(req.url).searchParams
  const folder = sp.get("folder") ?? "Moje pliki"
  return NextResponse.json({
    files: await storage.list(u.id, folder),
    trash: await storage.trash(u.id),
    folders: sp.get("tree") ? await storage.folders(u.id) : undefined,
  })
}

export async function POST(req: Request) {
  const u = await whoAmI()
  const b = await req.json()
  try {
    let result: unknown = { ok: true }
    if (b.action === "folder") await storage.createFolder(u.id, b.path)
    else if (b.action === "move")
      result = {
        ok: true,
        target: await storage.move(u.id, b.from, b.to, b.onCollision ?? "error"),
      }
    else if (b.action === "copy")
      result = { ok: true, target: await storage.copy(u.id, b.from, b.to) }
    else if (b.action === "trash") result = { ok: true, id: await storage.toTrash(u.id, b.path) }
    else if (b.action === "restore") result = { ok: true, ...(await storage.restore(u.id, b.id)) }
    else return NextResponse.json({ error: "nieznana akcja" }, { status: 400 })
    await audit.write(u.id, `files.${b.action}`, b)
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof storage.NameClash) {
      return NextResponse.json({ error: "name-clash", name: e.name }, { status: 409 })
    }
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 400 })
  }
}
