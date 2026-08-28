import { NextResponse } from 'next/server'
import { ktoTo } from '@/core/tozsamosc'
import * as biurko from '@/core/biurko'
import * as dziennik from '@/core/dziennik'

export async function GET(req: Request) {
  const u = await ktoTo()
  const katalog = new URL(req.url).searchParams.get('katalog') ?? 'Moje pliki'
  return NextResponse.json({ pliki: await biurko.lista(u.id, katalog), kosz: await biurko.kosz(u.id) })
}

export async function POST(req: Request) {
  const u = await ktoTo()
  const b = await req.json()
  try {
    if (b.akcja === 'katalog') await biurko.utworzKatalog(u.id, b.sciezka)
    else if (b.akcja === 'przenies') await biurko.przenies(u.id, b.z, b.do)
    else if (b.akcja === 'kosz') await biurko.doKosza(u.id, b.sciezka)
    else if (b.akcja === 'przywroc') await biurko.przywroc(u.id, b.id)
    else return NextResponse.json({ blad: 'nieznana akcja' }, { status: 400 })
    await dziennik.zapisz(u.id, `pliki.${b.akcja}`, b)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ blad: String(e).slice(0, 200) }, { status: 400 })
  }
}
