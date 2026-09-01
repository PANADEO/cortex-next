import * as biurko from "@cortex/desk-core/biurko"
import { pool } from "@cortex/desk-core/db"
import * as dziennik from "@cortex/desk-core/dziennik"
import { dopiszZdarzenie } from "@cortex/desk-core/runtime"
import { ktoTo } from "@cortex/desk-core/tozsamosc"
import { NextResponse } from "next/server"

const MAX = 25 * 1024 * 1024

/**
 * Załącznik do rozmowy ląduje w teczce sprawy, nie w „Moich plikach".
 * „Moje pliki" to przestrzeń, do której trafia wyłącznie to, co człowiek świadomie tam położył.
 */
export async function POST(req: Request) {
  const u = await ktoTo()
  const form = await req.formData()
  const sprawaId = form.get("sprawaId") as string | null

  let katalog: string
  if (sprawaId) {
    const s = await pool.query(`select wlasciciel from desk.sprawa where id=$1`, [sprawaId])
    if (!s.rowCount) return NextResponse.json({ blad: "Nie ma takiej sprawy." }, { status: 404 })
    if (s.rows[0].wlasciciel !== u.id) {
      await dziennik.zapisz(u.id, "dostep.odrzucony", { sprawaId })
      return NextResponse.json({ blad: "To nie jest Twoja sprawa." }, { status: 403 })
    }
    katalog = biurko.katalogSprawy(u.id, sprawaId)
  } else {
    katalog = (form.get("katalog") as string) || "Moje pliki"
  }

  const pliki = form.getAll("plik") as File[]
  const nazwy: string[] = []
  for (const f of pliki) {
    if (!f || typeof f === "string") continue
    if (f.size > MAX) {
      return NextResponse.json({ blad: `${f.name} waży więcej niż 25 MB.` }, { status: 413 })
    }
    const buf = Buffer.from(await f.arrayBuffer())
    const gdzie = await biurko.zapiszNowy(u.id, `${katalog}/${f.name}`, buf)
    nazwy.push(gdzie.split("/").pop() ?? f.name)
    await dziennik.zapisz(u.id, "pliki.wgranie", { nazwa: f.name, rozmiar: buf.length, gdzie })
  }

  // Pochodzenie zapisujemy W CHWILI WGRANIA, nie dopiero przy wysłaniu polecenia.
  // Inaczej plik leżący w teczce między wgraniem a wysłaniem nie należy do nikogo,
  // a panel wyniku bierze go za dokument, który agent właśnie wytworzył.
  if (sprawaId && nazwy.length) await dopiszZdarzenie(sprawaId, { typ: "zalacznik", nazwy })

  return NextResponse.json({ ok: true, nazwy })
}
