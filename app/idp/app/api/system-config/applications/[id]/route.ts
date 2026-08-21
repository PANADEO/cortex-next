import { applicationPatchSchema, deleteApplication, updateApplication } from "@cortex/service"
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

  // PATCH przyjmuje SAME zmieniane pola — reguły międzypolowe (natywny ma
  // route, zewnętrzny ma url) sprawdza serwis na wierszu po scaleniu.
  const parsed = applicationPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }

  const { id } = await context.params
  const invalidId = parseIdParam(id)
  if (invalidId) return invalidId

  try {
    const updated = await updateApplication(id, parsed.data)
    if (!updated) return NextResponse.json({ error: "unknown-application" }, { status: 404 })
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
    const removed = await deleteApplication(id)
    if (!removed) return NextResponse.json({ error: "unknown-application" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return toErrorResponse(error)
  }
}
