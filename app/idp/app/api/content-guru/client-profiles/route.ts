// GET/POST /api/content-guru/client-profiles — design doc §6/D7. PER-USER:
// zawsze scoped do `access.email` z requireContentGuruAccess(), nigdy z ciała
// żądania (code-service "Rekordy per-user" pkt 3). Żaden dodatkowy scope —
// właściciel zawsze zarządza własnymi profilami (D9).

import { NextResponse, type NextRequest } from "next/server"
import { clientProfileInputSchema, createClientProfile, listMyClientProfiles } from "@cortex/service"
import { isUniqueViolation, requireContentGuruAccess } from "../_lib/guard"

export const runtime = "nodejs"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await requireContentGuruAccess(request)
  if ("deny" in gate) return gate.deny

  return NextResponse.json(await listMyClientProfiles(gate.email))
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireContentGuruAccess(request)
  if ("deny" in gate) return gate.deny

  const parsed = clientProfileInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-request", message: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }

  try {
    const created = await createClientProfile(gate.email, parsed.data)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "duplicate" }, { status: 409 })
    }
    console.error("[content-guru] błąd tworzenia profilu klienta:", error)
    return NextResponse.json({ error: "internal-error" }, { status: 500 })
  }
}
