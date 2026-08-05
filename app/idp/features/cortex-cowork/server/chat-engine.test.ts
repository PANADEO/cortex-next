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
//       alongside the cortex-proxy endpoint it now resolves from the server
//       environment rather than from the stored project (05.08.2026).
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

describe("modelConfigForRunner", () => {
  it("(a) injects X-User-ID when a userEmail is available", async () => {
    vi.stubEnv("CORTEX_PROXY_URL", "http://cortex-proxy")
    const { modelConfigForRunner } = await import("./chat-engine")
    const proj = project({
      model: { provider: "openai-compatible", modelId: "anthropic/claude-sonnet-4.5" },
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
      model: { provider: "openai-compatible", modelId: "anthropic/claude-sonnet-4.5" },
    })

    const config = modelConfigForRunner(proj, { version: 1, values: {} }, undefined)

    expect(config.headers).toEqual({ "X-User-ID": "proj-gateway-fallback" })
  })

  // 05.08.2026: projects stopped storing an endpoint. The address of
  // cortex-proxy is a property of the environment the app runs in, so it is
  // read here, per turn, and a project document is portable between stacks.
  // Before this, the "new project" form prefilled the Docker-DNS hostname
  // (the browser cannot read CORTEX_PROXY_URL), which resolved only on the
  // droplet - everywhere else the turn failed inside Flue and streamChatTurn
  // swallowed it into the keyword router.
  it("(b) takes the endpoint from CORTEX_PROXY_URL, not from the stored project", async () => {
    vi.stubEnv("CORTEX_PROXY_URL", "http://localhost:8240")
    const { modelConfigForRunner } = await import("./chat-engine")
    const proj = project({
      model: { provider: "openai-compatible", modelId: "anthropic/claude-sonnet-4.6" },
    })

    const config = modelConfigForRunner(proj, { version: 1, values: {} }, "alice@example.com")

    expect(config).toEqual({
      provider: "openai-compatible",
      modelId: "anthropic/claude-sonnet-4.6",
      baseUrl: "http://localhost:8240/v1",
      headers: { "X-User-ID": "alice@example.com" },
    })
  })

  it("(b) falls back to the Docker-DNS convention when CORTEX_PROXY_URL is unset", async () => {
    vi.stubEnv("CORTEX_PROXY_URL", "")
    const { modelConfigForRunner } = await import("./chat-engine")

    const config = modelConfigForRunner(project(), { version: 1, values: {} }, "alice@example.com")

    expect(config.baseUrl).toBe("http://cortex-proxy/v1")
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
