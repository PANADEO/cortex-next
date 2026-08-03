// Kontroler HTTP (code-api) — cienki: auth -> deleguj -> odpowiedz. Lista
// archiwum (design doc §6.2) — CortexDataGrid filtruje/sortuje/paginuje po
// stronie przeglądarki nad całą tablicą, więc ten route nie przyjmuje
// page/sort/search (code-service/SKILL.md "Rekordy per-user" pkt 4).

import { listMyGenerationsWithFirstVariant } from "@cortex/service"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { requireVisualGuruAccess, toErrorResponse } from "../_lib/guard"
import type { GenerationListItemDto } from "@/features/visual-guru/types"

export const runtime = "nodejs"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const access = await requireVisualGuruAccess(request)
  if (!access.allowed) return access.response

  try {
    const rows = await listMyGenerationsWithFirstVariant(access.email)
    const items: GenerationListItemDto[] = rows.map((row) => ({
      id: row.id,
      prompt: row.prompt,
      model: row.model,
      variantCount: row.variantCount,
      hadReferenceImage: row.hadReferenceImage,
      createdAt: row.createdAt.toISOString(),
      firstVariantDataUrl: row.firstVariantImage
        ? `data:${row.firstVariantContentType};base64,${row.firstVariantImage.toString("base64")}`
        : null,
    }))
    return NextResponse.json(items)
  } catch (error) {
    return toErrorResponse(error)
  }
}
