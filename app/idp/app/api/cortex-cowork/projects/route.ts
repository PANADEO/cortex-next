import { requestEmail } from "@/lib/cortex-governance/request-identity"
import { readGovernanceConfig, visibleProjectsFor } from "@/lib/cortex-governance/store"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export interface CoworkProjectTile {
  id: string
  name: string
  description: string
  icon?: string
  exportEnabled: boolean
}

/**
 * Public (non-admin) list of task-chat projects visible to the requesting
 * user - what the hub renders as tiles. Only presentation fields leave the
 * server; model/connector/sandbox config stays admin-only.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = await readGovernanceConfig()
  const projects = visibleProjectsFor(config, requestEmail(request))
  const tiles: CoworkProjectTile[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    ...(project.icon ? { icon: project.icon } : {}),
    exportEnabled: Boolean(project.artifactExport?.exportDir),
  }))
  return NextResponse.json(tiles)
}
