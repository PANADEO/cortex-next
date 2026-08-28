import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { ktoTo } from '@/core/tozsamosc'
import * as biurko from '@/core/biurko'

const TYPY: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf',
  csv: 'text/csv; charset=utf-8', json: 'application/json; charset=utf-8',
  md: 'text/markdown; charset=utf-8', txt: 'text/plain; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export async function GET(req: Request) {
  const u = await ktoTo()
  const sp = new URL(req.url).searchParams
  const sciezka = sp.get('sciezka')
  if (!sciezka) return NextResponse.json({ blad: 'brak ścieżki' }, { status: 400 })
  try {
    const pelna = await biurko.pelnaSciezka(u.id, sciezka)
    const dane = await fs.readFile(pelna)
    const ext = sciezka.split('.').pop()?.toLowerCase() ?? ''
    const naglowki: Record<string, string> = {
      'Content-Type': TYPY[ext] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    }
    if (sp.get('pobierz')) {
      const nazwa = encodeURIComponent(path.basename(sciezka))
      naglowki['Content-Disposition'] = `attachment; filename*=UTF-8''${nazwa}`
    }
    return new NextResponse(new Uint8Array(dane), { headers: naglowki })
  } catch {
    return NextResponse.json({ blad: 'nie ma takiego pliku' }, { status: 404 })
  }
}
