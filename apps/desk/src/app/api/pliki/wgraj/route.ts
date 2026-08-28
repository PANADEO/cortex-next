import { NextResponse } from 'next/server'
import { ktoTo } from '@/core/tozsamosc'
import * as biurko from '@/core/biurko'
import * as dziennik from '@/core/dziennik'

export async function POST(req: Request) {
  const u = await ktoTo()
  const form = await req.formData()
  const katalog = (form.get('katalog') as string) || 'Moje pliki'
  const pliki = form.getAll('plik') as File[]
  const nazwy: string[] = []
  for (const f of pliki) {
    if (!f || typeof f === 'string') continue
    const buf = Buffer.from(await f.arrayBuffer())
    await biurko.zapisz(u.id, `${katalog}/${f.name}`, buf)
    nazwy.push(f.name)
    await dziennik.zapisz(u.id, 'pliki.wgranie', { nazwa: f.name, rozmiar: buf.length })
  }
  return NextResponse.json({ ok: true, nazwy })
}
