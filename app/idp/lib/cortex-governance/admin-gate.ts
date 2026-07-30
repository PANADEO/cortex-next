import { CORTEX_CONFIG_APP_CODE } from "@/lib/tiles"
import type { CoworkGovernanceConfig } from "@cortex/types"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { bootstrapTrusts, denyAnonymous } from "./bootstrap-trust"
import { requestEmail } from "./request-identity"
import { isBootstrapAdminMode, isExplicitAdmin, readGovernanceConfig } from "./store"

export interface AdminContext {
  config: CoworkGovernanceConfig
  email: string | undefined
}

/**
 * The one admin gate for every /api/cortex-config handler. Returns the loaded
 * config + requester identity on success (so handlers don't re-read the
 * document), or a ready denial. Any change to gate semantics (audit log,
 * identity source) happens here and nowhere else.
 *
 * Three answers, in this order:
 *
 *   401 - no identity at all. Checked FIRST, so an anonymous request can
 *         never reach a permission check that might say yes. This is the same
 *         guard project-gate.ts got on 30.07.2026 after the identical
 *         finding; it was not carried over to this file at the time, which is
 *         half of why the panel was reachable anonymously.
 *
 *   pass - named in adminEmails. The normal, configured case.
 *
 *   pass - bootstrap: nobody is named yet AND system_config already grants
 *         this caller `cortex-config`. Somebody must be able to initialise a
 *         fresh instance, but "somebody" is whoever the deploy declared
 *         (ADMIN_EMAIL -> seed-system-config.mjs -> a grant to every code in
 *         the registry), not whoever sends the first request. Full rationale,
 *         including why this is not a second source of truth, is in
 *         bootstrap-trust.ts.
 *
 *   403 - everything else.
 *
 * Note what this deliberately does NOT do: it does not require the
 * `cortex-config` grant once adminEmails IS populated. Making every
 * /api/cortex-config and /api/cortex-cowork route ask system_config as well
 * is a real and separate improvement (it would close "the UI refuses, the API
 * lets you in" for all 22 routes) but it is a behaviour change for already
 * configured instances - an explicit admin who was never granted the tile
 * would lose the panel - so it is tracked as its own thread (audyt P2/#13),
 * not smuggled into a security fix.
 */
export async function requireAdmin(request: NextRequest): Promise<AdminContext | NextResponse> {
  const config = await readGovernanceConfig()
  const email = requestEmail(request)

  const anonymous = denyAnonymous(email)
  if (anonymous) return anonymous

  if (isExplicitAdmin(config, email)) return { config, email }

  if (isBootstrapAdminMode(config) && (await bootstrapTrusts(request, CORTEX_CONFIG_APP_CODE))) {
    return { config, email }
  }

  return NextResponse.json({ message: "Admin access required" }, { status: 403 })
}

export function isDenied(result: AdminContext | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}
