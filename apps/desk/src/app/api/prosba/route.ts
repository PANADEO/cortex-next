import { NextResponse } from 'next/server'
import { pool, migracja } from '@/core/db'
import { ktoTo } from '@/core/tozsamosc'
import * as dziennik from '@/core/dziennik'

export async function POST(req: Request) {
  await migracja()
  const u = await ktoTo()
  const { zdolnosc } = await req.json()
  await pool.query(`insert into desk.prosba (kto, zdolnosc) values ($1,$2)`, [u.id, zdolnosc])
  await dziennik.zapisz(u.id, 'prosba.o.dostep', { zdolnosc })
  return NextResponse.json({ ok: true })
}
