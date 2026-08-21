import {
  deleteSandboxSession,
  listInputFiles,
  toCoworkSession,
} from "@/features/cortex-cowork/server/sandbox-store"
import { isDenied, requireSessionAccess } from "@/lib/cortex-governance/project-gate"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const { sessionId } = await params
  const gate = await requireSessionAccess(request, sessionId)
  if (isDenied(gate)) return gate
  const { session } = gate
  return NextResponse.json(toCoworkSession(session, await listInputFiles(session)))
}

/** Clears a session: deletes its sandbox (skills, artifacts, transcript). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const { sessionId } = await params
  const gate = await requireSessionAccess(request, sessionId)
  if (isDenied(gate)) return gate

  const deleted = await deleteSandboxSession(sessionId)
  if (!deleted) {
    return NextResponse.json({ message: `Session not found: ${sessionId}` }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
