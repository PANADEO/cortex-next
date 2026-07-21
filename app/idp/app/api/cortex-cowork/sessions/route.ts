import { contextWindowFor } from "@/features/cortex-cowork/server/model-context"
import {
  createSandboxSession,
  listSessionSummaries,
  toCoworkSession,
} from "@/features/cortex-cowork/server/sandbox-store"
import { resolveGrantedSkills } from "@/features/cortex-cowork/server/skills-catalog"
import { readGovernanceConfig } from "@/lib/cortex-governance/store"
import { DEFAULT_COWORK_PROJECT_ID } from "@cortex/types"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

interface CreateSessionBody {
  projectId?: string
}

/** Session summaries for a project (session switcher). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const projectId = request.nextUrl.searchParams.get("projectId") ?? DEFAULT_COWORK_PROJECT_ID
  return NextResponse.json(await listSessionSummaries(projectId))
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => ({}))) as CreateSessionBody
    const projectId = body.projectId ?? DEFAULT_COWORK_PROJECT_ID

    const config = await readGovernanceConfig()
    const project = config.projects.find((candidate) => candidate.id === projectId)
    if (!project || !project.enabled) {
      return NextResponse.json({ message: `Unknown project: ${projectId}` }, { status: 404 })
    }

    // Access to the tile is gated by roles (visibleProjectsFor); the toolkit
    // inside is the project's composition, same for every user who can open it.
    const grantedSkills = await resolveGrantedSkills(config, project)
    const session = await createSandboxSession(
      project,
      grantedSkills,
      contextWindowFor(project.model),
    )
    return NextResponse.json(toCoworkSession(session), { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create sandbox session" },
      { status: 500 },
    )
  }
}
