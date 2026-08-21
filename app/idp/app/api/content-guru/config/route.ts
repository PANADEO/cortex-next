// GET /api/content-guru/config — jedyny sposób, w jaki klient (komponent
// "use client", zero RSC w tym repo) poznaje `CONTENT_GURU_MODELS` (D3,
// zrewidowane: lista modeli konfigurowana env-varem, wybór KONKRETNEGO
// modelu per generacja to `Select` na ekranie generowania). Env server-side
// nie jest dostępny w przeglądarce bez NEXT_PUBLIC_ — dublowanie configu pod
// tym prefiksem złamałoby "jedno źródło prawdy" (lib/content-guru/config.ts
// już jest tym źródłem), stąd cienki endpoint zamiast drugiej zmiennej.
//
// Gated tą samą bramką kafelka co /generate — lista modeli nie jest publiczna
// (design doc §6: 403 brak dostępu do kafelka, tak jak każdy inny endpoint
// modułu).

import { contentGuruConfig } from "@/lib/content-guru/config"
import { NextResponse, type NextRequest } from "next/server"
import { requireContentGuruAccess } from "../_lib/guard"

export const runtime = "nodejs"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await requireContentGuruAccess(request)
  if ("deny" in gate) return gate.deny

  return NextResponse.json({ models: contentGuruConfig().models })
}
