import * as biurko from "@cortex/desk-core/biurko"
import { polityka } from "@cortex/desk-core/brama-zdolnosci"
import { migracja, pool } from "@cortex/desk-core/db"
import * as dziennik from "@cortex/desk-core/dziennik"
import { ktoTo } from "@cortex/desk-core/tozsamosc"
import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"

export async function POST(req: Request) {
  await migracja()
  const u = await ktoTo()
  const { tytul } = await req.json().catch(() => ({ tytul: "Nowa sprawa" }))
  const id = randomUUID().slice(0, 8)
  await pool.query(`insert into desk.sprawa (id, wlasciciel, tytul) values ($1,$2,$3)`, [
    id,
    u.id,
    (tytul || "Nowa sprawa").slice(0, 120),
  ])
  await biurko.utworzKatalog(u.id, biurko.katalogSprawy(u.id, id))
  const p = await polityka(u)
  await dziennik.zapisz(u.id, "sprawa.utworzona", {
    sprawaId: id,
    odcisk: p.odcisk,
    zdolnosci: p.przyznane.map((z) => z.id),
  })
  return NextResponse.json({ id })
}
