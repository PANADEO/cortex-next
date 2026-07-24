// @vitest-environment jsdom
import type { CoworkProjectComposition } from "@cortex/types"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import "@testing-library/jest-dom/vitest"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { Toaster } from "sonner"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ProjectInput } from "../queries"

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

const { useCreateProject } = await import("./use-governance")

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
    model: { provider: "anthropic", modelId: "claude-sonnet-4-5" },
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
