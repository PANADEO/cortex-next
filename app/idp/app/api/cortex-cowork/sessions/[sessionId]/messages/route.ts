import { runChatTurn } from "@/features/cortex-cowork/server/chat-engine"
import { getSandboxSession, recordUserMessage } from "@/features/cortex-cowork/server/sandbox-store"
import { requestEmail } from "@/lib/cortex-governance/request-identity"
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
  const session = await getSandboxSession(sessionId)
  if (!session) {
    return NextResponse.json({ message: `Session not found: ${sessionId}` }, { status: 404 })
  }

  const body = (await request.json().catch(() => null)) as SendMessageBody | null
  const content = typeof body?.content === "string" ? body.content.trim() : ""
  if (!content) {
    return NextResponse.json({ message: "content is required" }, { status: 400 })
  }

  await recordUserMessage(session, content)
  const result = await runChatTurn(session, content, { userEmail: requestEmail(request) })
  return NextResponse.json(result)
}
