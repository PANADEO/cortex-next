import { NextResponse } from 'next/server'
import { ktoTo } from '@cortex/desk-core/tozsamosc'
import * as biurko from '@cortex/desk-core/biurko'
import * as dziennik from '@cortex/desk-core/dziennik'

export async function GET(req: Request) {
  const u = await ktoTo()
  const sp = new URL(req.url).searchParams
  const katalog = sp.get('katalog') ?? 'Moje pliki'
  return NextResponse.json({
    pliki: await biurko.lista(u.id, katalog),
    kosz: await biurko.kosz(u.id),
    katalogi: sp.get('drzewo') ? await biurko.katalogi(u.id) : undefined,
  })
}

export async function POST(req: Request) {
  const u = await ktoTo()
  const b = await req.json()
  try {
    let wynik: unknown = { ok: true }
    if (b.akcja === 'katalog') await biurko.utworzKatalog(u.id, b.sciezka)
    else if (b.akcja === 'przenies') wynik = { ok: true, gdzie: await biurko.przenies(u.id, b.z, b.do, b.gdyKolizja ?? 'blad') }
    else if (b.akcja === 'kopiuj') wynik = { ok: true, gdzie: await biurko.kopiuj(u.id, b.z, b.do) }
    else if (b.akcja === 'kosz') wynik = { ok: true, id: await biurko.doKosza(u.id, b.sciezka) }
    else if (b.akcja === 'przywroc') wynik = { ok: true, ...(await biurko.przywroc(u.id, b.id)) }
    else return NextResponse.json({ blad: 'nieznana akcja' }, { status: 400 })
    await dziennik.zapisz(u.id, `pliki.${b.akcja}`, b)
    return NextResponse.json(wynik)
  } catch (e) {
    if (e instanceof biurko.Kolizja) {
      return NextResponse.json({ blad: 'kolizja', nazwa: e.nazwa }, { status: 409 })
    }
    return NextResponse.json({ blad: String(e).slice(0, 200) }, { status: 400 })
  }
}
