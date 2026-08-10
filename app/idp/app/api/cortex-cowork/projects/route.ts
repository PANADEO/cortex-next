import { bootstrapTrusts, denyAnonymous } from "@/lib/cortex-governance/bootstrap-trust"
import { requestEmail } from "@/lib/cortex-governance/request-identity"
import { isOpenMode, readGovernanceConfig, visibleProjectsFor } from "@/lib/cortex-governance/store"
import { COWORK_APP_CODE } from "@/lib/tiles"
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
 *
 * A caller without the `cortex-cowork` grant falls into that second case even
 * in open mode: the empty list is exactly what the hub already renders for
 * them (hub/use-hub-model.ts gates this section on the same grant), so the API stops
 * handing out project names, descriptions and briefs that the UI would not
 * have shown. Why the grant is what bootstrap keys off: bootstrap-trust.ts.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = await readGovernanceConfig()
  const email = requestEmail(request)

  const anonymous = denyAnonymous(email)
  if (anonymous) return anonymous

  const projects =
    isOpenMode(config) && !(await bootstrapTrusts(request, COWORK_APP_CODE))
      ? []
      : visibleProjectsFor(config, email)
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
