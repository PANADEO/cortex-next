import type * as CortexService from "@cortex/service"
import type { CoworkGovernanceConfig, CoworkProjectConfig } from "@cortex/types"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Regression coverage for the /api/cortex-cowork/sessions/** authorization
// hole (Obsidian task "cortex2.0-task-tile-level-auth"): every handler used
// to check only requestEmail() - any oauth2-proxy-authenticated user could
// create/read/delete any session for any project by guessing a UUID.
//
// This exercises requireProjectAccess/requireSessionAccess against a REAL
// disk-backed governance.json and REAL sandbox-store sessions (a temp
// COWORK_DATA_DIR per test, real createSandboxSession/saveGovernanceConfig
// calls) rather than in-memory stubs, because the whole point is to prove
// the gate denies for real against a non-bootstrap config - store.test.ts
// already covers visibleProjectsFor as a pure function, but bootstrap mode
// means that alone was never enough to prove a route actually rejects
// anyone (production is bootstrap today - see the "Decyzja Alexa" note in
// cortex2.0-task-close-bootstrap-mode.md - so this is the only place that
// can be verified against a real closed/non-bootstrap state).
//
// vi.resetModules() + a fresh dynamic import per test is required because
// store.ts resolves COWORK_DATA_DIR into a module-level constant at import
// time (see COWORK_DATA_DIR in store.ts); the same trick is already used by
// app/api/me/access/route.test.ts and app/api/ai-tools/history/route.test.ts.
//
// system_config is mocked (30.07.2026): open mode now additionally requires
// the caller's `cortex-cowork` grant, and this file must stay in the DB-free
// part of the suite. Everything else here is still real.

const GRANTED_EMAIL = "granted@example.com"

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
  grants = { [GRANTED_EMAIL]: ["cortex-cowork"] }
  dataDir = mkdtempSync(path.join(tmpdir(), "cortex-cowork-project-gate-test-"))
  vi.stubEnv("COWORK_DATA_DIR", dataDir)
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(dataDir, { force: true, recursive: true })
})

function project(overrides: Partial<CoworkProjectConfig> = {}): CoworkProjectConfig {
  return {
    id: "proj-a",
    name: "Project A",
    description: "",
    enabled: true,
    archetype: "task-chat",
    allowedRoleIds: ["analyst"],
    model: { provider: "openai-compatible", modelId: "claude-sonnet-4-5" },
    composition: {
      skills: { branches: [], leaves: [] },
      connectors: { branches: [], leaves: [] },
      secrets: { branches: [], leaves: [] },
    },
    sandbox: { mode: "local", allowedPaths: [] },
    createdAt: "",
    updatedAt: "",
    ...overrides,
  }
}

function config(overrides: Partial<CoworkGovernanceConfig> = {}): CoworkGovernanceConfig {
  return {
    version: 3,
    departments: ["wspolne"],
    skillSources: [],
    connectors: [],
    roles: [
      { id: "analyst", name: "Analyst" },
      { id: "other-role", name: "Other" },
    ],
    userAssignments: {},
    adminEmails: [],
    projects: [project()],
    ...overrides,
  }
}

/** Non-bootstrap config: a real admin + a role scoped to proj-a only. */
function closedConfig(overrides: Partial<CoworkGovernanceConfig> = {}): CoworkGovernanceConfig {
  return config({
    adminEmails: ["admin@example.com"],
    projects: [
      project({ id: "proj-a", allowedRoleIds: ["analyst"] }),
      project({ id: "proj-b", allowedRoleIds: ["other-role"] }),
    ],
    userAssignments: { "owner@example.com": ["analyst"] },
    ...overrides,
  })
}

async function writeConfig(cfg: CoworkGovernanceConfig): Promise<void> {
  const { saveGovernanceConfig } = await import("./store")
  await saveGovernanceConfig(cfg)
}

function makeRequest(email: string | null): import("next/server").NextRequest {
  const headers = new Headers()
  if (email) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/cortex-cowork/sessions", {
    headers,
  }) as unknown as import("next/server").NextRequest
}

async function createSession(projectId: string): Promise<string> {
  const { createSandboxSession } = await import("@/features/cortex-cowork/server/sandbox-store")
  const session = await createSandboxSession(project({ id: projectId }), [], 100_000)
  return session.id
}

describe("requireProjectAccess", () => {
  // This test used to assert that open mode "passes everyone through
  // unchanged", anonymous included, and that is the third request in the
  // audyt 6.1 proof: POST /api/cortex-cowork/sessions -> 201 for a caller
  // with no grant, i.e. a billable agent session started by a stranger on a
  // fresh instance. Open mode still skips the ROLE filter (nothing has been
  // assigned yet), but no longer the system_config grant.
  it("bootstrap/open mode: admits an identified caller who holds the cortex-cowork grant", async () => {
    await writeConfig(config()) // adminEmails: [], userAssignments: {} - the default
    const { requireProjectAccess, isDenied } = await import("./project-gate")

    const result = await requireProjectAccess(makeRequest(GRANTED_EMAIL), "proj-a")

    expect(isDenied(result)).toBe(false)
  })

  it("bootstrap/open mode: denies an identified caller without the grant (403)", async () => {
    await writeConfig(config())
    const { requireProjectAccess, isDenied } = await import("./project-gate")

    const result = await requireProjectAccess(
      makeRequest("nobody-in-particular@example.com"),
      "proj-a",
    )

    expect(isDenied(result)).toBe(true)
    if (isDenied(result)) expect(result.status).toBe(403)
  })

  it("bootstrap/open mode: denies an anonymous request (401)", async () => {
    await writeConfig(config())
    const { requireProjectAccess, isDenied } = await import("./project-gate")

    const result = await requireProjectAccess(makeRequest(null), "proj-a")

    expect(isDenied(result)).toBe(true)
    if (isDenied(result)) expect(result.status).toBe(401)
  })

  // The grant does not become a master key: it substitutes for the ROLE
  // filter only while no role has been assigned anywhere.
  it("bootstrap/open mode: still hides a disabled project from a granted caller", async () => {
    await writeConfig(config({ projects: [project({ id: "proj-a", enabled: false })] }))
    const { requireProjectAccess, isDenied } = await import("./project-gate")

    const result = await requireProjectAccess(makeRequest(GRANTED_EMAIL), "proj-a")

    expect(isDenied(result)).toBe(true)
    if (isDenied(result)) expect(result.status).toBe(403)
  })

  it("closed/non-bootstrap mode: the grant alone does NOT replace a role assignment", async () => {
    await writeConfig(closedConfig())
    const { requireProjectAccess, isDenied } = await import("./project-gate")

    const result = await requireProjectAccess(makeRequest(GRANTED_EMAIL), "proj-a")

    expect(isDenied(result)).toBe(true)
    if (isDenied(result)) expect(result.status).toBe(403)
  })

  it("closed/non-bootstrap mode: denies a user without the project's role (403)", async () => {
    await writeConfig(closedConfig())
    const { requireProjectAccess, isDenied } = await import("./project-gate")

    const result = await requireProjectAccess(makeRequest("intruder@example.com"), "proj-a")

    expect(isDenied(result)).toBe(true)
    if (isDenied(result)) expect(result.status).toBe(403)
  })

  it("closed/non-bootstrap mode: denies a user whose role is scoped to a DIFFERENT project", async () => {
    await writeConfig(closedConfig())
    const { requireProjectAccess, isDenied } = await import("./project-gate")

    // owner@example.com holds "analyst", which grants proj-a, not proj-b.
    const result = await requireProjectAccess(makeRequest("owner@example.com"), "proj-b")

    expect(isDenied(result)).toBe(true)
    if (isDenied(result)) expect(result.status).toBe(403)
  })

  it("closed/non-bootstrap mode: allows a user who holds the project's role (no regression)", async () => {
    await writeConfig(closedConfig())
    const { requireProjectAccess, isDenied } = await import("./project-gate")

    const result = await requireProjectAccess(makeRequest("owner@example.com"), "proj-a")

    expect(isDenied(result)).toBe(false)
    if (!isDenied(result)) expect(result.project.id).toBe("proj-a")
  })

  it("closed/non-bootstrap mode: an explicit admin reaches every project (mirrors visibleProjectsFor)", async () => {
    await writeConfig(closedConfig())
    const { requireProjectAccess, isDenied } = await import("./project-gate")

    const result = await requireProjectAccess(makeRequest("admin@example.com"), "proj-b")

    expect(isDenied(result)).toBe(false)
  })

  it("404s (not 403) for a project id that does not exist at all - distinct from a permission denial", async () => {
    await writeConfig(closedConfig())
    const { requireProjectAccess, isDenied } = await import("./project-gate")

    const result = await requireProjectAccess(makeRequest("owner@example.com"), "no-such-project")

    expect(isDenied(result)).toBe(true)
    if (isDenied(result)) expect(result.status).toBe(404)
  })

  // Regression for the fail-open bug found in code review (24.07.2026):
  // visibleProjectsFor() has `if (openMode || explicitAdmin || !email) return
  // true` - reused here, that `!email` branch let a request with NO
  // x-auth-request-email header (requestEmail() -> undefined) through in
  // CLOSED/non-bootstrap mode, with zero credentials. This must now be
  // denied (401) before visibleProjectsFor() is ever called with that email.
  it("closed/non-bootstrap mode: denies a request with no email header at all (401) - fail-open fix", async () => {
    await writeConfig(closedConfig())
    const { requireProjectAccess, isDenied } = await import("./project-gate")

    const result = await requireProjectAccess(makeRequest(null), "proj-a")

    expect(isDenied(result)).toBe(true)
    if (isDenied(result)) expect(result.status).toBe(401)
  })
})

describe("requireSessionAccess", () => {
  it("bootstrap/open mode: a granted user reaches a session in that project", async () => {
    await writeConfig(config())
    const sessionId = await createSession("proj-a")
    const { requireSessionAccess, isDenied } = await import("./project-gate")

    const result = await requireSessionAccess(makeRequest(GRANTED_EMAIL), sessionId)

    expect(isDenied(result)).toBe(false)
  })

  // Delegation path: requireSessionAccess loads the session and defers to
  // requireProjectAccess, so the open-mode grant requirement has to apply
  // transitively - otherwise a known session id would be the way around it.
  it("bootstrap/open mode: denies a caller without the grant (403), even with a valid session id", async () => {
    await writeConfig(config())
    const sessionId = await createSession("proj-a")
    const { requireSessionAccess, isDenied } = await import("./project-gate")

    const result = await requireSessionAccess(makeRequest("whoever@example.com"), sessionId)

    expect(isDenied(result)).toBe(true)
    if (isDenied(result)) expect(result.status).toBe(403)
  })

  it("closed/non-bootstrap mode: denies GET/POST/DELETE-equivalent access to another user's session", async () => {
    await writeConfig(closedConfig())
    const sessionId = await createSession("proj-a")
    const { requireSessionAccess, isDenied } = await import("./project-gate")

    const result = await requireSessionAccess(makeRequest("intruder@example.com"), sessionId)

    expect(isDenied(result)).toBe(true)
    if (isDenied(result)) expect(result.status).toBe(403)
  })

  it("closed/non-bootstrap mode: the session owner's role still works (no regression)", async () => {
    await writeConfig(closedConfig())
    const sessionId = await createSession("proj-a")
    const { requireSessionAccess, isDenied } = await import("./project-gate")

    const result = await requireSessionAccess(makeRequest("owner@example.com"), sessionId)

    expect(isDenied(result)).toBe(false)
    if (!isDenied(result)) expect(result.session.id).toBe(sessionId)
  })

  it("404s for a session id that does not exist, before any project check runs", async () => {
    await writeConfig(closedConfig())
    const { requireSessionAccess, isDenied } = await import("./project-gate")

    const result = await requireSessionAccess(makeRequest("owner@example.com"), "no-such-session")

    expect(isDenied(result)).toBe(true)
    if (isDenied(result)) expect(result.status).toBe(404)
  })

  // Same fail-open regression as requireProjectAccess, exercised through the
  // delegation path: requireSessionAccess loads the session then calls
  // requireProjectAccess(request, session.projectId) and returns its denial
  // verbatim, so the missing-email guard must apply here transitively too.
  it("closed/non-bootstrap mode: denies a request with no email header at all (401) - fail-open fix", async () => {
    await writeConfig(closedConfig())
    const sessionId = await createSession("proj-a")
    const { requireSessionAccess, isDenied } = await import("./project-gate")

    const result = await requireSessionAccess(makeRequest(null), sessionId)

    expect(isDenied(result)).toBe(true)
    if (isDenied(result)) expect(result.status).toBe(401)
  })
})
