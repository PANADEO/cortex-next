import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import type { CoworkGovernanceConfig, CoworkProjectConfig } from "@cortex/types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Route-level proof for the "kryterium zrobione" in the Obsidian task note:
// "User bez dostępu do sesji Y (utworzonej przez kogoś innego) dostaje
// 403/404 na GET/POST/DELETE .../sessions/Y/*." Exercises the actual
// exported GET/DELETE handlers (not just the underlying gate) against a real
// temp COWORK_DATA_DIR and a real session created via sandbox-store.

let dataDir: string

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  dataDir = mkdtempSync(path.join(tmpdir(), "cortex-cowork-session-route-test-"))
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

function closedConfig(): CoworkGovernanceConfig {
  return {
    version: 2,
    departments: ["wspolne"],
    skillSources: [],
    connectors: [],
    roles: [{ id: "analyst", name: "Analyst" }],
    userAssignments: { "owner@example.com": ["analyst"] },
    adminEmails: ["admin@example.com"],
    projects: [project({ id: "proj-a", allowedRoleIds: ["analyst"] })],
  }
}

function openConfig(): CoworkGovernanceConfig {
  return {
    version: 2,
    departments: ["wspolne"],
    skillSources: [],
    connectors: [],
    roles: [],
    userAssignments: {},
    adminEmails: [],
    projects: [project()],
  }
}

async function writeConfig(cfg: CoworkGovernanceConfig): Promise<void> {
  const { saveGovernanceConfig } = await import("@/lib/cortex-governance/store")
  await saveGovernanceConfig(cfg)
}

async function createSession(): Promise<string> {
  const { createSandboxSession } = await import("@/features/cortex-cowork/server/sandbox-store")
  const session = await createSandboxSession(project(), [], 100_000)
  return session.id
}

function requestAs(email: string | null): import("next/server").NextRequest {
  const headers = new Headers()
  if (email) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/cortex-cowork/sessions/x", {
    headers,
  }) as unknown as import("next/server").NextRequest
}

async function loadHandler() {
  return import("./route")
}

describe("GET /api/cortex-cowork/sessions/[sessionId]", () => {
  it("closed/non-bootstrap mode: 403s a user who is not the session's project owner", async () => {
    await writeConfig(closedConfig())
    const sessionId = await createSession()
    const { GET } = await loadHandler()

    const response = await GET(requestAs("intruder@example.com"), {
      params: Promise.resolve({ sessionId }),
    })

    expect(response.status).toBe(403)
  })

  it("closed/non-bootstrap mode: the session owner still reads it (no regression)", async () => {
    await writeConfig(closedConfig())
    const sessionId = await createSession()
    const { GET } = await loadHandler()

    const response = await GET(requestAs("owner@example.com"), {
      params: Promise.resolve({ sessionId }),
    })
    const body = (await response.json()) as { id?: string }

    expect(response.status).toBe(200)
    expect(body.id).toBe(sessionId)
  })

  it("bootstrap/open mode: any authenticated user reads any session unchanged", async () => {
    await writeConfig(openConfig())
    const sessionId = await createSession()
    const { GET } = await loadHandler()

    const response = await GET(requestAs("whoever@example.com"), {
      params: Promise.resolve({ sessionId }),
    })

    expect(response.status).toBe(200)
  })
})

describe("DELETE /api/cortex-cowork/sessions/[sessionId]", () => {
  it("closed/non-bootstrap mode: 403s a user without access instead of deleting the session", async () => {
    await writeConfig(closedConfig())
    const sessionId = await createSession()
    const { DELETE, GET } = await loadHandler()

    const response = await DELETE(requestAs("intruder@example.com"), {
      params: Promise.resolve({ sessionId }),
    })
    expect(response.status).toBe(403)

    // Prove it wasn't deleted despite the denial: the owner can still read it.
    const stillThere = await GET(requestAs("owner@example.com"), {
      params: Promise.resolve({ sessionId }),
    })
    expect(stillThere.status).toBe(200)
  })

  it("closed/non-bootstrap mode: the session owner can still delete it (no regression)", async () => {
    await writeConfig(closedConfig())
    const sessionId = await createSession()
    const { DELETE } = await loadHandler()

    const response = await DELETE(requestAs("owner@example.com"), {
      params: Promise.resolve({ sessionId }),
    })
    const body = (await response.json()) as { ok?: boolean }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
  })
})
