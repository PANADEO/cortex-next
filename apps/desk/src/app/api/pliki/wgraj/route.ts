import { NextResponse } from 'next/server'
import { ktoTo } from '@/core/tozsamosc'
import * as biurko from '@/core/biurko'
import * as dziennik from '@/core/dziennik'

const MAX = 25 * 1024 * 1024

export async function POST(req: Request) {
  const u = await ktoTo()
  const form = await req.formData()
  const katalog = (form.get('katalog') as string) || 'Moje pliki'
  const pliki = form.getAll('plik') as File[]
  const nazwy: string[] = []
  for (const f of pliki) {
    if (!f || typeof f === 'string') continue
    if (f.size > MAX) {
      return NextResponse.json({ blad: `${f.name} waży więcej niż 25 MB.` }, { status: 413 })
    }
    const buf = Buffer.from(await f.arrayBuffer())
    const gdzie = await biurko.zapiszNowy(u.id, `${katalog}/${f.name}`, buf)
    nazwy.push(gdzie.split('/').pop() ?? f.name)
    await dziennik.zapisz(u.id, 'pliki.wgranie', { nazwa: f.name, rozmiar: buf.length, gdzie })
  }
  return NextResponse.json({ ok: true, nazwy })
}
