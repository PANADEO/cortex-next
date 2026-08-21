// GET /api/content-guru/archive — lista własnego archiwum treści (design doc
// §4.5, Round D) — konsumowana przez CortexDataGrid na /content-guru/history.
// `listMyArchive()` istniało od Round A (auto-log KAŻDEJ generacji), ale
// żaden route go dotąd nie wołał — to jest ten pierwszy. PER-USER:
// gate.email jedyne źródło filtra (code-service "Rekordy per-user" pkt 3).

import { listMyArchive } from "@cortex/service"
import { NextResponse, type NextRequest } from "next/server"
import { requireContentGuruAccess } from "../_lib/guard"

export const runtime = "nodejs"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await requireContentGuruAccess(request)
  if ("deny" in gate) return gate.deny

  return NextResponse.json(await listMyArchive(gate.email))
}
