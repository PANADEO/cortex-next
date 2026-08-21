import { builtinSkillsDir } from "@/lib/data-dir"
import type { CoworkGovernanceConfig, CoworkProjectComposition } from "@cortex/types"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
// Tylko typ — znika przy transpilacji, więc nie ładuje modułu przed
// podstawieniem COWORK_DATA_DIR (patrz komentarz niżej).
import type * as Validation from "./validation"

// Exercises findInvalidGrantReferences against the REAL catalog: the actual
// built-in skills folder on disk (csv-export, excel-report - see
// features/cortex-cowork/skills/*/SKILL.md) and a real credentials.json read
// through COWORK_DATA_DIR. Not mocked: it proves the disk-backed skill scan
// and the credentials store read actually reject/accept for real, not just
// against an in-memory stub.
//
// The data dir is seeded here, per test, in a temp directory. It used to be
// supplied by the test runner invocation instead, which is why this file was
// permanently red under a plain `pnpm test` on a clean checkout: nothing in
// the repo set COWORK_DATA_DIR, so the one test needing a real secret could
// never pass. A test that only works with an environment documented outside
// the repo is a test nobody can trust - the seed belongs here.
//
// credentials.ts resolves COWORK_DATA_DIR at MODULE LOAD, so the env has to be
// stubbed before the import - hence resetModules() plus dynamic import inside
// each test rather than a static one at the top.

const SECRET_PATH = "wspolne/llm/cortex-proxy"

let dataDir: string

async function loadValidation(): Promise<typeof Validation> {
  return import("./validation")
}

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  dataDir = mkdtempSync(path.join(tmpdir(), "cortex-config-validation-"))
  writeFileSync(
    path.join(dataDir, "credentials.json"),
    JSON.stringify({ version: 1, values: { [SECRET_PATH]: "wartosc-testowa" } }),
    "utf8",
  )
  vi.stubEnv("COWORK_DATA_DIR", dataDir)
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(dataDir, { force: true, recursive: true })
})

function baseConfig(overrides: Partial<CoworkGovernanceConfig> = {}): CoworkGovernanceConfig {
  return {
    version: 3,
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

    const { findInvalidGrantReferences } = await loadValidation()

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
      secrets: { branches: [], leaves: [SECRET_PATH] },
    }

    const { findInvalidGrantReferences } = await loadValidation()

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

    const { findInvalidGrantReferences } = await loadValidation()

    expect(await findInvalidGrantReferences(composition, config)).toEqual([])
  })

  it("treats an empty composition as trivially valid", async () => {
    const composition: CoworkProjectComposition = {
      skills: { branches: [], leaves: [] },
      connectors: { branches: [], leaves: [] },
      secrets: { branches: [], leaves: [] },
    }

    const { findInvalidGrantReferences } = await loadValidation()

    expect(await findInvalidGrantReferences(composition, baseConfig())).toEqual([])
  })
})
