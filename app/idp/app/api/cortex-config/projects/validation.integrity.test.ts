import { builtinSkillsDir } from "@/lib/data-dir"
import type { CoworkGovernanceConfig, CoworkProjectComposition } from "@cortex/types"
import { describe, expect, it } from "vitest"
import { findInvalidGrantReferences } from "./validation"

// Exercises findInvalidGrantReferences against the REAL catalog: the actual
// built-in skills folder on disk (csv-export, excel-report - see
// features/cortex-cowork/skills/*/SKILL.md) and a real credentials.json read
// through COWORK_DATA_DIR (set by the test runner invocation - see the run
// command documented in the Obsidian task note's "Testy" section). This is
// not mocked: it proves the disk-backed skill scan and the credentials store
// read actually reject/accept for real, not just against an in-memory stub.

function baseConfig(overrides: Partial<CoworkGovernanceConfig> = {}): CoworkGovernanceConfig {
  return {
    version: 2,
    departments: ["wspolne"],
    skillSources: [
      {
        id: "builtin",
        name: "Wbudowane skille",
        folderPath: builtinSkillsDir(),
        department: "wspolne",
      },
    ],
    connectors: [
      {
        id: "jira",
        department: "wspolne",
        type: "cli",
        name: "Jira CLI",
        enabled: true,
        target: "/usr/local/bin/jira",
      },
    ],
    roles: [],
    userAssignments: {},
    adminEmails: [],
    projects: [],
    ...overrides,
  }
}

describe("findInvalidGrantReferences (real catalog on disk + real credentials store)", () => {
  it("rejects a grant pointing at a nonexistent department/skill/connector/secret", async () => {
    const composition: CoworkProjectComposition = {
      skills: { branches: ["dzial-ktory-nie-istnieje"], leaves: ["skill-ktorego-nie-ma"] },
      connectors: { branches: ["inny-nieistniejacy-dzial"], leaves: ["connector-ktorego-nie-ma"] },
      secrets: { branches: [], leaves: ["sekret/ktorego/nie-ma"] },
    }

    const invalid = await findInvalidGrantReferences(composition, baseConfig())

    expect(invalid).toEqual(
      expect.arrayContaining([
        { kind: "skills", part: "branches", value: "dzial-ktory-nie-istnieje" },
        { kind: "skills", part: "leaves", value: "skill-ktorego-nie-ma" },
        { kind: "connectors", part: "branches", value: "inny-nieistniejacy-dzial" },
        { kind: "connectors", part: "leaves", value: "connector-ktorego-nie-ma" },
        { kind: "secrets", part: "leaves", value: "sekret/ktorego/nie-ma" },
      ]),
    )
    expect(invalid).toHaveLength(5)
  })

  it("accepts a grant that references only real, existing catalog resources", async () => {
    const composition: CoworkProjectComposition = {
      skills: { branches: ["wspolne"], leaves: ["csv-export"] },
      connectors: { branches: [], leaves: ["jira"] },
      secrets: { branches: [], leaves: ["wspolne/llm/cortex-proxy"] },
    }

    const invalid = await findInvalidGrantReferences(composition, baseConfig())

    expect(invalid).toEqual([])
  })

  it("does not require a connector to be enabled - existence, not usability, is what's checked", async () => {
    const composition: CoworkProjectComposition = {
      skills: { branches: [], leaves: [] },
      connectors: { branches: [], leaves: ["jira"] },
      secrets: { branches: [], leaves: [] },
    }
    const config = baseConfig({
      connectors: [
        {
          id: "jira",
          department: "wspolne",
          type: "cli",
          name: "Jira CLI",
          enabled: false,
          target: "/usr/local/bin/jira",
        },
      ],
    })

    expect(await findInvalidGrantReferences(composition, config)).toEqual([])
  })

  it("treats an empty composition as trivially valid", async () => {
    const composition: CoworkProjectComposition = {
      skills: { branches: [], leaves: [] },
      connectors: { branches: [], leaves: [] },
      secrets: { branches: [], leaves: [] },
    }

    expect(await findInvalidGrantReferences(composition, baseConfig())).toEqual([])
  })
})
