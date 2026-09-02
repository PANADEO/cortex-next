import * as audit from "@cortex/desk-core/audit-log"
import { hasCapability, policyFor } from "@cortex/desk-core/capability-gate"
import * as storage from "@cortex/desk-core/desk-storage"
import { isShared } from "@cortex/desk-core/folder"
import { mayTouchShared } from "@cortex/desk-core/shared-access"
import { originsInMyFiles } from "@cortex/desk-core/file-origin"
import { whoAmI } from "@cortex/desk-core/identity"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const u = await whoAmI()
  const p = await policyFor(u)
  const may = (id: string) => hasCapability(p, id)
  const sp = new URL(req.url).searchParams
  const folder = sp.get("folder") ?? "Moje pliki"
  // Brama TAKŻE tutaj, nie tylko w narzędziach agenta. Ekran plików sięga po tę samą
  // warstwę dysku co model, więc brama pilnowana wyłącznie po stronie narzędzi byłaby
  // pilnowana w połowie — a przeglądarka jest tą połową, którą człowiek ma pod ręką.
  if (!mayTouchShared(may, folder, "read")) {
    return NextResponse.json({ error: "Brak dostępu do wspólnej półki." }, { status: 403 })
  }
  // Pochodzenie jedzie ŚCIEŻKĄ, nie przy pliku, bo listę plików daje dysk, a pochodzenie
  // baza — i to są dwa różne źródła prawdy, których nie zszywamy po stronie serwera.
  return NextResponse.json({
    files: await storage.list(u.id, folder),
    trash: await storage.trash(u.id),
    origins: await originsInMyFiles(u.id),
    // Kto nie ma wglądu, ten nie widzi też GAŁĘZI — inaczej drzewo katalogów zdradza
    // istnienie i nazwy folderów, do których i tak nie wejdzie.
    folders: sp.get("tree")
      ? (await storage.folders(u.id)).filter((f) => !isShared(f) || may("shared.read"))
      : undefined,
  })
}

export async function POST(req: Request) {
  const u = await whoAmI()
  const p = await policyFor(u)
  const may = (id: string) => hasCapability(p, id)
  const b = await req.json()
  // Każda ścieżka, którą to żądanie dotyka — źródłowa i docelowa. `move` ze wspólnej półki
  // jest zapisem po OBU stronach: w miejscu docelowym przybywa, w źródłowym ubywa.
  const touched = [b.path, b.from, b.to].filter((x): x is string => typeof x === "string")
  if (touched.some((x) => isShared(x)) && !may("shared.write")) {
    return NextResponse.json(
      { error: "Odkładanie na wspólną półkę nadaje przełożony." },
      { status: 403 },
    )
  }
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
    else if (b.action === "empty-trash")
      result = { ok: true, removed: await storage.emptyTrash(u.id) }
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
