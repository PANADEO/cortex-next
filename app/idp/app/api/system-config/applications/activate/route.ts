// Aktywacja jednego zarejestrowanego-ale-nieaktywnego wiersza `kind=native`
// (D6-rewizja/D10-rewizja d, PROJECT/cortex-frontend-hub-db-driven-projekt.md)
// — jedyny sposób, w jaki taki wiersz może stać się aktywny/widoczny.
// Admin-only, ta sama bramka co reszta modułu Aplikacje. Kod (nie id) w body:
// to ten sam identyfikator, którym manifest zarejestrował się w
// seed-tile-manifests.mjs, i jedyne pole, którego ten formularz potrzebuje.
import { activateApplication, activateApplicationInputSchema } from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { denyUnlessAllowed, toErrorResponse } from "../../_lib/guard"

export const runtime = "nodejs"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const parsed = activateApplicationInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }

  try {
    const activated = await activateApplication(parsed.data.code)
    if (!activated) return NextResponse.json({ error: "unknown-application" }, { status: 404 })
    return NextResponse.json(activated)
  } catch (error) {
    return toErrorResponse(error)
  }
}
