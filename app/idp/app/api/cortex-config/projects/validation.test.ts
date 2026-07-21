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
    composition: {
      skills: { branches: ["wspolne"], leaves: [] },
      connectors: { branches: [], leaves: [] },
      secrets: { branches: [], leaves: [] },
    },
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

  it("rejects a malformed composition", () => {
    const parsed = parseProjectBody(validBody({ composition: { skills: { branches: ["x"] } } }))
    expect("error" in parsed).toBe(true)
  })

  it("preserves composition grants", () => {
    const value = expectValid(
      validBody({
        composition: {
          skills: { branches: ["finanse"], leaves: ["excel-report"] },
          connectors: { branches: [], leaves: ["jira"] },
          secrets: { branches: ["finanse"], leaves: [] },
        },
      }),
    )
    expect(value.composition.skills.leaves).toEqual(["excel-report"])
    expect(value.composition.connectors.leaves).toEqual(["jira"])
  })
})
