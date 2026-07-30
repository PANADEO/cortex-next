import { buildSkillCatalog } from "@/features/cortex-cowork/server/skills-catalog"
import { denyAnonymous } from "@/lib/cortex-governance/bootstrap-trust"
import { requestEmail } from "@/lib/cortex-governance/request-identity"
import { readGovernanceConfig } from "@/lib/cortex-governance/store"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

/**
 * The resolved skill catalog (all sources), for skill pickers.
 *
 * Identity required, no further role check: the payload is metadata (ids,
 * names, descriptions, department assignment) rather than a resource to act
 * on, but it still maps out the organisation's internal structure, so it is
 * not for unauthenticated callers. Until 30.07.2026 this handler had no gate
 * at all and served the whole catalog to any request. The role-scoped
 * question ("which skills does THIS project compose") is answered by the
 * project config, not here.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = await readGovernanceConfig()

  const anonymous = denyAnonymous(requestEmail(request))
  if (anonymous) return anonymous

  return NextResponse.json(await buildSkillCatalog(config))
}
