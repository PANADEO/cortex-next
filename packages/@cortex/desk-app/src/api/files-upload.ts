import * as audit from "@cortex/desk-core/audit-log"
import { hasCapability, policyFor } from "@cortex/desk-core/capability-gate"
import { pool } from "@cortex/desk-core/db"
import * as storage from "@cortex/desk-core/desk-storage"
import { whoAmI } from "@cortex/desk-core/identity"
import { mayTouchShared } from "@cortex/desk-core/shared-access"
import { appendEvent } from "@cortex/desk-core/runtime"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { NextResponse } from "next/server"

const MAX = 25 * 1024 * 1024

/**
 * Załącznik do rozmowy ląduje w teczce sprawy, nie w „Moich plikach".
 * „Moje pliki" to przestrzeń, do której trafia wyłącznie to, co człowiek świadomie tam położył.
 */
export async function POST(req: Request) {
  const u = await whoAmI()
  // Słownik POWYŻEJ pierwszej odmowy: odpowiedzi o cudzej sprawie padają, zanim
  // w ogóle dojdzie do plików, a każda z nich jest zdaniem dla człowieka.
  const translate = await deskT()
  const form = await req.formData()
  const caseId = form.get("caseId") as string | null

  let folder: string
  if (caseId) {
    const s = await pool.query(`select owner from desk.case_file where id=$1`, [caseId])
    if (!s.rowCount) {
      return NextResponse.json({ error: translate("api.noSuchCase") }, { status: 404 })
    }
    if (s.rows[0].owner !== u.id) {
      await audit.write(u.id, "access.denied", { caseId })
      return NextResponse.json({ error: translate("api.notYourCase") }, { status: 403 })
    }
    folder = storage.caseFolder(u.id, caseId)
  } else {
    folder = (form.get("folder") as string) || "Moje pliki"
  }

  // Katalog przychodzi Z FORMULARZA, więc przeglądarka może wskazać wspólną półkę — i do
  // tej pory wskazywała skutecznie, bez pytania o `shared.write`. Podmiana firmowego wzoru
  // pisma jest zdarzeniem o zasięgu całej firmy (patrz `shared-access.ts`), więc nie może
  // zależeć od tego, którą trasą plik przyszedł. Teczka sprawy tej bramy nie potrzebuje:
  // jej ścieżkę składa serwer z `caseId`, którego własność sprawdziliśmy wyżej.
  const p = await policyFor(u)
  if (!mayTouchShared((id) => hasCapability(p, id), folder, "write")) {
    return NextResponse.json({ error: translate("api.noSharedWrite") }, { status: 403 })
  }
  const files = form.getAll("file") as File[]
  const names: string[] = []
  for (const f of files) {
    if (!f || typeof f === "string") continue
    if (f.size > MAX) {
      return NextResponse.json(
        { error: translate("api.tooLarge", { name: f.name }) },
        { status: 413 },
      )
    }
    const buf = Buffer.from(await f.arrayBuffer())
    const target = await storage.writeNew(u.id, `${folder}/${f.name}`, buf)
    names.push(target.split("/").pop() ?? f.name)
    await audit.write(u.id, "files.upload", { name: f.name, size: buf.length, target })
  }

  // Pochodzenie zapisujemy W CHWILI WGRANIA, nie dopiero przy wysłaniu polecenia.
  // Inaczej plik leżący w teczce między wgraniem a wysłaniem nie należy do nikogo,
  // a panel wyniku bierze go za dokument, który agent właśnie wytworzył.
  if (caseId && names.length) await appendEvent(caseId, { type: "attachment", names })

  return NextResponse.json({ ok: true, names })
}
