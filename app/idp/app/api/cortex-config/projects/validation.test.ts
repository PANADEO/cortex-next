import type { CoworkProjectConfig } from "@cortex/types"
import { describe, expect, it } from "vitest"
import { parseProjectBody } from "./validation"

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "raporty-finansowe",
    name: "Raporty",
    description: "Agent raportowy",
    enabled: true,
    archetype: "task-chat",
    allowedRoleIds: ["analyst"],
    model: { provider: "anthropic", modelId: "claude-sonnet-4-5" },
    connectors: [],
    sandbox: { mode: "local", allowedPaths: [] },
    ...overrides,
  }
}

function expectValid(body: Record<string, unknown>): CoworkProjectConfig | never {
  const parsed = parseProjectBody(body)
  if ("error" in parsed) throw new Error(`expected valid, got: ${parsed.error}`)
  return parsed.value as CoworkProjectConfig
}

describe("parseProjectBody", () => {
  it("accepts a minimal valid project", () => {
    expect(expectValid(validBody()).id).toBe("raporty-finansowe")
  })

  it("rejects an invalid slug", () => {
    const parsed = parseProjectBody(validBody({ id: "Raporty Finansowe" }))
    expect("error" in parsed).toBe(true)
  })

  it("requires baseUrl for openai-compatible providers", () => {
    const parsed = parseProjectBody(
      validBody({ model: { provider: "openai-compatible", modelId: "gpt-4" } }),
    )
    expect("error" in parsed).toBe(true)
  })

  it("accepts openai-compatible with baseUrl", () => {
    const value = expectValid(
      validBody({
        model: { provider: "openai-compatible", modelId: "gpt-4", baseUrl: "https://x/v1" },
      }),
    )
    expect(value.model.baseUrl).toBe("https://x/v1")
  })

  it("rejects an unknown sandbox mode", () => {
    const parsed = parseProjectBody(validBody({ sandbox: { mode: "vm", allowedPaths: [] } }))
    expect("error" in parsed).toBe(true)
  })

  it("rejects a non-task-chat archetype", () => {
    const parsed = parseProjectBody(validBody({ archetype: "dashboard" }))
    expect("error" in parsed).toBe(true)
  })

  it("validates connector shape", () => {
    const parsed = parseProjectBody(
      validBody({ connectors: [{ id: "x", type: "smtp", name: "X", enabled: true, target: "y" }] }),
    )
    expect("error" in parsed).toBe(true)
  })

  it("preserves a well-formed connector", () => {
    const value = expectValid(
      validBody({
        connectors: [
          {
            id: "jira",
            type: "mcp",
            name: "Jira",
            enabled: true,
            target: "https://mcp/sse",
            credentialRefs: { Authorization: "jira/token" },
          },
        ],
      }),
    )
    expect(value.connectors[0]?.type).toBe("mcp")
  })
})
