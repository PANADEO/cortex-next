import {
  ExportNotConfiguredError,
  exportArtifactToShare,
} from "@/features/cortex-cowork/server/artifact-export"
import { findArtifact, getSandboxSession } from "@/features/cortex-cowork/server/sandbox-store"
import { NextResponse } from "next/server"

/** Copies an artifact to the project's export share; returns the paste path. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string; artifactId: string }> },
): Promise<NextResponse> {
  const { sessionId, artifactId } = await params
  const session = await getSandboxSession(sessionId)
  if (!session) {
    return NextResponse.json({ message: `Session not found: ${sessionId}` }, { status: 404 })
  }
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
