import { whoAmI } from "@cortex/desk-core/identity"
import * as memory from "@cortex/desk-core/memory"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { NextResponse } from "next/server"

/**
 * Pamięć jest PRYWATNĄ przestrzenią tej osoby — jak „Moje pliki". Każda operacja
 * dotyczy wyłącznie własnych wspomnień: `owner` bierze się z tożsamości, nigdy z ciała
 * żądania, więc identyfikator z cudzej pamięci po prostu nie trafi w żaden wiersz.
 */
export async function GET() {
  const u = await whoAmI()
  return NextResponse.json({
    memories: await memory.all(u.id),
    limit: memory.MEMORY_LIMIT,
    maxChars: memory.MEMORY_MAX_CHARS,
  })
}

export async function POST(req: Request) {
  const u = await whoAmI()
  const translate = await deskT()
  const b = await req.json()
  const id = Number(b.id ?? 0)
  try {
    if (b.action === "add") {
      const text = String(b.text ?? "").trim()
      if (!text) return NextResponse.json({ error: translate("memory.empty2") }, { status: 400 })
      return NextResponse.json({ ok: true, memory: await memory.add(u.id, text) })
    }
    if (b.action === "accept") {
      await memory.accept(u.id, id)
      return NextResponse.json({ ok: true })
    }
    if (b.action === "edit") {
      await memory.edit(u.id, id, String(b.text ?? ""))
      return NextResponse.json({ ok: true })
    }
    if (b.action === "forget") {
      await memory.forget(u.id, id)
      return NextResponse.json({ ok: true })
    }
  } catch (e) {
    if (e instanceof memory.MemoryFull) {
      return NextResponse.json(
        { error: translate("memory.full", { limit: memory.MEMORY_LIMIT }) },
        { status: 409 },
      )
    }
    throw e
  }
  return NextResponse.json({ error: translate("api.unknownDecision") }, { status: 400 })
}
