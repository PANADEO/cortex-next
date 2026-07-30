import { requireTileAccess } from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

// Who may act while the governance document has not named anyone yet?
//
// Both gates of this module have a "nothing is configured yet" branch:
// admin-gate has bootstrap admin mode (adminEmails is empty) and project-gate
// has open mode (no user->role assignment exists). Until 30.07.2026 both
// answered that question with "everyone", and an anonymous caller counted as
// part of everyone. On a fresh cortex-next deployment that is the permanent
// state, not a transient one: governance.json is gitignored and
// docker-compose.image.yml mounts an EMPTY volume for it, so every new
// instance boots into bootstrap mode with the panel wide open. Reproduced
// live against a fresh instance: a user the shell answers with
// {"allowed":false,"apps":[]} could still write to the credential store,
// overwrite adminEmails (locking the rightful owners out of their own
// instance) and start a billable agent session.
//
// THE RULE THAT REPLACES IT
//
// Bootstrap suspends the GOVERNANCE layer, never the PLATFORM layer.
//
//   governance layer - roles, adminEmails, user assignments; lives in
//     governance.json and is genuinely unconfigured on day one. Suspending it
//     during bootstrap is the whole point: somebody has to be able to fill it in.
//
//   platform layer - the grant in system_config.applications, read through
//     @cortex/service. This is NEVER unconfigured on a real deployment: the
//     `migrate` step runs seed-system-config.mjs on every single deploy, and
//     with ADMIN_EMAIL set it reconciles that account to active + role `admin`
//     + a grant to every code in the registry, `cortex-config` and
//     `cortex-cowork` included.
//
// So "who is the first administrator" is a question this platform ALREADY
// answers, declaratively, in the deploy configuration - and it answers it the
// same way on every deploy, not once. Reusing that answer here is why this
// fix adds no second declaration: no new env var, no new file, no new
// bootstrap token to leak. It just stops governance from being more
// trusting than the platform it runs on.
//
// WHY THIS COULD NOT LIVE IN store.ts
//
// The old hole was structural, not a typo. isAdmin(config, email) was a pure
// synchronous predicate over the JSON document, and the correct answer
// depends on state that is not in that document and cannot be read
// synchronously. A sync function could not express this rule, so it expressed
// the wrong one. The decision therefore belongs in the async gates, and
// isAdmin() is gone rather than left as a trap for the next caller.
//
// FAIL-CLOSED, and what that costs. requireTileAccess() returns allowed:false
// on a missing identity, a missing grant AND on any database error. A fresh
// instance whose Postgres is unreachable therefore has NO governance admin.
// That is the intended direction of failure and it matches the rest of the
// stack (GET /api/me/access is fail-closed on the same database, and compose
// makes `migrate` a hard precondition for the app starting at all). Recovery
// is documented and does not need this code path: set ADMIN_EMAIL and re-run
// the seed, or write the address straight into adminEmails in governance.json.

/**
 * The module's single answer to "this request carries no identity at all":
 * 401, the same code /api/me/access and /api/cortex-cowork/my-instructions
 * already return. Shared by both gates and by the two unguarded-by-role
 * listing routes, so every surface of the module answers an anonymous caller
 * identically instead of drifting apart.
 *
 * A missing x-auth-request-email header means oauth2-proxy was bypassed, not
 * "a user with no roles" - that second case is a legitimate 200 with an empty
 * list (see canAccessTile: an empty grant hides tiles, it is not an error).
 *
 * UNCONDITIONAL since 30.07.2026. It used to exempt open mode, on the
 * reasoning that bootstrap is open to everyone anyway. That reasoning died
 * with the rule above: bootstrap trust is now a system_config grant, an
 * anonymous caller can never hold one, so the exemption could only ever have
 * let somebody through by mistake.
 */
export function denyAnonymous(email: string | undefined): NextResponse | null {
  if (email) return null
  return NextResponse.json({ message: "Authentication required" }, { status: 401 })
}

/**
 * Does the platform already trust this caller with `entitlementCode`? The one
 * question a bootstrap branch is allowed to ask before treating somebody as
 * pre-authorised. Deliberately a thin call onto the SAME rbac helper every
 * other tile uses - a second, module-local notion of "has the grant" is
 * exactly the drift this whole session was spent removing.
 */
export async function bootstrapTrusts(
  request: NextRequest,
  entitlementCode: string,
): Promise<boolean> {
  const { allowed } = await requireTileAccess(request, entitlementCode)
  return allowed
}
