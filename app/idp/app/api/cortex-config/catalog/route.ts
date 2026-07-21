import { buildSkillCatalog } from "@/features/cortex-cowork/server/skills-catalog"
import { isDenied, requireAdmin } from "@/lib/cortex-governance/admin-gate"
import { allDepartments } from "@/lib/cortex-governance/store"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

/**
 * Full resource catalog for the cortex-config admin: departments, the resolved
 * skill catalog (scanned from sources), skill sources and connectors. Secrets
 * live in the credentials endpoint (values are write-only).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await requireAdmin(request)
  if (isDenied(gate)) return gate
  const { config } = gate
  return NextResponse.json({
    departments: allDepartments(config),
    skills: await buildSkillCatalog(config),
    skillSources: config.skillSources,
    connectors: config.connectors,
  })
}
