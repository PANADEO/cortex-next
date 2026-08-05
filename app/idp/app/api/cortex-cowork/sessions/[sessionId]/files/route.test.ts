import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import type { CoworkGovernanceConfig, CoworkProjectConfig } from "@cortex/types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type * as CortexService from "@cortex/service"
import { setGrants } from "@/lib/cortex-governance/testing/grants"

// Extension of the tile-level auth gate (Obsidian task note, "Rozszerzenie:
// 5 dodatkowych route'ów") to a route the original 4-handler pass left
// out-of-scope: reading/uploading a session's input files had zero identity
// check on either GET or POST. Same real-disk-backed pattern as
// sessions/[sessionId]/route.test.ts.


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
  dataDir = mkdtempSync(path.join(tmpdir(), "cortex-cowork-files-route-test-"))
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

function getRequest(email: string | null): import("next/server").NextRequest {
  const headers = new Headers()
  if (email) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/cortex-cowork/sessions/x/files", {
    headers,
  }) as unknown as import("next/server").NextRequest
}

function uploadRequest(
  email: string | null,
  filename = "notes.txt",
  content = "hello",
): import("next/server").NextRequest {
  const form = new FormData()
  form.set("files", new File([content], filename, { type: "text/plain" }))
  const headers = new Headers()
  if (email) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/cortex-cowork/sessions/x/files", {
    method: "POST",
    headers,
    body: form,
  }) as unknown as import("next/server").NextRequest
}

async function loadHandler() {
  return import("./route")
}

describe("GET /api/cortex-cowork/sessions/[sessionId]/files", () => {
  it("closed/non-bootstrap mode: 403s a user who is not the session's project owner", async () => {
    await writeConfig(closedConfig())
    const sessionId = await createSession()
    const { GET } = await loadHandler()

    const response = await GET(getRequest("intruder@example.com"), {
      params: Promise.resolve({ sessionId }),
    })

    expect(response.status).toBe(403)
  })

  it("closed/non-bootstrap mode: 401s a request with no email header at all - fail-open fix", async () => {
    await writeConfig(closedConfig())
    const sessionId = await createSession()
    const { GET } = await loadHandler()

    const response = await GET(getRequest(null), {
      params: Promise.resolve({ sessionId }),
    })

    expect(response.status).toBe(401)
  })

  it("closed/non-bootstrap mode: the session owner still lists input files (no regression)", async () => {
    await writeConfig(closedConfig())
    const sessionId = await createSession()
    const { GET } = await loadHandler()

    const response = await GET(getRequest("owner@example.com"), {
      params: Promise.resolve({ sessionId }),
    })
    const body = (await response.json()) as { files?: unknown[] }

    expect(response.status).toBe(200)
    expect(Array.isArray(body.files)).toBe(true)
  })

  it("bootstrap/open mode: any authenticated user lists input files unchanged", async () => {
    await writeConfig(openConfig())
    const sessionId = await createSession()
    const { GET } = await loadHandler()

    const response = await GET(getRequest(GRANTED_EMAIL), {
      params: Promise.resolve({ sessionId }),
    })

    expect(response.status).toBe(200)
  })

  it("bootstrap/open mode: denies a caller without the cortex-cowork grant (403)", async () => {
    await writeConfig(openConfig())
    const sessionId = await createSession()
    const { GET } = await loadHandler()

    const response = await GET(getRequest("nobody@example.com"), {
      params: Promise.resolve({ sessionId }),
    })

    expect(response.status).toBe(403)
  })
})

describe("POST /api/cortex-cowork/sessions/[sessionId]/files", () => {
  it("closed/non-bootstrap mode: 403s a user without access instead of uploading the file", async () => {
    await writeConfig(closedConfig())
    const sessionId = await createSession()
    const { POST, GET } = await loadHandler()

    const response = await POST(uploadRequest("intruder@example.com"), {
      params: Promise.resolve({ sessionId }),
    })
    expect(response.status).toBe(403)

    // Prove nothing was written despite the denial.
    const stillEmpty = await GET(getRequest("owner@example.com"), {
      params: Promise.resolve({ sessionId }),
    })
    const body = (await stillEmpty.json()) as { files: unknown[] }
    expect(body.files).toHaveLength(0)
  })

  it("closed/non-bootstrap mode: 401s a request with no email header instead of uploading - fail-open fix", async () => {
    await writeConfig(closedConfig())
    const sessionId = await createSession()
    const { POST, GET } = await loadHandler()

    const response = await POST(uploadRequest(null), {
      params: Promise.resolve({ sessionId }),
    })
    expect(response.status).toBe(401)

    const stillEmpty = await GET(getRequest("owner@example.com"), {
      params: Promise.resolve({ sessionId }),
    })
    const body = (await stillEmpty.json()) as { files: unknown[] }
    expect(body.files).toHaveLength(0)
  })

  it("closed/non-bootstrap mode: the session owner can still upload a file (no regression)", async () => {
    await writeConfig(closedConfig())
    const sessionId = await createSession()
    const { POST } = await loadHandler()

    const response = await POST(uploadRequest("owner@example.com", "brief.txt"), {
      params: Promise.resolve({ sessionId }),
    })
    const body = (await response.json()) as { files: Array<{ filename: string }> }

    expect(response.status).toBe(201)
    expect(body.files.map((file) => file.filename)).toContain("brief.txt")
  })

  it("bootstrap/open mode: any authenticated user can still upload unchanged", async () => {
    await writeConfig(openConfig())
    const sessionId = await createSession()
    const { POST } = await loadHandler()

    const response = await POST(uploadRequest(GRANTED_EMAIL), {
      params: Promise.resolve({ sessionId }),
    })

    expect(response.status).toBe(201)
  })

  it("bootstrap/open mode: denies an upload from a caller without the grant (403)", async () => {
    await writeConfig(openConfig())
    const sessionId = await createSession()
    const { POST } = await loadHandler()

    const response = await POST(uploadRequest("nobody@example.com"), {
      params: Promise.resolve({ sessionId }),
    })

    expect(response.status).toBe(403)
  })
})
