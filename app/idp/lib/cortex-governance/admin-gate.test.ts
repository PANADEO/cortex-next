import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import type { CoworkGovernanceConfig } from "@cortex/types"
import type { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type * as CortexService from "@cortex/service"

// Regression coverage for the critical finding of audyt 6.1: on a FRESH
// cortex-next deployment the whole /api/cortex-config panel was reachable by
// anyone, because requireAdmin() called isAdmin(), and isAdmin() answered
// "yes" to every caller - including one with no identity header at all -
// while adminEmails was empty. That empty list is the shipped state:
// governance.json is gitignored and docker-compose.image.yml mounts an empty
// volume for it.
//
// The scenario reproduced here is the exact one confirmed live against a dev
// server before the fix: a caller the shell answers with
// {"allowed":false,"apps":[]} - i.e. holding NO grant in system_config -
// writing to the credential store and overwriting adminEmails.
//
// system_config is mocked rather than hit for real so this file stays in the
// DB-free part of the suite (the integration tests that exercise the real
// Postgres path live in @cortex/service). What is NOT mocked is the gate, the
// governance document or the disk: a real temp COWORK_DATA_DIR, real
// saveGovernanceConfig, real handlers.

const GRANTED_EMAIL = "boss@example.com"
const GRANTLESS_EMAIL = "nobody@example.com"

/** Stands in for system_config.applications: who holds which tile grant. */
let grants: Record<string, string[]>

vi.mock("@cortex/service", async (importOriginal) => {
  const actual = await importOriginal<typeof CortexService>()
  return {
    ...actual,
    requireTileAccess: vi.fn(async (request: Request, entitlementCode: string) => {
      const email = request.headers.get("x-auth-request-email")
      if (!email) return { allowed: false, email: null }
      return { allowed: (grants[email] ?? []).includes(entitlementCode), email }
    }),
  }
})

let dataDir: string

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  grants = { [GRANTED_EMAIL]: ["cortex-config", "cortex-cowork"], [GRANTLESS_EMAIL]: [] }
  dataDir = mkdtempSync(path.join(tmpdir(), "cortex-admin-gate-"))
  // Without this, requestEmail() falls back to DEV_USER_EMAIL and "no header"
  // would not mean "no identity".
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("COWORK_DATA_DIR", dataDir)
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(dataDir, { force: true, recursive: true })
})

function config(overrides: Partial<CoworkGovernanceConfig> = {}): CoworkGovernanceConfig {
  return {
    version: 2,
    departments: ["wspolne"],
    skillSources: [],
    connectors: [],
    roles: [{ id: "analyst", name: "Analyst" }],
    userAssignments: {},
    adminEmails: [],
    projects: [],
    ...overrides,
  }
}

async function writeConfig(cfg: CoworkGovernanceConfig): Promise<void> {
  const { saveGovernanceConfig } = await import("./store")
  await saveGovernanceConfig(cfg)
}

function makeRequest(email: string | null): NextRequest {
  const headers = new Headers()
  if (email) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/cortex-config", {
    headers,
  }) as unknown as NextRequest
}

async function gate(email: string | null) {
  const { requireAdmin, isDenied } = await import("./admin-gate")
  const result = await requireAdmin(makeRequest(email))
  return { result, denied: isDenied(result), status: isDenied(result) ? result.status : 200 }
}

describe("requireAdmin - bootstrap mode (adminEmails empty)", () => {
  // THE finding. Before the fix this was a 200.
  it("denies an authenticated caller who holds no cortex-config grant (403)", async () => {
    await writeConfig(config({ adminEmails: [] }))

    const { denied, status } = await gate(GRANTLESS_EMAIL)

    expect(denied).toBe(true)
    expect(status).toBe(403)
  })

  // The anonymous half of the same finding: the guard project-gate.ts got on
  // 30.07.2026 and this file did not.
  it("denies a request with no identity header at all (401, not 403)", async () => {
    await writeConfig(config({ adminEmails: [] }))

    const { denied, status } = await gate(null)

    expect(denied).toBe(true)
    // 401 rather than 403 on purpose: this is "you are nobody", not "you are
    // somebody without rights", and it must be decided before any permission
    // check that could say yes.
    expect(status).toBe(401)
  })

  // The legitimate bootstrap path MUST keep working, otherwise a fresh
  // instance can never be initialised. This is the deploy-declared admin:
  // ADMIN_EMAIL -> seed-system-config.mjs -> grant to every registry code.
  it("admits the caller the deploy already granted cortex-config", async () => {
    await writeConfig(config({ adminEmails: [] }))

    const { denied } = await gate(GRANTED_EMAIL)

    expect(denied).toBe(false)
  })

  // Fail-closed: a broken/unreachable system_config must not reopen the door
  // it was brought in to close.
  it("denies everyone when the grant lookup fails", async () => {
    await writeConfig(config({ adminEmails: [] }))
    const { requireTileAccess } = await import("@cortex/service")
    vi.mocked(requireTileAccess).mockResolvedValueOnce({ allowed: false, email: GRANTED_EMAIL })

    const { denied, status } = await gate(GRANTED_EMAIL)

    expect(denied).toBe(true)
    expect(status).toBe(403)
  })
})

describe("requireAdmin - configured mode (adminEmails set)", () => {
  it("admits a named admin", async () => {
    await writeConfig(config({ adminEmails: [GRANTLESS_EMAIL] }))

    // Note the email used: a named admin passes WITHOUT a system_config
    // grant. Requiring both is a deliberate non-goal of this fix (audyt
    // P2/#13) - it would lock existing instances out of their own panel.
    const { denied } = await gate(GRANTLESS_EMAIL)

    expect(denied).toBe(false)
  })

  it("denies a caller who is not named, even holding the cortex-config grant", async () => {
    await writeConfig(config({ adminEmails: ["someone-else@example.com"] }))

    const { denied, status } = await gate(GRANTED_EMAIL)

    expect(denied).toBe(true)
    expect(status).toBe(403)
  })

  it("denies an anonymous request (401)", async () => {
    await writeConfig(config({ adminEmails: ["someone-else@example.com"] }))

    const { denied, status } = await gate(null)

    expect(denied).toBe(true)
    expect(status).toBe(401)
  })
})

// Same scenario as above, but driven through the REAL route handlers, because
// "the gate returns 403" and "the handler did not write anything" are two
// different claims and only the second one is the security property. Mirrors
// the dirSnapshot technique in app/api/cortex-config/guard-coverage.test.ts.
describe("audyt 6.1 - the confirmed attack, end to end", () => {
  it("a grantless caller cannot write a secret to the credential store", async () => {
    await writeConfig(config({ adminEmails: [] }))
    const { PUT } = await import("@/app/api/cortex-config/credentials/route")

    const request = new Request("http://localhost/api/cortex-config/credentials", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-auth-request-email": GRANTLESS_EMAIL,
      },
      body: JSON.stringify({ path: "audit/probe", value: "sekret-wstrzykniety" }),
    })
    const response = await PUT(request as Parameters<typeof PUT>[0])

    expect(response.status).toBe(403)
    // The denial has to precede the write, not follow it.
    const { listCredentialPaths } = await import("./credentials")
    expect(await listCredentialPaths()).toEqual([])
  })

  it("a grantless caller cannot overwrite adminEmails and seize the instance", async () => {
    await writeConfig(config({ adminEmails: [] }))
    const { PUT } = await import("@/app/api/cortex-config/governance/route")

    const request = new Request("http://localhost/api/cortex-config/governance", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-auth-request-email": GRANTLESS_EMAIL,
      },
      body: JSON.stringify({
        roles: [{ id: "analyst", name: "Analyst" }],
        adminEmails: [GRANTLESS_EMAIL],
        departments: ["wspolne"],
        skillSources: [],
        connectors: [],
      }),
    })
    const response = await PUT(request as Parameters<typeof PUT>[0])

    expect(response.status).toBe(403)
    const { readGovernanceConfig } = await import("./store")
    expect((await readGovernanceConfig()).adminEmails).toEqual([])
  })
})
