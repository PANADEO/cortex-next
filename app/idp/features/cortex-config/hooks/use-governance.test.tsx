// @vitest-environment jsdom
import type { CoworkConnectorConfig, CoworkProjectComposition, CoworkSkillSource } from "@cortex/types"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import "@testing-library/jest-dom/vitest"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { Toaster } from "sonner"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { GovernanceUpdate, ProjectInput } from "../queries"

// use-governance.ts pulls coworkQueryKeys from the cortex-cowork feature
// barrel, whose component exports transitively import react-markdown - not
// installed in this workspace (unrelated to this fix). Stub the barrel to
// just the query-key shape use-governance.ts actually needs, so the test
// exercises real save/error-toast wiring without dragging in that dependency.
vi.mock("@/features/cortex-cowork", () => ({
  coworkQueryKeys: {
    all: ["cortex-cowork"] as const,
    projects: () => ["cortex-cowork", "projects"] as const,
  },
}))

const {
  useCreateProject,
  useUpdateGovernance,
  useUpdateConnectors,
  useUpdateSkillSources,
  useUpdateDepartments,
  useSetCredential,
  useDeleteCredential,
} = await import("./use-governance")

// Regression coverage for the UX gap a live Playwright pass found: when
// findInvalidGrantReferences() rejects a save (grant pointing at a deleted
// skill/connector/department/secret), the server returns a real 400 with
// { message, invalidReferences }, but the project editor showed nothing at
// all - no toast, no banner. This renders the REAL sonner <Toaster/> (not a
// mocked toast module) so the assertion proves the message actually reaches
// the screen, not just that a function was called.

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={freshClient()}>
      {children}
      <Toaster />
    </QueryClientProvider>
  )
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function emptyGrant() {
  return { branches: [], leaves: [] }
}

function projectInput(composition: CoworkProjectComposition): ProjectInput {
  return {
    id: "proj-1",
    name: "Projekt testowy",
    description: "opis",
    enabled: true,
    archetype: "task-chat",
    allowedRoleIds: [],
    model: { provider: "openai-compatible", modelId: "claude-sonnet-4-5" },
    composition,
    sandbox: { mode: "local", allowedPaths: [] },
  }
}

function HookHost({ input }: { input: ProjectInput }) {
  const createProject = useCreateProject()
  return (
    <button type="button" onClick={() => createProject.mutate(input)}>
      save
    </button>
  )
}

describe("useCreateProject error surfacing", () => {
  it("renders the server's message and the specific invalid references as a visible toast", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            {
              message: "composition grants reference unknown catalog resources",
              invalidReferences: [
                { kind: "skills", part: "leaves", value: "skill-usuniety" },
                { kind: "connectors", part: "branches", value: "dzial/nieistniejacy" },
              ],
            },
            400,
          ),
        ),
      ),
    )

    const input = projectInput({
      skills: { branches: [], leaves: ["skill-usuniety"] },
      connectors: { branches: ["dzial/nieistniejacy"], leaves: [] },
      secrets: emptyGrant(),
    })

    render(
      <Wrapper>
        <HookHost input={input} />
      </Wrapper>,
    )

    await act(async () => {
      screen.getByRole("button", { name: "save" }).click()
    })

    // The real server message, not a generic "save failed".
    await waitFor(() =>
      expect(
        screen.getByText("composition grants reference unknown catalog resources"),
      ).toBeInTheDocument(),
    )

    // The specific broken references, so the admin knows what to fix.
    expect(screen.getByText(/Skille - pozycja: skill-usuniety/)).toBeInTheDocument()
    expect(screen.getByText(/Konektory - gałąź: dzial\/nieistniejacy/)).toBeInTheDocument()
  })
})

// Regression coverage for the 5 more mutations found to have the identical
// gap as useCreateProject/useUpdateProject above: no onError, so a real
// 400/404 from the backing route produced an unhandled promise rejection
// with zero user-visible feedback. Unlike the project-save endpoint, none of
// these routes return a structured invalidReferences-style body - each is a
// flat { message } - so a plain toastApiError() fallback (no custom
// formatting) is the right shape here.

function GovernanceHost({ update }: { update: GovernanceUpdate }) {
  const updateGovernance = useUpdateGovernance()
  return (
    <button type="button" onClick={() => updateGovernance.mutate(update)}>
      save
    </button>
  )
}

describe("useUpdateGovernance error surfacing", () => {
  it("renders the server's message as a visible toast on a 400 validation failure", async () => {
    // Real shape from governance/route.ts's invalidReason(): a role missing
    // id/name.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse({ message: "each role needs id and name" }, 400))),
    )

    render(
      <Wrapper>
        <GovernanceHost update={{ roles: [{ id: "", name: "" }] }} />
      </Wrapper>,
    )

    await act(async () => {
      screen.getByRole("button", { name: "save" }).click()
    })

    await waitFor(() =>
      expect(screen.getByText("each role needs id and name")).toBeInTheDocument(),
    )
  })
})

function ConnectorsHost({ connectors }: { connectors: CoworkConnectorConfig[] }) {
  const updateConnectors = useUpdateConnectors()
  return (
    <button type="button" onClick={() => updateConnectors.mutate(connectors)}>
      save
    </button>
  )
}

describe("useUpdateConnectors error surfacing", () => {
  it("renders the server's message as a visible toast on a 400 validation failure", async () => {
    // Real shape from catalog/connectors/route.ts's invalidReason(): missing id.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse({ message: "id is required" }, 400))),
    )

    render(
      <Wrapper>
        <ConnectorsHost
          connectors={[
            {
              id: "",
              department: "finanse",
              type: "mcp",
              name: "Jira",
              enabled: true,
              target: "https://mcp.example.com",
            },
          ]}
        />
      </Wrapper>,
    )

    await act(async () => {
      screen.getByRole("button", { name: "save" }).click()
    })

    await waitFor(() => expect(screen.getByText("id is required")).toBeInTheDocument())
  })
})

function SkillSourcesHost({ sources }: { sources: CoworkSkillSource[] }) {
  const updateSources = useUpdateSkillSources()
  return (
    <button type="button" onClick={() => updateSources.mutate(sources)}>
      save
    </button>
  )
}

describe("useUpdateSkillSources error surfacing", () => {
  it("renders the server's message as a visible toast on a 400 validation failure", async () => {
    // Real shape from catalog/skill-sources/route.ts's invalidReason(): id
    // not matching the slug pattern.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse({ message: "id must be a slug" }, 400))),
    )

    render(
      <Wrapper>
        <SkillSourcesHost
          sources={[
            { id: "Zle ID", name: "Finanse", folderPath: "/mnt/finanse", department: "finanse" },
          ]}
        />
      </Wrapper>,
    )

    await act(async () => {
      screen.getByRole("button", { name: "save" }).click()
    })

    await waitFor(() => expect(screen.getByText("id must be a slug")).toBeInTheDocument())
  })
})

function DepartmentsHost({ departments }: { departments: string[] }) {
  const updateDepartments = useUpdateDepartments()
  return (
    <button type="button" onClick={() => updateDepartments.mutate(departments)}>
      save
    </button>
  )
}

describe("useUpdateDepartments error surfacing", () => {
  it("renders the server's message as a visible toast on a 400 validation failure", async () => {
    // Real shape from catalog/departments/route.ts: a path not matching
    // COWORK_DEPARTMENT_PATTERN.
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(jsonResponse({ message: "invalid department path: FINANSE" }, 400)),
      ),
    )

    render(
      <Wrapper>
        <DepartmentsHost departments={["FINANSE"]} />
      </Wrapper>,
    )

    await act(async () => {
      screen.getByRole("button", { name: "save" }).click()
    })

    await waitFor(() =>
      expect(screen.getByText("invalid department path: FINANSE")).toBeInTheDocument(),
    )
  })

  // Regression guard, verified by hand while writing this fix: temporarily
  // deleting the `onError` line from useUpdateDepartments in
  // use-governance.ts and re-running this test fails it (waitFor times out -
  // no toast ever renders, matching the original silent-failure bug).
  // Restoring the line makes it pass again - proving this assertion is a
  // real guard, not a tautology.
})

function SetCredentialHost({ path, value }: { path: string; value: string }) {
  const setCredential = useSetCredential()
  return (
    <button type="button" onClick={() => setCredential.mutate({ path, value })}>
      save
    </button>
  )
}

describe("useSetCredential error surfacing", () => {
  it("renders the server's message as a visible toast on a 400 validation failure", async () => {
    // Real shape from credentials/route.ts PUT: a path failing
    // isValidCredentialPath().
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ message: "path must be key/subkey (lowercase slugs separated by /)" }, 400),
        ),
      ),
    )

    render(
      <Wrapper>
        <SetCredentialHost path="ZLA SCIEZKA" value="tajne" />
      </Wrapper>,
    )

    await act(async () => {
      screen.getByRole("button", { name: "save" }).click()
    })

    await waitFor(() =>
      expect(
        screen.getByText("path must be key/subkey (lowercase slugs separated by /)"),
      ).toBeInTheDocument(),
    )
  })
})

function DeleteCredentialHost({ path }: { path: string }) {
  const deleteCredential = useDeleteCredential()
  return (
    <button type="button" onClick={() => deleteCredential.mutate(path)}>
      delete
    </button>
  )
}

describe("useDeleteCredential error surfacing", () => {
  it("renders the server's message as a visible toast on a 404 unknown-path failure", async () => {
    // Real shape from credentials/route.ts DELETE: deleteCredential()
    // returning false for an unknown path.
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(jsonResponse({ message: "Unknown credential: llm/nieistniejacy" }, 404)),
      ),
    )

    render(
      <Wrapper>
        <DeleteCredentialHost path="llm/nieistniejacy" />
      </Wrapper>,
    )

    await act(async () => {
      screen.getByRole("button", { name: "delete" }).click()
    })

    await waitFor(() =>
      expect(screen.getByText("Unknown credential: llm/nieistniejacy")).toBeInTheDocument(),
    )
  })
})
