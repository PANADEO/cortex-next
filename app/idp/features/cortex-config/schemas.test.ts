import type { CoworkProjectConfig } from "@cortex/types"
import { describe, expect, it } from "vitest"
import {
  connectorFormValuesToConfig,
  projectFormValuesToInput,
  projectToFormValues,
  type ConnectorFormValues,
  type ProjectFormValues,
} from "./schemas"

function baseValues(overrides: Partial<ProjectFormValues> = {}): ProjectFormValues {
  return {
    id: "proj",
    name: "Proj",
    description: "desc",
    icon: "bot",
    enabled: true,
    allowedRoleIds: ["analyst"],
    modelId: "claude-sonnet-4-5",
    apiKeyRef: "",
    department: "",
    systemPrompt: "",
    briefs: [],
    sandboxMode: "local",
    sandboxPaths: "",
    skillBranches: [],
    skillLeaves: [],
    connectorBranches: [],
    connectorLeaves: [],
    secretBranches: [],
    secretLeaves: [],
    exportDir: "",
    exportDisplayPath: "",
    ...overrides,
  }
}

describe("projectFormValuesToInput", () => {
  it("splits sandbox paths by line and drops blanks", () => {
    const input = projectFormValuesToInput(baseValues({ sandboxPaths: "/a\n\n  /b:ro  \n" }))
    expect(input.sandbox.allowedPaths).toEqual(["/a", "/b:ro"])
  })

  it("omits apiKeyRef when empty", () => {
    const input = projectFormValuesToInput(baseValues())
    expect(input.model.apiKeyRef).toBeUndefined()
  })

  // The form has no provider control and no baseUrl control any more (see the
  // note above projectFormSchema): the only legal provider is written here as
  // a literal, and the endpoint is injected server-side per turn. A form that
  // could still emit a baseUrl would re-open the bug this replaced - one
  // deployment's proxy address frozen into a portable document.
  it("writes the single supported provider and never an endpoint", () => {
    const input = projectFormValuesToInput(baseValues())
    expect(input.model.provider).toBe("openai-compatible")
    expect(input.model).not.toHaveProperty("baseUrl")
    expect(input.model).not.toHaveProperty("headers")
  })

  it("maps grant arrays into the composition", () => {
    const input = projectFormValuesToInput(
      baseValues({
        skillBranches: ["finanse"],
        skillLeaves: ["excel-report"],
        connectorLeaves: ["jira"],
        secretBranches: ["finanse"],
      }),
    )
    expect(input.composition.skills).toEqual({ branches: ["finanse"], leaves: ["excel-report"] })
    expect(input.composition.connectors).toEqual({ branches: [], leaves: ["jira"] })
    expect(input.composition.secrets).toEqual({ branches: ["finanse"], leaves: [] })
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
      model: { provider: "openai-compatible", modelId: "gpt-4" },
      systemPrompt: "hi",
      composition: {
        skills: { branches: ["wspolne"], leaves: [] },
        connectors: { branches: [], leaves: ["jira"] },
        secrets: { branches: ["finanse"], leaves: [] },
      },
      sandbox: { mode: "docker", allowedPaths: ["/a", "/b:ro"] },
      artifactExport: { exportDir: "/share", displayPath: "\\\\nas\\share" },
      createdAt: "",
      updatedAt: "",
    }
    const values = projectToFormValues(project)
    expect(values.modelId).toBe("gpt-4")
    expect(values.sandboxMode).toBe("docker")
    expect(values.skillBranches).toEqual(["wspolne"])
    expect(values.connectorLeaves).toEqual(["jira"])
    expect(values.secretBranches).toEqual(["finanse"])
  })
})

function connectorValues(overrides: Partial<ConnectorFormValues> = {}): ConnectorFormValues {
  return {
    id: "jira",
    department: "finanse",
    type: "mcp",
    name: "Jira",
    description: "",
    enabled: true,
    target: "https://mcp/sse",
    credentialRefs: "",
    baseArgs: "",
    ...overrides,
  }
}

describe("connectorFormValuesToConfig", () => {
  it("parses credential refs from name=path lines", () => {
    const config = connectorFormValuesToConfig(
      connectorValues({
        credentialRefs: "Authorization=finanse/jira/token\nX-Extra=finanse/extra",
      }),
    )
    expect(config.credentialRefs).toEqual({
      Authorization: "finanse/jira/token",
      "X-Extra": "finanse/extra",
    })
    expect(config.department).toBe("finanse")
  })

  it("keeps CLI baseArgs only for cli connectors", () => {
    const cli = connectorFormValuesToConfig(
      connectorValues({ type: "cli", target: "/bin/tool", baseArgs: "--json  --verbose" }),
    )
    expect(cli.baseArgs).toEqual(["--json", "--verbose"])
    const mcp = connectorFormValuesToConfig(connectorValues({ baseArgs: "--json" }))
    expect(mcp.baseArgs).toBeUndefined()
  })
})
