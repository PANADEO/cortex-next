// Kontroler HTTP (code-api) — szczegóły JEDNEJ generacji (§6.3) i usunięcie
// (AlertDialog na kliencie potwierdza PRZED wysyłką DELETE, nie tutaj).
// Właścicielstwo egzekwowane w warstwie serwisowej (WHERE, nie po fetchu) —
// undefined/false z getMyGeneration()/deleteGeneration() to zarówno "nie
// istnieje", jak i "cudze" (code-service/SKILL.md "Rekordy per-user" pkt 2)
// — mapowane tu na 404, NIGDY 403 (403 zdradzałby, że rekord o tym id w
// ogóle istnieje).

import type { GenerationDetailDto } from "@/features/visual-guru/types"
import { deleteGeneration, getMyGeneration } from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireVisualGuruAccess, toErrorResponse } from "../../_lib/guard"

export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context): Promise<NextResponse> {
  const access = await requireVisualGuruAccess(request)
  if (!access.allowed) return access.response

  const { id } = await context.params

  try {
    const generation = await getMyGeneration(access.email, id)
    if (!generation) return NextResponse.json({ error: "not-found" }, { status: 404 })

    const body: GenerationDetailDto = {
      id: generation.id,
      prompt: generation.prompt,
      additionalContext: generation.additionalContext,
      model: generation.model,
      variantCount: generation.variantCount,
      hadReferenceImage: generation.hadReferenceImage,
      referenceImageFileName: generation.referenceImageFileName,
      createdAt: generation.createdAt.toISOString(),
      variants: generation.variants.map((variant) => ({
        variantIndex: variant.variantIndex,
        dataUrl: `data:${variant.contentType};base64,${variant.image.toString("base64")}`,
      })),
    }
    return NextResponse.json(body)
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function DELETE(request: NextRequest, context: Context): Promise<NextResponse> {
  const access = await requireVisualGuruAccess(request)
  if (!access.allowed) return access.response

  const { id } = await context.params

  try {
    const deleted = await deleteGeneration(access.email, id)
    if (!deleted) return NextResponse.json({ error: "not-found" }, { status: 404 })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return toErrorResponse(error)
  }
}
