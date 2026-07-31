import { listApplicationScopes } from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { denyUnlessAllowed, parseIdParam, toErrorResponse } from "../../../_lib/guard"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * D8/D10: katalog zakresów granularnych tej aplikacji — WYŁĄCZNIE odczyt.
 * Brak POST/DELETE tu i w rodzeństwie tego katalogu: `application_scopes`
 * jest własnością seeda modułu, nie tego API (zobacz seed-ilustromat.mjs).
 */
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const { id } = await context.params
  const invalidId = parseIdParam(id)
  if (invalidId) return invalidId

  try {
    return NextResponse.json(await listApplicationScopes(id))
  } catch (error) {
    return toErrorResponse(error)
  }
}
