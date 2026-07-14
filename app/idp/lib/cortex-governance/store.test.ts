import type { CoworkGovernanceConfig, CoworkProjectConfig } from "@cortex/types"
import { describe, expect, it } from "vitest"
import {
  effectiveSkillIds,
  isAdmin,
  rolesForUser,
  sessionSkillIds,
  visibleProjectsFor,
} from "./store"

function project(overrides: Partial<CoworkProjectConfig> = {}): CoworkProjectConfig {
  return {
    id: "proj",
    name: "Proj",
    description: "",
    enabled: true,
    archetype: "task-chat",
    allowedRoleIds: ["analyst"],
    model: { provider: "anthropic", modelId: "claude-sonnet-4-5" },
    connectors: [],
    sandbox: { mode: "local", allowedPaths: [] },
    createdAt: "",
    updatedAt: "",
    ...overrides,
  }
}

function config(overrides: Partial<CoworkGovernanceConfig> = {}): CoworkGovernanceConfig {
  return {
    version: 1,
    skillGroups: [
      { id: "reporting", name: "Reporting", skillIds: ["excel-report", "csv-export"] },
      { id: "csv-only", name: "CSV only", skillIds: ["csv-export"] },
    ],
    roles: [
      { id: "analyst", name: "Analyst", skillGroupIds: ["reporting"] },
      { id: "csv-user", name: "CSV user", skillGroupIds: ["csv-only"] },
    ],
    userAssignments: {},
    adminEmails: [],
    projects: [project()],
    ...overrides,
  }
}

describe("effectiveSkillIds", () => {
  it("unions skills across a user's roles, restricted to project-allowed roles", () => {
    const cfg = config({
      userAssignments: { "u@x.pl": ["analyst", "csv-user"] },
    })
    const proj = project({ allowedRoleIds: ["analyst"] })
    // analyst allowed -> reporting skills; csv-user not allowed by project -> excluded
    expect(effectiveSkillIds(cfg, proj, "u@x.pl").sort()).toEqual(["csv-export", "excel-report"])
  })

  it("returns empty when the user holds no role the project allows", () => {
    const cfg = config({ userAssignments: { "u@x.pl": ["csv-user"] } })
    const proj = project({ allowedRoleIds: ["analyst"] })
    expect(effectiveSkillIds(cfg, proj, "u@x.pl")).toEqual([])
  })

  it("is case-insensitive on email", () => {
    const cfg = config({ userAssignments: { "u@x.pl": ["analyst"] } })
    expect(effectiveSkillIds(cfg, project(), "U@X.PL").length).toBeGreaterThan(0)
  })
})

describe("sessionSkillIds open mode", () => {
  it("grants all allowed-role skills when there are no assignments (fresh install)", () => {
    const cfg = config({ userAssignments: {} })
    expect(sessionSkillIds(cfg, project(), "anyone@x.pl").sort()).toEqual([
      "csv-export",
      "excel-report",
    ])
  })

  it("enforces per-user entitlements once any assignment exists", () => {
    const cfg = config({ userAssignments: { "someone@x.pl": ["analyst"] } })
    // A different, unassigned user now gets nothing.
    expect(sessionSkillIds(cfg, project(), "stranger@x.pl")).toEqual([])
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
    expect(isAdmin(cfg, undefined)).toBe(false)
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
    expect(visibleProjectsFor(cfg, "u@x.pl").map((p) => p.id).sort()).toEqual(["a", "b"])
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

  it("shows everything to an admin even without matching roles", () => {
    const cfg = config({
      projects: [project({ id: "restricted", allowedRoleIds: ["nobody"] })],
      userAssignments: { "boss@x.pl": [] },
      adminEmails: ["boss@x.pl"],
    })
    expect(visibleProjectsFor(cfg, "boss@x.pl").map((p) => p.id)).toEqual(["restricted"])
  })
})

describe("rolesForUser", () => {
  it("resolves assigned role objects", () => {
    const cfg = config({ userAssignments: { "u@x.pl": ["analyst"] } })
    expect(rolesForUser(cfg, "u@x.pl").map((r) => r.id)).toEqual(["analyst"])
  })
})
