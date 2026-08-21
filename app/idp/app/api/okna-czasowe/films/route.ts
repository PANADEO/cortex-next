import { filmInputSchema } from "@/features/okna-czasowe/schemas"
import type { Film } from "@/features/okna-czasowe/types"
import { store } from "@/lib/okna-czasowe/store"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { denyUnlessAllowed } from "../_lib/guard"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const films = await store.listFilms()
  return NextResponse.json(films)
}

// Bramka PRZED odczytem ciała i przed walidacją: żądanie bez uprawnień ma
// dostać 401/403, a nie 400 na złym ciele — inaczej odmowa zależałaby od tego,
// czy intruz trafił w schemat.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const parsed = filmInputSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" },
      { status: 400 },
    )
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
