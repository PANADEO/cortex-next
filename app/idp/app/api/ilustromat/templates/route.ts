import {
  createFrameTemplate,
  frameTemplateInputSchema,
  getRequestEmail,
  listFrameTemplates,
} from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { denyUnlessAllowed, denyUnlessTemplateManager, toErrorResponse } from "../_lib/guard"

export const runtime = "nodejs"

/** ODCZYT za bramką kafelka, nie za scope'em: end-user musi widzieć listę
 *  szablonów, żeby wybrać jeden do generacji. Zmieniać je może dopiero
 *  posiadacz scope'u (patrz POST niżej). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  try {
    const activeOnly = new URL(request.url).searchParams.get("activeOnly") === "true"
    return NextResponse.json(await listFrameTemplates(activeOnly))
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessTemplateManager(request)
  if (denied) return denied

  const parsed = frameTemplateInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-request", message: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }

  try {
    const createdBy = getRequestEmail(request.headers) ?? "system"
    return NextResponse.json(await createFrameTemplate(parsed.data, createdBy), { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
