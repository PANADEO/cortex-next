import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { pool, migracja } from '@/core/db'
import { ktoTo } from '@/core/tozsamosc'
import { polityka } from '@/core/brama-zdolnosci'
import * as dziennik from '@/core/dziennik'
import * as biurko from '@/core/biurko'

export async function POST(req: Request) {
  await migracja()
  const u = await ktoTo()
  const { tytul } = await req.json().catch(() => ({ tytul: 'Nowa sprawa' }))
  const id = randomUUID().slice(0, 8)
  await pool.query(`insert into desk.sprawa (id, wlasciciel, tytul) values ($1,$2,$3)`, [
    id, u.id, (tytul || 'Nowa sprawa').slice(0, 120),
  ])
  await biurko.utworzKatalog(u.id, biurko.katalogSprawy(u.id, id))
  const p = polityka(u)
  await dziennik.zapisz(u.id, 'sprawa.utworzona', { sprawaId: id, odcisk: p.odcisk, zdolnosci: p.przyznane.map(z => z.id) })
  return NextResponse.json({ id })
}
