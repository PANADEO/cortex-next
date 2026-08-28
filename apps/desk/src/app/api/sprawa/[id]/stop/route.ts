import { NextResponse } from 'next/server'
import { pool, migracja } from '@/core/db'
import { ktoTo } from '@/core/tozsamosc'
import { dopiszZdarzenie } from '@/core/runtime'
import * as dziennik from '@/core/dziennik'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migracja()
  const { id } = await params
  const u = await ktoTo()
  const s = await pool.query(`select wlasciciel from desk.sprawa where id=$1`, [id])
  if (!s.rowCount || s.rows[0].wlasciciel !== u.id) return NextResponse.json({ blad: 'brak' }, { status: 403 })
  await pool.query(`update desk.sprawa set stan='przerwane', powod='przerwane przez Ciebie', zmieniona=now() where id=$1 and stan='pracuje'`, [id])
  await dopiszZdarzenie(id, { typ: 'lifecycle', stan: 'przerwane', powod: 'przerwane przez Ciebie' })
  await dziennik.zapisz(u.id, 'tura.stop', { sprawaId: id })
  return NextResponse.json({ ok: true })
}
