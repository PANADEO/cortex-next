import {
  readGovernanceConfig,
  sessionSkillIds,
} from "@/features/cortex-cowork/server/config-store"
import { requestEmail } from "@/features/cortex-cowork/server/request-identity"
import {
  createSandboxSession,
  toCoworkSession,
} from "@/features/cortex-cowork/server/sandbox-store"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

interface CreateSessionBody {
  projectId?: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => ({}))) as CreateSessionBody
    const projectId = body.projectId ?? "cortex-cowork"

    const config = await readGovernanceConfig()
    const project = config.projects.find((candidate) => candidate.id === projectId)
    if (!project || !project.enabled) {
      return NextResponse.json({ message: `Unknown project: ${projectId}` }, { status: 404 })
    }

    const skillIds = sessionSkillIds(config, project, requestEmail(request))
    const session = await createSandboxSession(project, skillIds)
    return NextResponse.json(toCoworkSession(session), { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create sandbox session" },
      { status: 500 },
    )
  }
}
