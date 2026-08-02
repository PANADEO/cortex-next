// Kandydaci do "Dodaj aplikację" (kind=native): manifesty zarejestrowane w
// kodzie (@cortex/tile-sdk defineTile(), packages/@cortex/db/scripts/
// seed-tile-manifests.mjs), jeszcze nigdy nie aktywowane w tej instancji
// (D6-rewizja/D10-rewizja d, PROJECT/cortex-frontend-hub-db-driven-projekt.md).
// Admin-only — ta sama bramka co GET /api/system-config/applications, nie
// bramka huba (D7 tej ścieżki nie dotyczy, to nie metadane renderu).
import { listUnactivatedNativeApplications } from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { denyUnlessAllowed, toErrorResponse } from "../../_lib/guard"

export const runtime = "nodejs"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  try {
    return NextResponse.json(await listUnactivatedNativeApplications())
  } catch (error) {
    return toErrorResponse(error)
  }
}
