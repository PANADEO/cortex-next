import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import type { CoworkGovernanceConfig, CoworkProjectConfig } from "@cortex/types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Route-level proof for the "criterio zrobione" in the Obsidian task note:
// "User bez roli uprawniającej do projektu X dostaje 403/404 na POST
// /sessions {projectId: X}." Exercises the actual exported POST handler
// (not just the underlying gate) against a real temp COWORK_DATA_DIR, so a
// future edit that forgets to call the gate before doing real work would
// fail this test even if project-gate.test.ts still passed.

let dataDir: string

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  dataDir = mkdtempSync(path.join(tmpdir(), "cortex-cowork-sessions-route-test-"))
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

/** Non-bootstrap config: a real admin + a role scoped to proj-a only. */
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

async function writeConfig(cfg: CoworkGovernanceConfig): Promise<void> {
  const { saveGovernanceConfig } = await import("@/lib/cortex-governance/store")
  await saveGovernanceConfig(cfg)
}

function postRequest(email: string | null, projectId: string): import("next/server").NextRequest {
  const headers = new Headers({ "content-type": "application/json" })
  if (email) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/cortex-cowork/sessions", {
    method: "POST",
    headers,
    body: JSON.stringify({ projectId }),
  }) as unknown as import("next/server").NextRequest
}

async function loadHandler() {
  return import("./route")
}

describe("POST /api/cortex-cowork/sessions", () => {
  it("closed/non-bootstrap mode: 403s a user without the project's role", async () => {
    await writeConfig(closedConfig())
    const { POST } = await loadHandler()

    const response = await POST(postRequest("intruder@example.com", "proj-a"))

    expect(response.status).toBe(403)
  })

  it("closed/non-bootstrap mode: creates a session for a user who holds the role (no regression)", async () => {
    await writeConfig(closedConfig())
    const { POST } = await loadHandler()

    const response = await POST(postRequest("owner@example.com", "proj-a"))
    const body = (await response.json()) as { id?: string; message?: string }

    expect(response.status).toBe(201)
    expect(typeof body.id).toBe("string")
  })

  it("bootstrap/open mode: creates a session for any authenticated user unchanged", async () => {
    await writeConfig({
      version: 2,
      departments: ["wspolne"],
      skillSources: [],
      connectors: [],
      roles: [],
      userAssignments: {},
      adminEmails: [],
      projects: [project()],
    })
    const { POST } = await loadHandler()

    const response = await POST(postRequest("nobody-in-particular@example.com", "proj-a"))

    expect(response.status).toBe(201)
  })

  // Fail-open regression (code review, 24.07.2026): visibleProjectsFor()'s
  // `!email` branch used to let a request with no x-auth-request-email header
  // through in closed mode with zero credentials. Must now be denied (401).
  it("closed/non-bootstrap mode: 401s a request with no email header at all - fail-open fix", async () => {
    await writeConfig(closedConfig())
    const { POST } = await loadHandler()

    const response = await POST(postRequest(null, "proj-a"))

    expect(response.status).toBe(401)
  })

  it("bootstrap/open mode: still creates a session with no email header - open mode has zero restrictions", async () => {
    await writeConfig({
      version: 2,
      departments: ["wspolne"],
      skillSources: [],
      connectors: [],
      roles: [],
      userAssignments: {},
      adminEmails: [],
      projects: [project()],
    })
    const { POST } = await loadHandler()

    const response = await POST(postRequest(null, "proj-a"))

    expect(response.status).toBe(201)
  })
})
