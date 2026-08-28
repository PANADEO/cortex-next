import { NextResponse } from 'next/server'
import { pool, migracja } from '@/core/db'
import { ktoTo } from '@/core/tozsamosc'
import { polityka, wydanoDzisiaj } from '@/core/brama-zdolnosci'
import { uruchomTure, dopiszZdarzenie } from '@/core/runtime'
import * as dziennik from '@/core/dziennik'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migracja()
  const { id } = await params
  const u = await ktoTo()
  const s = await pool.query(`select wlasciciel, tytul from desk.sprawa where id=$1`, [id])
  if (!s.rowCount) return NextResponse.json({ blad: 'Nie ma takiej sprawy.' }, { status: 404 })
  if (s.rows[0].wlasciciel !== u.id) {
    await dziennik.zapisz(u.id, 'dostep.odrzucony', { sprawaId: id })
    return NextResponse.json({ blad: 'To nie jest Twoja sprawa.' }, { status: 403 })
  }
  const p = polityka(u)
  const wydano = await wydanoDzisiaj(u.id)
  if (wydano >= p.limitUsdNaDzien) {
    return NextResponse.json({ blad: 'Wyczerpany dzienny limit kosztów. Poproś przełożonego o podniesienie.' }, { status: 429 })
  }
  const { tresc } = await req.json()
  if (!tresc?.trim()) return NextResponse.json({ blad: 'Puste zlecenie.' }, { status: 400 })

  await dopiszZdarzenie(id, { typ: 'mysl', tekst: tresc.trim() })
  if (s.rows[0].tytul === 'Nowa sprawa') {
    await pool.query(`update desk.sprawa set tytul=$2 where id=$1`, [id, tresc.trim().slice(0, 60)])
  }
  await uruchomTure(u, p, id, tresc.trim())
  return NextResponse.json({ ok: true })
}
