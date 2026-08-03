// POST /api/content-guru/templates/:id/duplicate — kopiuje treść+kategorię
// pod nazwą "(kopia)" (design doc §4.2 "duplikuj" w DropdownMenu wiersza).
// `manage-templates`, jak każda inna mutacja szablonów.

import { NextResponse, type NextRequest } from "next/server"
import { duplicateTemplate, getRequestEmail } from "@cortex/service"
import { isUniqueViolation, requireContentGuruManageTemplates } from "../../../_lib/guard"

export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: Context): Promise<NextResponse> {
  const gate = await requireContentGuruManageTemplates(request)
  if ("deny" in gate) return gate.deny

  const { id } = await context.params

  try {
    const createdBy = getRequestEmail(request.headers) ?? gate.email
    const duplicated = await duplicateTemplate(id, createdBy)
    if (!duplicated) return NextResponse.json({ error: "not-found" }, { status: 404 })
    return NextResponse.json(duplicated, { status: 201 })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "duplicate" }, { status: 409 })
    }
    console.error("[content-guru] błąd duplikacji szablonu:", error)
    return NextResponse.json({ error: "internal-error" }, { status: 500 })
  }
}
