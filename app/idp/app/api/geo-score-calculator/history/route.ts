// GET /api/geo-score-calculator/history — lista historii WŁAŚCICIELA
// (code-service "Rekordy per-user", listMyCalculations()). DTO trymowana do
// tego, czego potrzebuje CortexDataGrid (data/podgląd/wynik/ocena/słowa) —
// `textContent`/`result`/`configSnapshot` bywają duże (tekst do
// TEXT_MAX_CHARS + pełna odpowiedź mikroserwisu) i nie są potrzebne na
// liście; pełny wiersz jest pod GET .../history/:id (ekran szczegółów).

import { getRequestEmail, listMyCalculations } from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { denyUnlessAllowed } from "../_lib/guard"

export const runtime = "nodejs"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  // denyUnlessAllowed już potwierdziło, że nagłówek niesie znany, uprawniony
  // e-mail — tu tylko go odczytujemy (bez drugiego zapytania do RBAC/cache).
  const email = getRequestEmail(request.headers)
  if (!email) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const rows = await listMyCalculations(email)
  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      textPreview: row.textPreview,
      wordCount: row.wordCount,
      totalScore: row.totalScore,
      grade: row.grade,
      createdAt: row.createdAt,
    })),
  )
}
