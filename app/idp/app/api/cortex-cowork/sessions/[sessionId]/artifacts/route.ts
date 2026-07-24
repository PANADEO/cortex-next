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

  return NextResponse.json(session.artifacts)
}
