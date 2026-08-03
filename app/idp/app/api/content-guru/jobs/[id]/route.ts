// GET /api/content-guru/jobs/:id — polling dla trybów batch/pakiet (D4 krok
// 4). W przeciwieństwie do Parsera Dokumentów (GET /document-parser/jobs/:id)
// nie ma tu ZEWNĘTRZNEGO backendu do odpytania na każdym pollu — Content
// Guru generuje IN-PROCESS (design doc D2/D4), więc Postgres jest jedynym i
// zawsze aktualnym źródłem prawdy: orkiestracja
// (lib/content-guru/run-batch-generation.ts) pisze do niego bezpośrednio w
// miarę postępu, ten route tylko czyta.

import { NextResponse, type NextRequest } from "next/server"
import { getMyGenerationJob } from "@cortex/service"
import { requireContentGuruAccess } from "../../_lib/guard"

export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context): Promise<NextResponse> {
  const gate = await requireContentGuruAccess(request)
  if ("deny" in gate) return gate.deny
  const { email } = gate

  const { id } = await context.params
  // undefined = "nie istnieje" ALBO "cudze" (code-service "Rekordy per-user"
  // pkt 2) — oba mapowane na 404, NIGDY 403.
  const job = await getMyGenerationJob(email, id)
  if (!job) return NextResponse.json({ error: "not-found" }, { status: 404 })

  return NextResponse.json(job)
}
