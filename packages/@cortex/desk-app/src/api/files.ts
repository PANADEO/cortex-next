import * as audit from "@cortex/desk-core/audit-log"
import { hasCapability, policyFor } from "@cortex/desk-core/capability-gate"
import * as storage from "@cortex/desk-core/desk-storage"
import { isShared } from "@cortex/desk-core/folder"
import { mayTouchShared } from "@cortex/desk-core/shared-access"
import { originsInMyFiles } from "@cortex/desk-core/file-origin"
import { whoAmI } from "@cortex/desk-core/identity"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const u = await whoAmI()
  const p = await policyFor(u)
  const may = (id: string) => hasCapability(p, id)
  const translate = await deskT()
  const sp = new URL(req.url).searchParams
  const folder = sp.get("folder") ?? "Moje pliki"
  // Brama TAKŻE tutaj, nie tylko w narzędziach agenta. Ekran plików sięga po tę samą
  // warstwę dysku co model, więc brama pilnowana wyłącznie po stronie narzędzi byłaby
  // pilnowana w połowie — a przeglądarka jest tą połową, którą człowiek ma pod ręką.
  if (!mayTouchShared(may, folder, "read")) {
    return NextResponse.json({ error: translate("api.noSharedAccess") }, { status: 403 })
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
  const translate = await deskT()
  const b = await req.json()
  // Każda ścieżka, którą to żądanie dotyka — źródłowa i docelowa. `move` ze wspólnej półki
  // jest zapisem po OBU stronach: w miejscu docelowym przybywa, w źródłowym ubywa.
  const touched = [b.path, b.from, b.to].filter((x): x is string => typeof x === "string")
  // PRZYWRACANIE Z KOSZA idzie po samym identyfikatorze, więc żadna z trzech ścieżek
  // wyżej go nie opisuje — a plik potrafi wrócić NA WSPÓLNĄ PÓŁKĘ. Osoba, której
  // odebrano `shared.write` po wyrzuceniu firmowego wzoru do własnego kosza, odkładała
  // go z powrotem bez żadnej zdolności. Pytamy o CEL RZECZYWISTY: gdy pierwotnego
  // folderu już nie ma, plik ląduje w „Moich plikach" i zgoda nie jest potrzebna.
  if (b.action === "restore" && typeof b.id === "string") {
    const planned = await storage.restoreTarget(u.id, b.id).catch(() => null)
    if (planned) touched.push(planned.folder)
  }
  if (touched.some((x) => isShared(x)) && !may("shared.write")) {
    return NextResponse.json(
      { error: translate("api.noSharedWrite") },
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
    else return NextResponse.json({ error: translate("api.unknownAction") }, { status: 400 })
    // Do dziennika idą POLA WYMIENIONE Z NAZWY, nie całe ciało żądania. Wcześniej
    // zapisywaliśmy `b` w całości, więc do trwałego rejestru trafiało wszystko, co
    // przeglądarka zechciała dopisać — także pola, których nikt nie przejrzał, i te,
    // które ktoś doda tu za pół roku. Dziennika nie da się potem posprzątać: to jest
    // rejestr, w którym wpisy zostają.
    await audit.write(u.id, `files.${b.action}`, {
      ...(typeof b.path === "string" ? { path: b.path } : {}),
      ...(typeof b.from === "string" ? { from: b.from } : {}),
      ...(typeof b.to === "string" ? { to: b.to } : {}),
      ...(typeof b.id === "string" ? { id: b.id } : {}),
    })
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof storage.NameClash) {
      return NextResponse.json({ error: "name-clash", name: e.name }, { status: 409 })
    }
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 400 })
  }
}
