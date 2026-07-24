import {
  ExportNotConfiguredError,
  exportArtifactToShare,
} from "@/features/cortex-cowork/server/artifact-export"
import { findArtifact } from "@/features/cortex-cowork/server/sandbox-store"
import { isDenied, requireSessionAccess } from "@/lib/cortex-governance/project-gate"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

/** Copies an artifact to the project's export share; returns the paste path. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; artifactId: string }> },
): Promise<NextResponse> {
  const { sessionId, artifactId } = await params
  const gate = await requireSessionAccess(request, sessionId)
  if (isDenied(gate)) return gate
  const { session } = gate

  const artifact = findArtifact(session, artifactId)
  if (!artifact) {
    return NextResponse.json({ message: `Artifact not found: ${artifactId}` }, { status: 404 })
  }

  try {
    const result = await exportArtifactToShare(session, artifact)
    return NextResponse.json(result)
  } catch (error) {
    // Missing configuration is the caller-fixable case; anything else is an
    // I/O failure on the share (EACCES, ENOSPC) and must read as a 500.
    if (error instanceof ExportNotConfiguredError) {
      return NextResponse.json({ message: error.message }, { status: 400 })
    }
    console.error("[cortex-cowork] artifact export failed:", error)
    return NextResponse.json({ message: "Export failed - check server logs" }, { status: 500 })
  }
}
