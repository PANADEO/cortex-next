import { runChatTurn } from "@/features/cortex-cowork/server/chat-engine"
import { recordUserMessage } from "@/features/cortex-cowork/server/sandbox-store"
import { isDenied, requireSessionAccess } from "@/lib/cortex-governance/project-gate"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

interface SendMessageBody {
  content?: unknown
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const { sessionId } = await params
  const gate = await requireSessionAccess(request, sessionId)
  if (isDenied(gate)) return gate
  const { session, email } = gate

  const body = (await request.json().catch(() => null)) as SendMessageBody | null
  const content = typeof body?.content === "string" ? body.content.trim() : ""
  if (!content) {
    return NextResponse.json({ message: "content is required" }, { status: 400 })
  }

  await recordUserMessage(session, content)
  const result = await runChatTurn(session, content, { userEmail: email })
  return NextResponse.json(result)
}
