import {
  artifactFilePath,
  findArtifact,
  getSandboxSession,
} from "@/features/cortex-cowork/server/sandbox-store"
import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string; artifactId: string }> },
): Promise<NextResponse | Response> {
  const { sessionId, artifactId } = await params
  const session = await getSandboxSession(sessionId)
  if (!session) {
    return NextResponse.json({ message: `Session not found: ${sessionId}` }, { status: 404 })
  }

  const artifact = findArtifact(session, artifactId)
  if (!artifact) {
    return NextResponse.json({ message: `Artifact not found: ${artifactId}` }, { status: 404 })
  }

  const buffer = await readFile(artifactFilePath(session, artifact)).catch(() => null)
  if (!buffer) {
    return NextResponse.json(
      { message: "Artifact file is missing from the sandbox" },
      { status: 410 },
    )
  }

  return new Response(buffer, {
    headers: {
      "Content-Type": artifact.mimeType,
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(artifact.filename)}"`,
    },
  })
}
