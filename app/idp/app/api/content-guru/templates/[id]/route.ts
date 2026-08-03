// GET/PUT/DELETE /api/content-guru/templates/:id — design doc §6. GET za
// samą bramką kafelka (jak lista), PUT/DELETE wymagają `manage-templates`.

import { NextResponse, type NextRequest } from "next/server"
import { deleteTemplate, getTemplate, templateInputSchema, updateTemplate } from "@cortex/service"
import { isUniqueViolation, requireContentGuruAccess, requireContentGuruManageTemplates } from "../../_lib/guard"

export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context): Promise<NextResponse> {
  const gate = await requireContentGuruAccess(request)
  if ("deny" in gate) return gate.deny

  const { id } = await context.params
  const template = await getTemplate(id)
  if (!template) return NextResponse.json({ error: "not-found" }, { status: 404 })
  return NextResponse.json(template)
}

export async function PUT(request: NextRequest, context: Context): Promise<NextResponse> {
  const gate = await requireContentGuruManageTemplates(request)
  if ("deny" in gate) return gate.deny

  const parsed = templateInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-request", message: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }

  const { id } = await context.params

  try {
    const updated = await updateTemplate(id, parsed.data)
    if (!updated) return NextResponse.json({ error: "not-found" }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "duplicate" }, { status: 409 })
    }
    console.error("[content-guru] błąd aktualizacji szablonu:", error)
    return NextResponse.json({ error: "internal-error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: Context): Promise<NextResponse> {
  const gate = await requireContentGuruManageTemplates(request)
  if ("deny" in gate) return gate.deny

  const { id } = await context.params
  const deleted = await deleteTemplate(id)
  if (!deleted) return NextResponse.json({ error: "not-found" }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
