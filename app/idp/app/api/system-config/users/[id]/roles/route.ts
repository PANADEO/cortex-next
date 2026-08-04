import { UnknownRoleError, UnknownUserError, setUserRoles } from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { denyUnlessAllowed, parseIdParam, toErrorResponse } from "../../../_lib/guard"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

const bodySchema = z.object({
  roleIds: z.array(z.string().uuid()).max(50),
})

export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }

  const { id } = await context.params
  const invalidId = parseIdParam(id)
  if (invalidId) return invalidId

  try {
    const openwebuiSync = await setUserRoles(id, parsed.data.roleIds)
    return NextResponse.json({ ok: true, openwebuiSync })
  } catch (error) {
    if (error instanceof UnknownUserError) {
      return NextResponse.json({ error: "unknown-user" }, { status: 404 })
    }
    if (error instanceof UnknownRoleError) {
      return NextResponse.json({ error: "unknown-role" }, { status: 400 })
    }
    return toErrorResponse(error)
  }
}
