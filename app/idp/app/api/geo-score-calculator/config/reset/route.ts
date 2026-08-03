// POST /api/geo-score-calculator/config/reset — przywraca WSPÓLNĄ
// konfigurację do wartości domyślnych (GEO_SCORE_CONFIG_DEFAULTS, 1:1 z
// geo_calc/app/backend/constants.py i seed-geo-score-calculator.mjs).
//
// Osobny endpoint zamiast "PUT z wartościami domyślnymi z bundla klienta" —
// jedyne źródło prawdy o defaultach ma żyć po stronie serwera
// (@cortex/service), nie być duplikowane do kodu klienta. UI woła to
// WYŁĄCZNIE po potwierdzeniu w `AlertDialog` (design doc §4.4: "dziś
// jednoklikowe, ryzykowne dla współdzielonej konfiguracji" — reset dotyka
// wszystkich userów instancji, nie tylko klikającego admina).

import { GeoScoreConfigMissingError, getRequestEmail, resetGeoScoreConfig } from "@cortex/service"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { denyUnlessAllowed } from "../../_lib/guard"
import { toGeoScoreConfigDto } from "../../_lib/config-dto"

export const runtime = "nodejs"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const email = getRequestEmail(request.headers)
  if (!email) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  try {
    const reset = await resetGeoScoreConfig(email)
    return NextResponse.json(toGeoScoreConfigDto(reset))
  } catch (error) {
    if (error instanceof GeoScoreConfigMissingError) {
      console.error("[geo-score-calculator] config-missing:", error)
      return NextResponse.json({ error: "config-missing" }, { status: 500 })
    }
    throw error
  }
}
