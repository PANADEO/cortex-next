import { applicationScopePatchSchema, renameApplicationScope } from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { denyUnlessAllowed, parseIdParam, toErrorResponse } from "../../../../_lib/guard"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string; scopeId: string }>
}

/**
 * D8/D10: jedyna mutacja dozwolona na `application_scopes` z tego API —
 * etykieta (`name`), czysto opisowa. `code` pozostaje niezmienny (nie ma go
 * w applicationScopePatchSchema), bo po nim requireTileScope() sprawdza
 * dosłowny literał zaszyty w kodzie wołającego modułu.
 */
export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const parsed = applicationScopePatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }

  const { id, scopeId } = await context.params
  const invalidApplicationId = parseIdParam(id)
  if (invalidApplicationId) return invalidApplicationId
  const invalidScopeId = parseIdParam(scopeId)
  if (invalidScopeId) return invalidScopeId

  try {
    const updated = await renameApplicationScope(id, scopeId, parsed.data.name)
    if (!updated) return NextResponse.json({ error: "unknown-scope" }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error) {
    return toErrorResponse(error)
  }
}
