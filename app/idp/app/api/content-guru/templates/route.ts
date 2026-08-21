// GET/POST /api/content-guru/templates — design doc §6. GET za samą bramką
// kafelka: end-user musi widzieć listę, żeby wybrać szablon do generowania
// (Select kategoria->nazwa na ekranie /content-guru). POST (utworzenie)
// wymaga `manage-templates` — szablony są zasobem WSPÓLNYM (D6), edycja ich
// treści wpływa na promptu wszystkich userów kafelka.

import {
  createTemplate,
  getRequestEmail,
  listTemplates,
  templateInputSchema,
} from "@cortex/service"
import { NextResponse, type NextRequest } from "next/server"
import {
  isUniqueViolation,
  requireContentGuruAccess,
  requireContentGuruManageTemplates,
} from "../_lib/guard"

export const runtime = "nodejs"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await requireContentGuruAccess(request)
  if ("deny" in gate) return gate.deny

  return NextResponse.json(await listTemplates())
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireContentGuruManageTemplates(request)
  if ("deny" in gate) return gate.deny

  const parsed = templateInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-request", message: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }

  try {
    const createdBy = getRequestEmail(request.headers) ?? gate.email
    const created = await createTemplate(parsed.data, createdBy)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "duplicate" }, { status: 409 })
    }
    console.error("[content-guru] błąd tworzenia szablonu:", error)
    return NextResponse.json({ error: "internal-error" }, { status: 500 })
  }
}
