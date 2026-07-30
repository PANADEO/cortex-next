import type { SandboxSession } from "@/features/cortex-cowork/server/sandbox-store"
import { getSandboxSession } from "@/features/cortex-cowork/server/sandbox-store"
import type { CoworkGovernanceConfig, CoworkProjectConfig } from "@cortex/types"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
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
 * The module's single answer to "this request carries no identity at all":
 * 401, the same code /api/me/access and /api/cortex-cowork/my-instructions
 * already return. Shared by requireProjectAccess() and by the tile list
 * (GET /api/cortex-cowork/projects) so both surfaces of the module answer an
 * anonymous caller identically instead of drifting apart.
 *
 * A missing x-auth-request-email header means oauth2-proxy was bypassed, not
 * "a user with no roles" - that second case is a legitimate 200 with an empty
 * list (see canAccessTile: an empty grant hides tiles, it is not an error).
 *
 * Open mode is intentionally exempt: while no user->role assignment exists at
 * all, the instance is in bootstrap and every request, anonymous included,
 * passes by design (isOpenMode in store.ts).
 */
export function denyAnonymous(
  config: CoworkGovernanceConfig,
  email: string | undefined,
): NextResponse | null {
  if (email || isOpenMode(config)) return null
  return NextResponse.json({ message: "Authentication required" }, { status: 401 })
}

/**
 * Can this requester create/read/act on sessions for `projectId`? Reuses
 * visibleProjectsFor() - the exact same filter GET /api/cortex-cowork/projects
 * uses to decide which tiles a user sees - instead of a second, parallel
 * implementation of the open-mode/admin/role rules that could drift from it.
 * That also means bootstrap/open mode (see isOpenMode in store.ts) is
 * respected automatically: while no user has a role assignment, every
 * enabled project is visible to everyone, by design.
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

  const anonymous = denyAnonymous(config, email)
  if (anonymous) return anonymous

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
