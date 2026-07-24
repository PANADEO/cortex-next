import { mkdtempSync, rmSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { CoworkGovernanceConfig, CoworkProjectConfig } from "@cortex/types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Extension of the tile-level auth gate (Obsidian task note, "Rozszerzenie:
// 5 dodatkowych route'ów") to a route the original 4-handler pass left
// out-of-scope: exporting an artifact to the project's share had zero
// identity check. Same real-disk-backed pattern as
// sessions/[sessionId]/route.test.ts; the export share itself is a second
// real temp directory (distinct from COWORK_DATA_DIR) so the ALLOW case
// proves a real file landed on disk, not just a 200 status.

let dataDir: string
let exportDir: string

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  dataDir = mkdtempSync(path.join(tmpdir(), "cortex-cowork-export-route-test-"))
  exportDir = mkdtempSync(path.join(tmpdir(), "cortex-cowork-export-share-test-"))
  vi.stubEnv("COWORK_DATA_DIR", dataDir)
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(dataDir, { force: true, recursive: true })
  rmSync(exportDir, { force: true, recursive: true })
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
    artifactExport: { exportDir },
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

async function createSessionWithArtifact(): Promise<{
  sessionId: string
  artifactId: string
  filename: string
}> {
  const { createSandboxSession, registerArtifact, artifactFilePath } = await import(
    "@/features/cortex-cowork/server/sandbox-store"
  )
  const session = await createSandboxSession(project(), [], 100_000)
  const artifact = {
    id: "artifact-1",
    filename: "report.pdf",
    mimeType: "application/pdf",
    sizeBytes: 3,
    createdAt: new Date().toISOString(),
    skill: "docgen",
  }
  await registerArtifact(session, artifact)
  await writeFile(artifactFilePath(session, artifact), "pdf")
  return { sessionId: session.id, artifactId: artifact.id, filename: artifact.filename }
}

function requestAs(email: string | null): import("next/server").NextRequest {
  const headers = new Headers()
  if (email) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/cortex-cowork/sessions/x/artifacts/y/export", {
    method: "POST",
    headers,
  }) as unknown as import("next/server").NextRequest
}

async function loadHandler() {
  return import("./route")
}

describe("POST /api/cortex-cowork/sessions/[sessionId]/artifacts/[artifactId]/export", () => {
  it("closed/non-bootstrap mode: 403s a user who is not the session's project owner", async () => {
    await writeConfig(closedConfig())
    const { sessionId, artifactId } = await createSessionWithArtifact()
    const { POST } = await loadHandler()

    const response = await POST(requestAs("intruder@example.com"), {
      params: Promise.resolve({ sessionId, artifactId }),
    })

    expect(response.status).toBe(403)
  })

  it("closed/non-bootstrap mode: 401s a request with no email header at all - fail-open fix", async () => {
    await writeConfig(closedConfig())
    const { sessionId, artifactId } = await createSessionWithArtifact()
    const { POST } = await loadHandler()

    const response = await POST(requestAs(null), {
      params: Promise.resolve({ sessionId, artifactId }),
    })

    expect(response.status).toBe(401)
  })

  it("closed/non-bootstrap mode: the session owner still exports the artifact (no regression)", async () => {
    await writeConfig(closedConfig())
    const { sessionId, artifactId, filename } = await createSessionWithArtifact()
    const { POST } = await loadHandler()

    const response = await POST(requestAs("owner@example.com"), {
      params: Promise.resolve({ sessionId, artifactId }),
    })
    const body = (await response.json()) as { exportedPath?: string }

    expect(response.status).toBe(200)
    expect(body.exportedPath).toBe(path.join(exportDir, filename))
    await expect(readFile(body.exportedPath as string, "utf8")).resolves.toBe("pdf")
  })

  it("bootstrap/open mode: any authenticated user exports the artifact unchanged", async () => {
    await writeConfig(openConfig())
    const { sessionId, artifactId } = await createSessionWithArtifact()
    const { POST } = await loadHandler()

    const response = await POST(requestAs("whoever@example.com"), {
      params: Promise.resolve({ sessionId, artifactId }),
    })

    expect(response.status).toBe(200)
  })

  it("bootstrap/open mode: still exports with no email header - open mode has zero restrictions", async () => {
    await writeConfig(openConfig())
    const { sessionId, artifactId } = await createSessionWithArtifact()
    const { POST } = await loadHandler()

    const response = await POST(requestAs(null), {
      params: Promise.resolve({ sessionId, artifactId }),
    })

    expect(response.status).toBe(200)
  })
})
