// GET /api/content-guru/archive/:id — szczegóły JEDNEGO wpisu archiwum
// (design doc §4.5, /content-guru/history/[id]). PER-USER — `undefined`
// (nie istnieje ALBO cudze) mapowane na 404, nigdy 403 (code-service
// "Rekordy per-user" pkt 2, wzorem client-profiles/[id]/route.ts).

import { getMyArchiveEntry } from "@cortex/service"
import { NextResponse, type NextRequest } from "next/server"
import { requireContentGuruAccess } from "../../_lib/guard"

export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context): Promise<NextResponse> {
  const gate = await requireContentGuruAccess(request)
  if ("deny" in gate) return gate.deny

  const { id } = await context.params
  const entry = await getMyArchiveEntry(gate.email, id)
  if (!entry) return NextResponse.json({ error: "not-found" }, { status: 404 })
  return NextResponse.json(entry)
}
