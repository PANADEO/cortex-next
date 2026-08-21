import { applicationInputSchema, createApplication, listApplications } from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { denyUnlessAllowed, toErrorResponse } from "../_lib/guard"

export const runtime = "nodejs"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  try {
    return NextResponse.json(await listApplications())
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const parsed = applicationInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }

  try {
    return NextResponse.json(await createApplication(parsed.data), { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
