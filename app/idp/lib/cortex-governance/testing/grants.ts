import type { TileAccessResult } from "@cortex/service"

// Test-only stand-in for the system_config grant lookup.
//
// Since 30.07.2026 both governance gates ask @cortex/service whether the
// caller holds a tile grant before honouring a bootstrap/open-mode branch
// (see ../bootstrap-trust.ts). That question is answered by Postgres, and the
// cortex-cowork/cortex-config unit suites are deliberately DB-free - they run
// with no DATABASE_URL and must keep running that way. So they mock
// requireTileAccess() with this, and drive it through setGrants().
//
// WHY globalThis AND NOT A MODULE-LEVEL let: every one of these suites calls
// vi.resetModules() in beforeEach (store.ts freezes COWORK_DATA_DIR at import
// time, so a fresh import per test is mandatory). After a reset, the
// vi.mock factory's `await import(...)` receives a NEW copy of this module,
// while the test file's own static import still points at the old one -
// setGrants() would then write to an instance the mock never reads, and every
// grant would silently look absent. Keying off a global symbol makes the
// state survive the registry reset, which is exactly what these tests need.

const GRANTS = Symbol.for("cortex.testing.system-config-grants")

type GrantMap = Record<string, string[]>

function store(): GrantMap {
  const globals = globalThis as unknown as Record<symbol, GrantMap | undefined>
  const existing = globals[GRANTS]
  if (existing) return existing
  const created: GrantMap = {}
  globals[GRANTS] = created
  return created
}

/** Declare who holds which application code, e.g. { "a@x.pl": ["cortex-cowork"] }. */
export function setGrants(next: GrantMap): void {
  const current = store()
  for (const key of Object.keys(current)) delete current[key]
  for (const [email, codes] of Object.entries(next)) current[email.toLowerCase()] = codes
}

/**
 * Drop-in for requireTileAccess(). Mirrors the real one where it matters for
 * these gates: no identity header is a denial, and the lookup is by
 * lowercased e-mail.
 */
export async function fakeRequireTileAccess(
  request: Request,
  entitlementCode: string,
): Promise<TileAccessResult> {
  const email = request.headers.get("x-auth-request-email")
  if (!email) return { allowed: false, email: null }
  const codes = store()[email.trim().toLowerCase()] ?? []
  return { allowed: codes.includes(entitlementCode), email }
}
