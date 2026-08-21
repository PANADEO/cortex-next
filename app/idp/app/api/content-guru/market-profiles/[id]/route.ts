// GET/PUT/DELETE /api/content-guru/market-profiles/:id — mirror
// client-profiles/[id]/route.ts, PER-USER (D7).

import {
  deleteMyMarketProfile,
  getMyMarketProfile,
  marketProfileInputSchema,
  updateMyMarketProfile,
} from "@cortex/service"
import { NextResponse, type NextRequest } from "next/server"
import { isUniqueViolation, requireContentGuruAccess } from "../../_lib/guard"

export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context): Promise<NextResponse> {
  const gate = await requireContentGuruAccess(request)
  if ("deny" in gate) return gate.deny

  const { id } = await context.params
  const profile = await getMyMarketProfile(gate.email, id)
  if (!profile) return NextResponse.json({ error: "not-found" }, { status: 404 })
  return NextResponse.json(profile)
}

export async function PUT(request: NextRequest, context: Context): Promise<NextResponse> {
  const gate = await requireContentGuruAccess(request)
  if ("deny" in gate) return gate.deny

  const parsed = marketProfileInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }

  const { id } = await context.params

  try {
    const updated = await updateMyMarketProfile(gate.email, id, parsed.data)
    if (!updated) return NextResponse.json({ error: "not-found" }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "duplicate" }, { status: 409 })
    }
    console.error("[content-guru] błąd aktualizacji profilu rynku:", error)
    return NextResponse.json({ error: "internal-error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: Context): Promise<NextResponse> {
  const gate = await requireContentGuruAccess(request)
  if ("deny" in gate) return gate.deny

  const { id } = await context.params
  const deleted = await deleteMyMarketProfile(gate.email, id)
  if (!deleted) return NextResponse.json({ error: "not-found" }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
