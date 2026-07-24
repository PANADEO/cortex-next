import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import type { CoworkGovernanceConfig, CoworkProjectConfig } from "@cortex/types"
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

let dataDir: string

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
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
    model: { provider: "anthropic", modelId: "claude-sonnet-4-5" },
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
    version: 2,
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
  it("bootstrap/open mode: passes everyone through unchanged (no admins, no role assignments)", async () => {
    await writeConfig(config()) // adminEmails: [], userAssignments: {} - the default
    const { requireProjectAccess, isDenied } = await import("./project-gate")

    const anyone = await requireProjectAccess(makeRequest("nobody-in-particular@example.com"), "proj-a")
    const anonymous = await requireProjectAccess(makeRequest(null), "proj-a")

    expect(isDenied(anyone)).toBe(false)
    expect(isDenied(anonymous)).toBe(false)
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
})

describe("requireSessionAccess", () => {
  it("bootstrap/open mode: any authenticated user can reach any session unchanged", async () => {
    await writeConfig(config())
    const sessionId = await createSession("proj-a")
    const { requireSessionAccess, isDenied } = await import("./project-gate")

    const result = await requireSessionAccess(makeRequest("whoever@example.com"), sessionId)

    expect(isDenied(result)).toBe(false)
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
})
