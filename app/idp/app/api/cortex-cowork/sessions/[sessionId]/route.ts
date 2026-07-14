import {
  deleteSandboxSession,
  getSandboxSession,
  toCoworkSession,
} from "@/features/cortex-cowork/server/sandbox-store"
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

/** Clears a session: deletes its sandbox (skills, artifacts, transcript). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const { sessionId } = await params
  const deleted = await deleteSandboxSession(sessionId)
  if (!deleted) {
    return NextResponse.json({ message: `Session not found: ${sessionId}` }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
