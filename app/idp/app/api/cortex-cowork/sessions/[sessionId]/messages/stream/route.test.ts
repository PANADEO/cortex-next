import { setGrants } from "@/lib/cortex-governance/testing/grants"
import type * as CortexService from "@cortex/service"
import type { CoworkGovernanceConfig, CoworkProjectConfig } from "@cortex/types"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Extension of the tile-level auth gate (Obsidian task note, "Rozszerzenie:
// 5 dodatkowych route'ów") to a route the original 4-handler pass left
// out-of-scope: the SSE variant of POST /messages had zero identity check,
// same gap the plain POST /messages already had fixed. Same real-disk-backed
// pattern as sessions/[sessionId]/route.test.ts.
//
// The route returns its Response synchronously (the ReadableStream's
// producer runs in the background); recordUserMessage() is awaited before
// that, so message-count assertions are a reliable, un-flaky proxy for
// "did the handler do real work" without needing to drain or mock the SSE
// stream / chat engine.

// Open mode stopped meaning "no restrictions" on 30.07.2026: it still skips
// the governance ROLE filter, but the caller must hold the cortex-cowork
// grant in system_config (see lib/cortex-governance/bootstrap-trust.ts).
// Mocked so this suite stays DB-free; setGrants() drives it per test.
const GRANTED_EMAIL = "granted@example.com"

vi.mock("@cortex/service", async (importOriginal) => {
  const actual = await importOriginal<typeof CortexService>()
  const { fakeRequireTileAccess } = await import("@/lib/cortex-governance/testing/grants")
  return { ...actual, requireTileAccess: fakeRequireTileAccess }
})

let dataDir: string

beforeEach(() => {
  vi.resetModules()
  setGrants({ [GRANTED_EMAIL]: ["cortex-cowork"] })
  vi.unstubAllEnvs()
  dataDir = mkdtempSync(path.join(tmpdir(), "cortex-cowork-messages-stream-route-test-"))
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

function closedConfig(): CoworkGovernanceConfig {
  return {
    version: 3,
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
    version: 3,
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

async function messageCount(sessionId: string): Promise<number> {
  const { getSandboxSession } = await import("@/features/cortex-cowork/server/sandbox-store")
  const session = await getSandboxSession(sessionId)
  return session?.messages.length ?? 0
}

function postRequest(email: string | null, content = "hello"): import("next/server").NextRequest {
  const headers = new Headers({ "content-type": "application/json" })
  if (email) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/cortex-cowork/sessions/x/messages/stream", {
    method: "POST",
    headers,
    body: JSON.stringify({ content }),
  }) as unknown as import("next/server").NextRequest
}

async function loadHandler() {
  return import("./route")
}

describe("POST /api/cortex-cowork/sessions/[sessionId]/messages/stream", () => {
  it("closed/non-bootstrap mode: 403s a user who is not the session's project owner, without recording a message", async () => {
    await writeConfig(closedConfig())
    const sessionId = await createSession()
    const { POST } = await loadHandler()

    const response = await POST(postRequest("intruder@example.com"), {
      params: Promise.resolve({ sessionId }),
    })

    expect(response.status).toBe(403)
    expect(await messageCount(sessionId)).toBe(0)
  })

  it("closed/non-bootstrap mode: 401s a request with no email header, without recording a message - fail-open fix", async () => {
    await writeConfig(closedConfig())
    const sessionId = await createSession()
    const { POST } = await loadHandler()

    const response = await POST(postRequest(null), {
      params: Promise.resolve({ sessionId }),
    })

    expect(response.status).toBe(401)
    expect(await messageCount(sessionId)).toBe(0)
  })

  it("closed/non-bootstrap mode: the session owner still opens the SSE stream (no regression)", async () => {
    await writeConfig(closedConfig())
    const sessionId = await createSession()
    const { POST } = await loadHandler()

    const response = await POST(postRequest("owner@example.com"), {
      params: Promise.resolve({ sessionId }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/event-stream")
    expect(await messageCount(sessionId)).toBe(1)
  })

  it("bootstrap/open mode: any authenticated user opens the SSE stream unchanged", async () => {
    await writeConfig(openConfig())
    const sessionId = await createSession()
    const { POST } = await loadHandler()

    const response = await POST(postRequest(GRANTED_EMAIL), {
      params: Promise.resolve({ sessionId }),
    })

    expect(response.status).toBe(200)
  })

  // The most expensive route in the module to leave open: it drives the LLM.
  it("bootstrap/open mode: denies a caller without the cortex-cowork grant (403)", async () => {
    await writeConfig(openConfig())
    const sessionId = await createSession()
    const { POST } = await loadHandler()

    const response = await POST(postRequest("nobody@example.com"), {
      params: Promise.resolve({ sessionId }),
    })

    expect(response.status).toBe(403)
  })

  it("bootstrap/open mode: denies opening the stream with no email header (401)", async () => {
    await writeConfig(openConfig())
    const sessionId = await createSession()
    const { POST } = await loadHandler()

    const response = await POST(postRequest(null), {
      params: Promise.resolve({ sessionId }),
    })

    expect(response.status).toBe(401)
  })
})
