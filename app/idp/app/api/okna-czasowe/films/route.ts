import { filmInputSchema } from "@/features/okna-czasowe/schemas"
import type { Film } from "@/features/okna-czasowe/types"
import { store } from "@/lib/okna-czasowe/store"
import { randomUUID } from "node:crypto"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export async function GET(): Promise<NextResponse> {
  const films = await store.listFilms()
  return NextResponse.json(films)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = filmInputSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }, { status: 400 })
  }

  const now = new Date().toISOString()
  const film: Film = {
    id: randomUUID(),
    title: parsed.data.title,
    year: parsed.data.year,
    foreignTitles: parsed.data.foreignTitles,
    firstSeenAvailable: null,
    createdAt: now,
    updatedAt: now,
    ...(parsed.data.tmdbId ? { tmdbId: parsed.data.tmdbId } : {}),
  }

  const films = await store.listFilms()
  await store.saveFilms([...films, film])

  return NextResponse.json(film, { status: 201 })
}
