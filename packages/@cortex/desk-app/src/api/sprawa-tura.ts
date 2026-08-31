import { NextResponse } from 'next/server'
import { pool, migracja } from '@cortex/desk-core/db'
import { ktoTo } from '@cortex/desk-core/tozsamosc'
import { polityka, wydanoDzisiaj } from '@cortex/desk-core/brama-zdolnosci'
import { uruchomTure, dopiszZdarzenie } from '@cortex/desk-core/runtime'
import * as dziennik from '@cortex/desk-core/dziennik'

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
  const p = await polityka(u)
  const wydano = await wydanoDzisiaj(u.id)
  if (wydano >= p.limitUsdNaDzien) {
    return NextResponse.json({ blad: 'Wyczerpany dzienny limit kosztów. Poproś przełożonego o podniesienie.' }, { status: 429 })
  }
  const { tresc, zalaczniki } = await req.json()
  const pliki: string[] = Array.isArray(zalaczniki) ? zalaczniki.filter((z) => typeof z === 'string').slice(0, 10) : []
  if (!tresc?.trim() && !pliki.length) return NextResponse.json({ blad: 'Puste zlecenie.' }, { status: 400 })

  await dopiszZdarzenie(id, {
    typ: 'mysl',
    tekst: tresc?.trim() ?? '',
    ...(pliki.length ? { zalaczniki: pliki } : {}),
  })
  if (s.rows[0].tytul === 'Nowa sprawa' && tresc?.trim()) {
    await pool.query(`update desk.sprawa set tytul=$2 where id=$1`, [id, tresc.trim().slice(0, 60)])
  }
  await uruchomTure(u, p, id, tresc?.trim() ?? '', pliki)
  return NextResponse.json({ ok: true })
}
