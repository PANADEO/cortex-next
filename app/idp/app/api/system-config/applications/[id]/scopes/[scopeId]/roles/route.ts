import {
  UnknownApplicationScopeError,
  UnknownRoleError,
  setApplicationScopeRoles,
} from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { denyUnlessAllowed, parseIdParam, toErrorResponse } from "../../../../../_lib/guard"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string; scopeId: string }>
}

const bodySchema = z.object({
  roleIds: z.array(z.string().uuid()).max(200),
})

/**
 * D9/D10: granty JEDNEJ kolumny macierzy (jeden zakres -> komplet ról).
 * Zapis wsadowy z UI woła to raz PER ZMIENIONĄ KOLUMNĘ, równolegle — nie
 * ten route decyduje o wsadowości, tylko wołający (aplikacje/[code]/page.tsx).
 */
export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }

  const { id, scopeId } = await context.params
  const invalidApplicationId = parseIdParam(id)
  if (invalidApplicationId) return invalidApplicationId
  const invalidScopeId = parseIdParam(scopeId)
  if (invalidScopeId) return invalidScopeId

  try {
    await setApplicationScopeRoles(id, scopeId, parsed.data.roleIds)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnknownApplicationScopeError) {
      return NextResponse.json({ error: "unknown-scope" }, { status: 404 })
    }
    if (error instanceof UnknownRoleError) {
      return NextResponse.json({ error: "unknown-role" }, { status: 400 })
    }
    return toErrorResponse(error)
  }
}
