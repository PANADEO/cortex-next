import {
  deleteFrameTemplate,
  duplicateFrameTemplate,
  frameTemplateInputSchema,
  getRequestEmail,
  setFrameTemplateActive,
  updateFrameTemplate,
} from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { denyUnlessTemplateManager, toErrorResponse } from "../../_lib/guard"

export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

/** PATCH obsługuje trzy operacje z PoC: aktywacja/dezaktywacja, duplikacja
 *  i pełna aktualizacja. Rozróżniane po kształcie ciała, żeby nie mnożyć
 *  osobnych podścieżek dla jednolinijkowych akcji. */
const patchSchema = z.union([
  z.object({ action: z.literal("set-active"), isActive: z.boolean() }),
  z.object({ action: z.literal("duplicate") }),
  z.object({ action: z.literal("update"), template: frameTemplateInputSchema }),
])

export async function PATCH(request: NextRequest, context: Context): Promise<NextResponse> {
  const denied = await denyUnlessTemplateManager(request)
  if (denied) return denied

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-request", message: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }

  const { id } = await context.params

  try {
    switch (parsed.data.action) {
      case "set-active":
        return NextResponse.json(await setFrameTemplateActive(id, parsed.data.isActive))
      case "duplicate": {
        const createdBy = getRequestEmail(request.headers) ?? "system"
        return NextResponse.json(await duplicateFrameTemplate(id, createdBy), { status: 201 })
      }
      case "update":
        return NextResponse.json(await updateFrameTemplate(id, parsed.data.template))
    }
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function DELETE(request: NextRequest, context: Context): Promise<NextResponse> {
  const denied = await denyUnlessTemplateManager(request)
  if (denied) return denied

  const { id } = await context.params

  try {
    const deleted = await deleteFrameTemplate(id)
    if (!deleted) return NextResponse.json({ error: "not-found" }, { status: 404 })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return toErrorResponse(error)
  }
}
