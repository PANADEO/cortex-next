import { denyAnonymous } from "@/lib/cortex-governance/project-gate"
import { requestEmail } from "@/lib/cortex-governance/request-identity"
import { readGovernanceConfig, visibleProjectsFor } from "@/lib/cortex-governance/store"
import type { CoworkProjectTileInfo } from "@cortex/types"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

/**
 * Public (non-admin) list of task-chat projects visible to the requesting
 * user - what the hub renders as tiles. Only presentation fields leave the
 * server; model/connector/sandbox config stays admin-only.
 *
 * Two different answers, on purpose: no identity at all is 401 (same as the
 * sessions gate and /api/me/access - see denyAnonymous), while an identified
 * user holding no matching role gets 200 with an empty list, because that is
 * a tile list to render, not an operation on a resource.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = await readGovernanceConfig()
  const email = requestEmail(request)

  const anonymous = denyAnonymous(config, email)
  if (anonymous) return anonymous

  const projects = visibleProjectsFor(config, email)
  const tiles: CoworkProjectTileInfo[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    ...(project.icon ? { icon: project.icon } : {}),
    exportEnabled: Boolean(project.artifactExport?.exportDir),
    briefs: project.briefs ?? [],
  }))
  return NextResponse.json(tiles)
}
