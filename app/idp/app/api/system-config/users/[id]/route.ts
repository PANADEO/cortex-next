import { updateUser, userPatchSchema } from "@cortex/service"
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

  // PATCH przyjmuje SAME zmieniane pola — fullName i/albo isActive. isActive
  // przechodzi przez assertModuleStaysReachable w serwisie (dezaktywacja
  // ostatniego aktywnego admina => 409 self-lockout), nie tutaj.
  const parsed = userPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }

  const { id } = await context.params
  const invalidId = parseIdParam(id)
  if (invalidId) return invalidId

  try {
    const updated = await updateUser(id, parsed.data)
    if (!updated) return NextResponse.json({ error: "unknown-user" }, { status: 404 })
    return NextResponse.json({ ...updated.user, openwebuiSync: updated.openwebuiSync })
  } catch (error) {
    return toErrorResponse(error)
  }
}
