// GET/PUT/DELETE /api/content-guru/client-profiles/:id — PER-USER, scoped do
// gate.email w każdej warstwie serwisowej. `undefined`/`false` (nie istnieje
// LUB cudzy) mapowane na 404, nigdy 403 (code-service "Rekordy per-user" pkt 2).

import {
  clientProfileInputSchema,
  deleteMyClientProfile,
  getMyClientProfile,
  updateMyClientProfile,
} from "@cortex/service"
import { NextResponse, type NextRequest } from "next/server"
import { isUniqueViolation, requireContentGuruAccess } from "../../_lib/guard"

export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context): Promise<NextResponse> {
  const gate = await requireContentGuruAccess(request)
  if ("deny" in gate) return gate.deny

  const { id } = await context.params
  const profile = await getMyClientProfile(gate.email, id)
  if (!profile) return NextResponse.json({ error: "not-found" }, { status: 404 })
  return NextResponse.json(profile)
}

export async function PUT(request: NextRequest, context: Context): Promise<NextResponse> {
  const gate = await requireContentGuruAccess(request)
  if ("deny" in gate) return gate.deny

  const parsed = clientProfileInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-request", message: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }

  const { id } = await context.params

  try {
    const updated = await updateMyClientProfile(gate.email, id, parsed.data)
    if (!updated) return NextResponse.json({ error: "not-found" }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "duplicate" }, { status: 409 })
    }
    console.error("[content-guru] błąd aktualizacji profilu klienta:", error)
    return NextResponse.json({ error: "internal-error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: Context): Promise<NextResponse> {
  const gate = await requireContentGuruAccess(request)
  if ("deny" in gate) return gate.deny

  const { id } = await context.params
  const deleted = await deleteMyClientProfile(gate.email, id)
  if (!deleted) return NextResponse.json({ error: "not-found" }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
