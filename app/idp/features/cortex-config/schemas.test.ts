import type { CoworkProjectConfig } from "@cortex/types"
import { describe, expect, it } from "vitest"
import { projectFormValuesToInput, projectToFormValues, type ProjectFormValues } from "./schemas"

function baseValues(overrides: Partial<ProjectFormValues> = {}): ProjectFormValues {
  return {
    id: "proj",
    name: "Proj",
    description: "desc",
    icon: "bot",
    enabled: true,
    allowedRoleIds: ["analyst"],
    provider: "anthropic",
    modelId: "claude-sonnet-4-5",
    baseUrl: "",
    apiKeyRef: "",
    systemPrompt: "",
    sandboxMode: "local",
    sandboxPaths: "",
    connectors: [],
    exportDir: "",
    exportDisplayPath: "",
    ...overrides,
  }
}

describe("projectFormValuesToInput", () => {
  it("splits sandbox paths by line and drops blanks", () => {
    const input = projectFormValuesToInput(
      baseValues({ sandboxPaths: "/a\n\n  /b:ro  \n" }),
    )
    expect(input.sandbox.allowedPaths).toEqual(["/a", "/b:ro"])
  })

  it("omits apiKeyRef and baseUrl when empty", () => {
    const input = projectFormValuesToInput(baseValues())
    expect(input.model.apiKeyRef).toBeUndefined()
    expect(input.model.baseUrl).toBeUndefined()
  })

  it("parses connector credential refs from name=path lines", () => {
    const input = projectFormValuesToInput(
      baseValues({
        connectors: [
          {
            id: "jira",
            type: "mcp",
            name: "Jira",
            description: "",
            enabled: true,
            target: "https://mcp/sse",
            credentialRefs: "Authorization=jira/token\nX-Extra=jira/extra",
            baseArgs: "",
          },
        ],
      }),
    )
    expect(input.connectors[0]?.credentialRefs).toEqual({
      Authorization: "jira/token",
      "X-Extra": "jira/extra",
    })
  })

  it("parses CLI baseArgs on whitespace and keeps them only for cli", () => {
    const input = projectFormValuesToInput(
      baseValues({
        connectors: [
          {
            id: "tool",
            type: "cli",
            name: "Tool",
            description: "",
            enabled: true,
            target: "/bin/tool",
            credentialRefs: "",
            baseArgs: "--json  --verbose",
          },
        ],
      }),
    )
    expect(input.connectors[0]?.baseArgs).toEqual(["--json", "--verbose"])
  })

  it("only sets artifactExport when a dir is provided", () => {
    expect(projectFormValuesToInput(baseValues()).artifactExport).toBeUndefined()
    const withExport = projectFormValuesToInput(
      baseValues({ exportDir: "/mnt/share", exportDisplayPath: "\\\\nas\\share" }),
    )
    expect(withExport.artifactExport).toEqual({
      exportDir: "/mnt/share",
      displayPath: "\\\\nas\\share",
    })
  })
})

describe("projectToFormValues round-trip", () => {
  it("restores form values from a stored project", () => {
    const project: CoworkProjectConfig = {
      id: "proj",
      name: "Proj",
      description: "desc",
      icon: "bot",
      enabled: true,
      archetype: "task-chat",
      allowedRoleIds: ["analyst"],
      model: { provider: "openai-compatible", modelId: "gpt-4", baseUrl: "https://x/v1" },
      systemPrompt: "hi",
      connectors: [],
      sandbox: { mode: "docker", allowedPaths: ["/a", "/b:ro"] },
      artifactExport: { exportDir: "/share", displayPath: "\\\\nas\\share" },
      createdAt: "",
      updatedAt: "",
    }
    const values = projectToFormValues(project)
    expect(values.provider).toBe("openai-compatible")
    expect(values.sandboxMode).toBe("docker")
    expect(values.sandboxPaths).toBe("/a\n/b:ro")
    expect(values.exportDir).toBe("/share")
  })
})
