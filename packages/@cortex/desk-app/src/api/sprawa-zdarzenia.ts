import * as biurko from "@cortex/desk-core/biurko"
import { migracja, pool } from "@cortex/desk-core/db"
import { ktoTo } from "@cortex/desk-core/tozsamosc"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migracja()
  const { id } = await params
  const u = await ktoTo()
  const od = Number(new URL(req.url).searchParams.get("od") ?? 0)
  const s = await pool.query(
    `select wlasciciel, tytul, stan, powod, koszt_usd::float8 as koszt, zmieniona from desk.sprawa where id=$1`,
    [id],
  )
  if (!s.rowCount) return NextResponse.json({ blad: "Nie ma takiej sprawy." }, { status: 404 })
  if (s.rows[0].wlasciciel !== u.id)
    return NextResponse.json({ blad: "To nie jest Twoja sprawa." }, { status: 403 })

  const z = await pool.query(
    `select seq, at, payload from desk.zdarzenie where sprawa_id=$1 and seq>$2 order by seq`,
    [id, od],
  )
  const teczka = await biurko.lista(u.id, biurko.katalogSprawy(u.id, id)).catch(() => [])
  return NextResponse.json({
    sprawa: {
      id,
      tytul: s.rows[0].tytul,
      stan: s.rows[0].stan,
      powod: s.rows[0].powod,
      koszt: s.rows[0].koszt,
      zmieniona: s.rows[0].zmieniona,
    },
    zdarzenia: z.rows.map((r) => ({ seq: Number(r.seq), at: r.at, event: r.payload })),
    teczka,
  })
}
