import type { SandboxSession } from "@/features/cortex-cowork/server/sandbox-store"
import { getSandboxSession } from "@/features/cortex-cowork/server/sandbox-store"
import { COWORK_APP_CODE } from "@/lib/tiles"
import type { CoworkGovernanceConfig, CoworkProjectConfig } from "@cortex/types"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { bootstrapTrusts, denyAnonymous } from "./bootstrap-trust"
import { requestEmail } from "./request-identity"
import { isOpenMode, readGovernanceConfig, visibleProjectsFor } from "./store"

// The project-level access gate for every /api/cortex-cowork/sessions*
// handler. Structurally mirrors requireAdmin() in admin-gate.ts, not
// AppGate: AppGate is a client-side React component that never wraps Route
// Handlers, which is exactly the gap this closes. Reads a fresh governance
// config per request (no caching) so a role change takes effect on the very
// next call, not after a container restart.

export interface ProjectAccessContext {
  config: CoworkGovernanceConfig
  email: string | undefined
  project: CoworkProjectConfig
}

/**
 * Can this requester create/read/act on sessions for `projectId`? Reuses
 * visibleProjectsFor() - the exact same filter GET /api/cortex-cowork/projects
 * uses to decide which tiles a user sees - instead of a second, parallel
 * implementation of the open-mode/admin/role rules that could drift from it.
 * Open mode (see isOpenMode in store.ts) still skips the ROLE filter - no
 * user has been assigned a role yet, so there is nothing to filter on - but
 * since 30.07.2026 it no longer skips the system_config grant. Until then,
 * "no role assignments exist" meant every authenticated caller could open
 * every enabled project and start a billable agent session, which on a fresh
 * cortex-next instance is its permanent starting state; the hub had already
 * been tightened to hide these tiles without the `cortex-cowork` grant
 * (tile-grid.tsx), so the API was simply more permissive than the UI it
 * serves. Rationale for keying bootstrap trust off the grant: bootstrap-trust.ts.
 *
 * 404 for a project id that doesn't exist in the config at all (typo/stale
 * link); 403 once the project is confirmed to exist but this requester
 * can't see it (disabled, or no matching role) - that split preserves the
 * existing "Unknown project" message callers already depend on while adding
 * a distinct signal for an actual permission denial.
 */
export async function requireProjectAccess(
  request: NextRequest,
  projectId: string,
): Promise<ProjectAccessContext | NextResponse> {
  const config = await readGovernanceConfig()
  const project = config.projects.find((candidate) => candidate.id === projectId)
  if (!project) {
    return NextResponse.json({ message: `Unknown project: ${projectId}` }, { status: 404 })
  }

  const email = requestEmail(request)

  const anonymous = denyAnonymous(email)
  if (anonymous) return anonymous

  if (isOpenMode(config) && !(await bootstrapTrusts(request, COWORK_APP_CODE))) {
    return NextResponse.json({ message: "Project access denied" }, { status: 403 })
  }

  const visible = visibleProjectsFor(config, email).some((candidate) => candidate.id === projectId)
  if (!visible) {
    return NextResponse.json({ message: "Project access denied" }, { status: 403 })
  }

  return { config, email, project }
}

export interface SessionAccessContext extends ProjectAccessContext {
  session: SandboxSession
}

/**
 * Can this requester act on `sessionId`? Loads the session first (to learn
 * which project it belongs to), then delegates to requireProjectAccess for
 * that project - so a session created under a project this requester can't
 * see is denied exactly like creating a new session there would be. Runs
 * before any session content is returned; callers must not read/return
 * session data ahead of this check.
 */
export async function requireSessionAccess(
  request: NextRequest,
  sessionId: string,
): Promise<SessionAccessContext | NextResponse> {
  const session = await getSandboxSession(sessionId)
  if (!session) {
    return NextResponse.json({ message: `Session not found: ${sessionId}` }, { status: 404 })
  }

  const result = await requireProjectAccess(request, session.projectId)
  if (isDenied(result)) return result
  return { ...result, session }
}

export function isDenied<T>(result: T | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}
