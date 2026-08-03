// GET/DELETE /api/geo-score-calculator/history/:id — szczegóły i usunięcie
// JEDNEJ kalkulacji WŁAŚCICIELA (code-service "Rekordy per-user",
// getMyCalculation()/deleteMyCalculation()). `undefined`/`false` z serwisu
// (nie istnieje ALBO cudze) mapuje się na 404, NIGDY 403 — 403 zdradzałby, że
// rekord o tym id w ogóle istnieje.
//
// GET zwraca PEŁNY wiersz (w odróżnieniu od listy w history/route.ts) —
// `result` i `configSnapshot` to dokładnie to, czego potrzebuje ekran
// szczegółów: ten sam layout wyniku co Kalkulator (GeoScoreResultView) plus
// pełna migawka configu użytego do tego wyniku (audytowalność, design doc
// §4.3 — "czego dzisiejszy UI nie eksponuje mimo że dane już są zapisywane").

import { deleteMyCalculation, getMyCalculation, getRequestEmail } from "@cortex/service"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { denyUnlessAllowed } from "../../_lib/guard"

export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const email = getRequestEmail(request.headers)
  if (!email) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const { id } = await context.params
  const row = await getMyCalculation(email, id)
  if (!row) return NextResponse.json({ error: "not-found" }, { status: 404 })

  return NextResponse.json({
    id: row.id,
    textContent: row.textContent,
    textPreview: row.textPreview,
    wordCount: row.wordCount,
    totalScore: row.totalScore,
    grade: row.grade,
    statsScore: row.statsScore,
    verbsScore: row.verbsScore,
    structureScore: row.structureScore,
    objectivityScore: row.objectivityScore,
    result: row.result,
    configSnapshot: row.configSnapshot,
    createdAt: row.createdAt,
  })
}

export async function DELETE(request: NextRequest, context: Context): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const email = getRequestEmail(request.headers)
  if (!email) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const { id } = await context.params
  const removed = await deleteMyCalculation(email, id)
  if (!removed) return NextResponse.json({ error: "not-found" }, { status: 404 })

  return NextResponse.json({ ok: true })
}
