import { promises as fs } from 'node:fs'
import { NextResponse } from 'next/server'
import { ktoTo } from '@/core/tozsamosc'
import * as biurko from '@/core/biurko'

export async function GET(req: Request) {
  const u = await ktoTo()
  const sciezka = new URL(req.url).searchParams.get('sciezka')
  if (!sciezka) return NextResponse.json({ blad: 'brak ścieżki' }, { status: 400 })
  try {
    const pelna = await biurko.pelnaSciezka(u.id, sciezka)
    const dane = await fs.readFile(pelna)
    const ext = sciezka.split('.').pop()?.toLowerCase()
    const typ = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'csv' ? 'text/csv; charset=utf-8' : 'text/plain; charset=utf-8'
    return new NextResponse(new Uint8Array(dane), { headers: { 'Content-Type': typ } })
  } catch {
    return NextResponse.json({ blad: 'nie ma takiego pliku' }, { status: 404 })
  }
}
