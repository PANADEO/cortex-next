/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import IntrastatSettingsPage from "./page"

const mocks = vi.hoisted(() => ({
  apps: ["intrastat"] as string[],
  previewQuery: undefined as { client_id?: string; path?: string } | undefined,
  deleteClient: vi.fn(),
}))

vi.mock("@cortex/api", () => ({
  useAuthorizedApps: () => ({ apps: mocks.apps, isLoading: false }),
}))

vi.mock("@/components/intrastat/filesystem-client-dialog", () => ({
  FilesystemClientDialog: () => <div>Client folder dialog</div>,
}))

vi.mock("@/lib/intrastat/hooks", () => ({
  useIntrastatSettings: () => ({
    data: {
      filesystem_configured: true,
      intrastat_watch_dir: "/app/incoming",
      filesystem_poll_interval_seconds: 10,
      filesystem_enabled: true,
      worker_enabled: true,
      gemini_configured: true,
      gemini_model: "gemini-test",
    },
    isLoading: false,
  }),
  useIntrastatFilesystemClients: () => ({
    data: {
      items: [
        { id: "delta-id", client_name: "Delta", folder_name: "Delta", available: true },
        { id: "flex-id", client_name: "Flex", folder_name: "Flex", available: false },
      ],
    },
    isLoading: false,
  }),
  useIntrastatFilesystemPreview: (query: { client_id?: string; path?: string }) => {
    mocks.previewQuery = query
    return {
      data: {
        configured: true,
        root: "/app/incoming/Delta",
        current_path: "",
        parent_path: null,
        entries: [],
        total: 0,
      },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    }
  },
  useIntrastatPollFilesystem: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useIntrastatDeleteFilesystemClient: () => ({
    mutateAsync: mocks.deleteClient,
    isPending: false,
  }),
  useIntrastatDownloadFilesystemFile: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useIntrastatDeleteFilesystemFile: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe("IntrastatSettingsPage", () => {
  beforeEach(() => {
    mocks.apps = ["intrastat"]
    mocks.previewQuery = undefined
    mocks.deleteClient.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => cleanup())

  it("shows mapped clients and preview access without configuration edit actions", () => {
    render(<IntrastatSettingsPage />)

    expect(screen.getAllByText("Delta")).toHaveLength(2)
    expect(screen.getAllByText("Flex")).toHaveLength(2)
    expect(screen.getByText("Gotowy")).toBeInTheDocument()
    expect(screen.getByText("Brak")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Przeglądaj" })).toHaveLength(2)
    expect(screen.queryByRole("button", { name: "Dodaj klienta" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Edytuj" })).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Usuń mapowanie folderu klienta" }),
    ).not.toBeInTheDocument()
    expect(mocks.previewQuery).toMatchObject({ client_id: "delta-id", path: "" })
  })

  it("selects the client whose folder should be previewed", async () => {
    const user = userEvent.setup()
    render(<IntrastatSettingsPage />)

    await user.click(screen.getAllByRole("button", { name: "Przeglądaj" })[1]!)

    expect(mocks.previewQuery).toMatchObject({ client_id: "flex-id", path: "" })
    expect(screen.getByText("Flex — Flex")).toBeInTheDocument()
  })

  it("shows client configuration actions and a file-safe delete warning to an editor", async () => {
    const user = userEvent.setup()
    mocks.apps = ["intrastat", "intrastat-config-editor"]

    render(<IntrastatSettingsPage />)

    expect(screen.getByRole("button", { name: "Dodaj klienta" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Edytuj" })).toHaveLength(2)
    const deleteButtons = screen.getAllByRole("button", {
      name: "Usuń mapowanie folderu klienta",
    })
    expect(deleteButtons).toHaveLength(2)

    await user.click(deleteButtons[0]!)

    expect(
      screen.getByText(/Podpięty folder i wszystkie pliki w środku zostają nietknięte/),
    ).toBeInTheDocument()
  })
})
