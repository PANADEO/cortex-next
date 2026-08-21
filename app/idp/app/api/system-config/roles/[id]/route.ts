import { deleteRole, rolePatchSchema, updateRole } from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { denyUnlessAllowed, parseIdParam, toErrorResponse } from "../../_lib/guard"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  // `code` i `isSystem` nie są w rolePatchSchema — edycja dotyka wyłącznie
  // name/description, code pozostaje niezmienny po utworzeniu roli.
  const parsed = rolePatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }

  const { id } = await context.params
  const invalidId = parseIdParam(id)
  if (invalidId) return invalidId

  try {
    const updated = await updateRole(id, parsed.data)
    if (!updated) return NextResponse.json({ error: "unknown-role" }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const { id } = await context.params
  const invalidId = parseIdParam(id)
  if (invalidId) return invalidId

  try {
    const { removed, openwebuiSync } = await deleteRole(id)
    if (!removed) return NextResponse.json({ error: "unknown-role" }, { status: 404 })
    return NextResponse.json({ ok: true, openwebuiSync })
  } catch (error) {
    return toErrorResponse(error)
  }
}
