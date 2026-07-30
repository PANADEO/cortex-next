import type {
  CoworkConnectorConfig,
  CoworkGovernanceConfig,
  CoworkProjectConfig,
} from "@cortex/types"
import { grantMatches, secretPathGranted } from "@cortex/types"
import { describe, expect, it } from "vitest"
import { grantedConnectors, isAdmin, rolesForUser, visibleProjectsFor } from "./store"

function project(overrides: Partial<CoworkProjectConfig> = {}): CoworkProjectConfig {
  return {
    id: "proj",
    name: "Proj",
    description: "",
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
    createdAt: "",
    updatedAt: "",
    ...overrides,
  }
}

function connector(overrides: Partial<CoworkConnectorConfig> = {}): CoworkConnectorConfig {
  return {
    id: "conn",
    department: "wspolne",
    type: "cli",
    name: "Conn",
    enabled: true,
    target: "/bin/x",
    ...overrides,
  }
}

function config(overrides: Partial<CoworkGovernanceConfig> = {}): CoworkGovernanceConfig {
  return {
    version: 2,
    departments: ["wspolne", "finanse", "finanse/kontroling"],
    skillSources: [],
    connectors: [],
    roles: [
      { id: "analyst", name: "Analyst" },
      { id: "csv-user", name: "CSV user" },
    ],
    userAssignments: {},
    adminEmails: [],
    projects: [project()],
    ...overrides,
  }
}

describe("grantMatches (department branches + leaves)", () => {
  it("matches a resource under a granted branch (recursively)", () => {
    const grant = { branches: ["finanse"], leaves: [] }
    expect(grantMatches(grant, { id: "a", department: "finanse" })).toBe(true)
    expect(grantMatches(grant, { id: "b", department: "finanse/kontroling" })).toBe(true)
    expect(grantMatches(grant, { id: "c", department: "marketing" })).toBe(false)
  })

  it("matches a resource by leaf id regardless of department", () => {
    const grant = { branches: [], leaves: ["special"] }
    expect(grantMatches(grant, { id: "special", department: "marketing" })).toBe(true)
    expect(grantMatches(grant, { id: "other", department: "marketing" })).toBe(false)
  })
})

describe("secretPathGranted", () => {
  it("grants credential paths under a branch or by exact leaf", () => {
    expect(secretPathGranted({ branches: ["finanse"], leaves: [] }, "finanse/api/token")).toBe(true)
    expect(secretPathGranted({ branches: ["finanse"], leaves: [] }, "marketing/token")).toBe(false)
    expect(secretPathGranted({ branches: [], leaves: ["x/y"] }, "x/y")).toBe(true)
  })
})

describe("grantedConnectors", () => {
  it("returns enabled catalog connectors the composition grants", () => {
    const cfg = config({
      connectors: [
        connector({ id: "fin", department: "finanse" }),
        connector({ id: "mkt", department: "marketing" }),
        connector({ id: "off", department: "finanse", enabled: false }),
      ],
    })
    const proj = project({
      composition: {
        skills: { branches: [], leaves: [] },
        connectors: { branches: ["finanse"], leaves: [] },
        secrets: { branches: [], leaves: [] },
      },
    })
    expect(grantedConnectors(cfg, proj).map((c) => c.id)).toEqual(["fin"])
  })
})

describe("isAdmin bootstrap", () => {
  it("treats everyone as admin while adminEmails is empty", () => {
    expect(isAdmin(config({ adminEmails: [] }), "anyone@x.pl")).toBe(true)
    expect(isAdmin(config({ adminEmails: [] }), undefined)).toBe(true)
  })

  it("locks down once an admin email is set", () => {
    const cfg = config({ adminEmails: ["boss@x.pl"] })
    expect(isAdmin(cfg, "boss@x.pl")).toBe(true)
    expect(isAdmin(cfg, "BOSS@X.PL")).toBe(true)
    expect(isAdmin(cfg, "other@x.pl")).toBe(false)
  })
})

describe("visibleProjectsFor", () => {
  it("hides disabled projects", () => {
    const cfg = config({
      projects: [project({ id: "on" }), project({ id: "off", enabled: false })],
      userAssignments: { "u@x.pl": ["analyst"] },
    })
    expect(visibleProjectsFor(cfg, "u@x.pl").map((p) => p.id)).toEqual(["on"])
  })

  it("shows all enabled projects in open mode", () => {
    const cfg = config({
      projects: [project({ id: "a" }), project({ id: "b", allowedRoleIds: ["nobody"] })],
    })
    expect(
      visibleProjectsFor(cfg, "u@x.pl")
        .map((p) => p.id)
        .sort(),
    ).toEqual(["a", "b"])
  })

  it("filters by role once assignments exist", () => {
    const cfg = config({
      projects: [
        project({ id: "analyst-proj", allowedRoleIds: ["analyst"] }),
        project({ id: "csv-proj", allowedRoleIds: ["csv-user"] }),
      ],
      userAssignments: { "u@x.pl": ["csv-user"] },
    })
    expect(visibleProjectsFor(cfg, "u@x.pl").map((p) => p.id)).toEqual(["csv-proj"])
  })

  it("shows everything to an explicit admin even without matching roles", () => {
    const cfg = config({
      projects: [project({ id: "restricted", allowedRoleIds: ["nobody"] })],
      userAssignments: { "boss@x.pl": [] },
      adminEmails: ["boss@x.pl"],
    })
    expect(visibleProjectsFor(cfg, "boss@x.pl").map((p) => p.id)).toEqual(["restricted"])
  })

  // Regression, 30.07.2026: a missing email used to share a branch with open
  // mode and returned EVERY enabled project, so an anonymous request to
  // GET /api/cortex-cowork/projects got names, descriptions and briefs of all
  // of them. No identity means no role assignment, so the filter must answer
  // with nothing.
  it("returns nothing for a request without identity once assignments exist", () => {
    const cfg = config({
      projects: [project({ id: "a" }), project({ id: "b", allowedRoleIds: ["csv-user"] })],
      userAssignments: { "u@x.pl": ["analyst"] },
    })
    expect(visibleProjectsFor(cfg, undefined)).toEqual([])
  })

  // The other half of the same rule: bootstrap stays open on purpose, exactly
  // as requireProjectAccess() treats it (see denyAnonymous in project-gate.ts).
  it("still shows enabled projects without identity while in open mode", () => {
    const cfg = config({ projects: [project({ id: "a" }), project({ id: "b" })] })
    expect(
      visibleProjectsFor(cfg, undefined)
        .map((p) => p.id)
        .sort(),
    ).toEqual(["a", "b"])
  })
})

describe("rolesForUser", () => {
  it("resolves assigned role objects", () => {
    const cfg = config({ userAssignments: { "u@x.pl": ["analyst"] } })
    expect(rolesForUser(cfg, "u@x.pl").map((r) => r.id)).toEqual(["analyst"])
  })
})
