import { listApplicationScopeGrants } from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { denyUnlessAllowed, parseIdParam, toErrorResponse } from "../../../_lib/guard"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * D9/D10: macierz zakres -> role W JEDNYM żądaniu — ekran szczegółów
 * aplikacji renderuje całą sekcję "Zakresy" z jednego round-tripu, nie N.
 */
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const { id } = await context.params
  const invalidId = parseIdParam(id)
  if (invalidId) return invalidId

  try {
    return NextResponse.json(await listApplicationScopeGrants(id))
  } catch (error) {
    return toErrorResponse(error)
  }
}
