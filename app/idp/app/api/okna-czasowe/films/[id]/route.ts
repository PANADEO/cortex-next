import { filmInputSchema } from "@/features/okna-czasowe/schemas"
import type { Film } from "@/features/okna-czasowe/types"
import { store } from "@/lib/okna-czasowe/store"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { denyUnlessAllowed } from "../../_lib/guard"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const { id } = await context.params
  const parsed = filmInputSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }, { status: 400 })
  }

  const films = await store.listFilms()
  const existing = films.find((f) => f.id === id)
  if (!existing) {
    return NextResponse.json({ message: "Film nie znaleziony" }, { status: 404 })
  }

  const updated: Film = {
    id: existing.id,
    title: parsed.data.title,
    year: parsed.data.year,
    foreignTitles: parsed.data.foreignTitles,
    firstSeenAvailable: existing.firstSeenAvailable,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    // Only set `tmdbId` when present — exactOptionalPropertyTypes treats an explicit
    // `undefined` differently from an absent key, so the key must be omitted, not nulled.
    ...(parsed.data.tmdbId ? { tmdbId: parsed.data.tmdbId } : {}),
  }

  await store.saveFilms(films.map((f) => (f.id === id ? updated : f)))

  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const { id } = await context.params
  const films = await store.listFilms()
  const remaining = films.filter((f) => f.id !== id)
  if (remaining.length === films.length) {
    return NextResponse.json({ message: "Film nie znaleziony" }, { status: 404 })
  }

  await store.saveFilms(remaining)
  return NextResponse.json({ ok: true })
}
