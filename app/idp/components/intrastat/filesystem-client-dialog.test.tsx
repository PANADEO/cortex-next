/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FilesystemClientDialog } from "./filesystem-client-dialog"

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  updateClient: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@/lib/intrastat/hooks", () => ({
  useIntrastatCreateFilesystemClient: () => ({
    mutateAsync: mocks.createClient,
    isPending: false,
  }),
  useIntrastatUpdateFilesystemClient: () => ({
    mutateAsync: mocks.updateClient,
    isPending: false,
  }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: mocks.toastError },
}))

describe("FilesystemClientDialog", () => {
  beforeEach(() => {
    mocks.createClient.mockReset().mockResolvedValue({
      id: "jabil-id",
      client_name: "Jabil",
      folder_name: "jabil-share",
      available: false,
    })
    mocks.updateClient.mockReset()
    mocks.toastError.mockReset()
  })

  afterEach(() => cleanup())

  it("creates a mapping even when its mounted folder is not yet available", async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <FilesystemClientDialog client={null} open onOpenChange={onOpenChange} onSaved={onSaved} />,
    )

    await user.type(screen.getByLabelText("Client"), "Jabil")
    await user.type(screen.getByLabelText("Mounted folder"), "jabil-share")
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(mocks.createClient).toHaveBeenCalledWith({
        client_name: "Jabil",
        folder_name: "jabil-share",
      })
    })
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "jabil-id" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("rejects paths instead of a direct mounted folder name", async () => {
    const user = userEvent.setup()
    render(<FilesystemClientDialog client={null} open onOpenChange={vi.fn()} onSaved={vi.fn()} />)

    await user.type(screen.getByLabelText("Client"), "Jabil")
    await user.type(screen.getByLabelText("Mounted folder"), "clients/jabil")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Enter one mounted folder name without slashes or parent paths",
    )
  })

  it("updates an existing mapping", async () => {
    const user = userEvent.setup()
    const saved = {
      id: "jabil-id",
      client_name: "Jabil Poland",
      folder_name: "Jabil",
      available: true,
    }
    mocks.updateClient.mockResolvedValue(saved)
    const onSaved = vi.fn()
    render(
      <FilesystemClientDialog
        client={{
          id: "jabil-id",
          client_name: "Jabil",
          folder_name: "Jabil",
          available: true,
        }}
        open
        onOpenChange={vi.fn()}
        onSaved={onSaved}
      />,
    )

    const clientInput = screen.getByLabelText("Client")
    await user.clear(clientInput)
    await user.type(clientInput, "Jabil Poland")
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(mocks.updateClient).toHaveBeenCalledWith({
        clientId: "jabil-id",
        payload: { client_name: "Jabil Poland", folder_name: "Jabil" },
      })
    })
    expect(onSaved).toHaveBeenCalledWith(saved)
  })
})
