import { artifactFilePath, findArtifact } from "@/features/cortex-cowork/server/sandbox-store"
import { isDenied, requireSessionAccess } from "@/lib/cortex-governance/project-gate"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; artifactId: string }> },
): Promise<NextResponse | Response> {
  const { sessionId, artifactId } = await params
  const gate = await requireSessionAccess(request, sessionId)
  if (isDenied(gate)) return gate
  const { session } = gate

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
