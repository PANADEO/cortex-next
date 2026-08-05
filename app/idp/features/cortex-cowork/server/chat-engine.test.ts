import { EventEmitter } from "node:events"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import type { CoworkGovernanceConfig, CoworkProjectConfig } from "@cortex/types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Regression coverage for the X-User-ID plumbing (Obsidian:
// cortex2.0-task-anthropic-via-cortex-proxy.md, "Resolution: X-User-ID"):
// cortex-proxy's authMiddleware hard-requires X-User-ID (400 without it) and
// uses it as the per-user cost-attribution key for its /usage analytics. Two
// call sites had to start threading the requesting user's email:
//   (a)/(b) modelConfigForRunner() - injects the header into COWORK_MODEL_CONFIG,
//       gated on the project routing through a gateway (baseUrl set).
//   (c) runFlueTurn()'s spawn env - injects COWORK_USER_EMAIL, which the CLI
//       connector scripts (demo/bin/web-search.py, generate-image.py) read
//       directly from their inherited process env.

const spawnMock = vi.hoisted(() => vi.fn())
vi.mock("node:child_process", () => ({ spawn: spawnMock }))

let dataDir: string
let runnerDir: string

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  dataDir = mkdtempSync(path.join(tmpdir(), "cortex-chat-engine-test-data-"))
  runnerDir = mkdtempSync(path.join(tmpdir(), "cortex-chat-engine-test-runner-"))
  vi.stubEnv("COWORK_DATA_DIR", dataDir)
  vi.stubEnv("COWORK_RUNNER_DIR", runnerDir)
  spawnMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(dataDir, { force: true, recursive: true })
  rmSync(runnerDir, { force: true, recursive: true })
})

function project(overrides: Partial<CoworkProjectConfig> = {}): CoworkProjectConfig {
  return {
    id: "proj-gateway",
    name: "Gateway project",
    description: "",
    enabled: true,
    archetype: "task-chat",
    allowedRoleIds: [],
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

describe("modelConfigForRunner", () => {
  it("(a) injects X-User-ID when the project has a gateway baseUrl and a userEmail is available", async () => {
    const { modelConfigForRunner } = await import("./chat-engine")
    const proj = project({
      model: {
        provider: "openai-compatible",
        modelId: "anthropic/claude-sonnet-4.5",
        baseUrl: "http://cortex-proxy/v1",
      },
    })

    const config = modelConfigForRunner(proj, { version: 1, values: {} }, "alice@example.com")

    expect(config).toMatchObject({
      baseUrl: "http://cortex-proxy/v1",
      headers: { "X-User-ID": "alice@example.com" },
    })
  })

  it("(a) falls back to the project id when no userEmail is available", async () => {
    const { modelConfigForRunner } = await import("./chat-engine")
    const proj = project({
      id: "proj-gateway-fallback",
      model: {
        provider: "openai-compatible",
        modelId: "anthropic/claude-sonnet-4.5",
        baseUrl: "http://cortex-proxy/v1",
      },
    })

    const config = modelConfigForRunner(proj, { version: 1, values: {} }, undefined)

    expect(config.headers).toEqual({ "X-User-ID": "proj-gateway-fallback" })
  })

  it("(b) injects no header for native Anthropic (no baseUrl) - no behavior change", async () => {
    const { modelConfigForRunner } = await import("./chat-engine")
    const proj = project({
      model: { provider: "anthropic", modelId: "claude-sonnet-4-5" },
    })

    const config = modelConfigForRunner(proj, { version: 1, values: {} }, "alice@example.com")

    expect(config).toEqual({
      provider: "anthropic",
      modelId: "claude-sonnet-4-5",
    })
    expect(config).not.toHaveProperty("headers")
    expect(config).not.toHaveProperty("baseUrl")
  })
})

function fakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter
    kill: (signal?: string) => void
  }
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.kill = vi.fn()
  return child
}

/** Configures spawnMock to succeed immediately with a minimal runner reply. */
function spawnSucceeds() {
  spawnMock.mockImplementation(() => {
    const child = fakeChild()
    setTimeout(() => {
      child.stdout.emit("data", Buffer.from('{"reply":"ok"}\n'))
      child.emit("close", 0)
    }, 0)
    return child
  })
}

describe("runFlueTurn spawn env (via runChatTurn)", () => {
  it("(c) includes COWORK_USER_EMAIL, the same identifier as X-User-ID, in the connector subprocess env", async () => {
    const { saveGovernanceConfig } = await import("@/lib/cortex-governance/store")
    const { createSandboxSession } = await import("./sandbox-store")
    const proj = project({ id: "proj-cli" })
    const cfg: CoworkGovernanceConfig = {
      version: 3,
      departments: ["wspolne"],
      skillSources: [],
      connectors: [],
      roles: [],
      userAssignments: {},
      adminEmails: [],
      projects: [proj],
    }
    await saveGovernanceConfig(cfg)
    const session = await createSandboxSession(proj, [], 0)
    spawnSucceeds()

    const { runChatTurn } = await import("./chat-engine")
    await runChatTurn(session, "hello", { userEmail: "bob@example.com" })

    expect(spawnMock).toHaveBeenCalledTimes(1)
    const [, , spawnOptions] = spawnMock.mock.calls[0] as [unknown, unknown, { env: NodeJS.ProcessEnv }]
    expect(spawnOptions.env.COWORK_USER_EMAIL).toBe("bob@example.com")
  })

  it("omits COWORK_USER_EMAIL when no userEmail is available on the turn", async () => {
    const { saveGovernanceConfig } = await import("@/lib/cortex-governance/store")
    const { createSandboxSession } = await import("./sandbox-store")
    const proj = project({ id: "proj-cli-anon" })
    const cfg: CoworkGovernanceConfig = {
      version: 3,
      departments: ["wspolne"],
      skillSources: [],
      connectors: [],
      roles: [],
      userAssignments: {},
      adminEmails: [],
      projects: [proj],
    }
    await saveGovernanceConfig(cfg)
    const session = await createSandboxSession(proj, [], 0)
    spawnSucceeds()

    const { runChatTurn } = await import("./chat-engine")
    await runChatTurn(session, "hello", {})

    expect(spawnMock).toHaveBeenCalledTimes(1)
    const [, , spawnOptions] = spawnMock.mock.calls[0] as [unknown, unknown, { env: NodeJS.ProcessEnv }]
    expect(spawnOptions.env.COWORK_USER_EMAIL).toBeUndefined()
  })
})
