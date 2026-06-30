import { canAccessAiTool, isAiToolId } from "@/lib/ai-tools/app-codes"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getAccessResult, getRequestEmail } from "../../_lib/access"
import { listAiToolHistory } from "../../_lib/ai-tools-history"

export const runtime = "nodejs"

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  toolId: z.string().min(1),
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  const email = getRequestEmail(request.headers)
  if (!email) return NextResponse.json({ error: "missing-email" }, { status: 401 })

  const parsed = historyQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  )
  if (!parsed.success) return NextResponse.json({ error: "invalid-request" }, { status: 400 })

  const toolId = parsed.data.toolId
  if (!isAiToolId(toolId)) return NextResponse.json({ error: "unknown-tool" }, { status: 404 })

  const access = await getAccessResult(email)
  if (!canAccessAiTool(access.apps, toolId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  return NextResponse.json({
    items: listAiToolHistory(toolId, email, parsed.data.limit ?? 10),
  })
}
