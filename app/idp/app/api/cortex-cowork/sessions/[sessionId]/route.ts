import { getSandboxSession, toCoworkSession } from "@/features/cortex-cowork/server/sandbox-store"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const { sessionId } = await params
  const session = await getSandboxSession(sessionId)
  if (!session) {
    return NextResponse.json({ message: `Session not found: ${sessionId}` }, { status: 404 })
  }
  return NextResponse.json(toCoworkSession(session))
}
