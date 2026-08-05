import type {
  CoworkConnectorConfig,
  CoworkGovernanceConfig,
  CoworkProjectConfig,
} from "@cortex/types"
import { grantMatches, secretPathGranted } from "@cortex/types"
import { describe, expect, it } from "vitest"
import {
  grantedConnectors,
  isBootstrapAdminMode,
  isExplicitAdmin,
  rolesForUser,
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
    version: 3,
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

// This block used to assert the OPPOSITE, on isAdmin(), and pinned the
// vulnerability as intended behaviour:
//
//   expect(isAdmin(config({ adminEmails: [] }), "anyone@x.pl")).toBe(true)
//   expect(isAdmin(config({ adminEmails: [] }), undefined)).toBe(true)
//
// The second line is a test asserting that an ANONYMOUS caller administers a
// fresh instance. isAdmin() no longer exists (see the note in store.ts): an
// empty adminEmails list is now only one INPUT to the decision, and the
// decision itself needs the caller's system_config grant, which this file
// cannot see. What is left here is the pair of pure predicates, and the rule
// that neither of them alone says "yes, you are an admin" - proven at the
// gate in admin-gate.test.ts.
describe("admin predicates", () => {
  it("reports bootstrap mode from an empty adminEmails list, for ANY caller", () => {
    // Deliberately the same answer for an identified and an anonymous caller:
    // this predicate describes the DOCUMENT, not the requester. Reading it as
    // "and therefore they may administer" is the bug that was here.
    expect(isBootstrapAdminMode(config({ adminEmails: [] }))).toBe(true)
    expect(isBootstrapAdminMode(config({ adminEmails: ["boss@x.pl"] }))).toBe(false)
  })

  it("never treats an unnamed caller as an explicit admin, bootstrap or not", () => {
    expect(isExplicitAdmin(config({ adminEmails: [] }), "anyone@x.pl")).toBe(false)
    expect(isExplicitAdmin(config({ adminEmails: [] }), undefined)).toBe(false)
  })

  it("recognises a named admin case-insensitively once the list is set", () => {
    const cfg = config({ adminEmails: ["boss@x.pl"] })
    expect(isExplicitAdmin(cfg, "boss@x.pl")).toBe(true)
    expect(isExplicitAdmin(cfg, "BOSS@X.PL")).toBe(true)
    expect(isExplicitAdmin(cfg, "other@x.pl")).toBe(false)
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

  // The other half of the same rule, and the half that was still open until
  // 30.07.2026. This assertion used to read "still SHOWS enabled projects
  // without identity while in open mode" - and open mode is the state every
  // fresh instance starts in, so in practice the anonymous leak this file
  // claimed to have closed was still reachable on exactly the deployments
  // that matter. No identity, no projects, in every mode.
  it("returns nothing for a request without identity in open mode too", () => {
    const cfg = config({ projects: [project({ id: "a" }), project({ id: "b" })] })
    expect(visibleProjectsFor(cfg, undefined)).toEqual([])
  })

  // Open mode keeps doing its actual job for an IDENTIFIED caller: no role
  // has been assigned yet, so the role filter cannot be what decides.
  it("still shows enabled projects to an identified caller in open mode", () => {
    const cfg = config({ projects: [project({ id: "a" }), project({ id: "b" })] })
    expect(
      visibleProjectsFor(cfg, "u@x.pl")
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
