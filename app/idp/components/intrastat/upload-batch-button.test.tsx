/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { IntrastatUploadBatchButton } from "./upload-batch-button"

const mocks = vi.hoisted(() => ({
  filterOptions: {
    data: {
      clients: ["Jabil", "Flex"],
      months: ["Czerwiec 2026", "Lipiec 2026"],
    } as { clients: string[]; months: string[] } | undefined,
    isError: false,
    isLoading: false,
  },
  mutateAsync: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("@/lib/intrastat/hooks", () => ({
  useIntrastatBatchFilterOptions: () => mocks.filterOptions,
  useIntrastatUploadBatch: () => ({
    isPending: false,
    mutateAsync: mocks.mutateAsync,
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}))

describe("IntrastatUploadBatchButton", () => {
  beforeAll(() => {
    Object.defineProperties(Element.prototype, {
      hasPointerCapture: { configurable: true, value: () => false },
      releasePointerCapture: { configurable: true, value: () => undefined },
      setPointerCapture: { configurable: true, value: () => undefined },
    })
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: () => undefined,
    })
  })

  beforeEach(() => {
    mocks.filterOptions.data = {
      clients: ["Jabil", "Flex"],
      months: ["Czerwiec 2026", "Lipiec 2026"],
    }
    mocks.filterOptions.isError = false
    mocks.filterOptions.isLoading = false
    mocks.mutateAsync.mockReset()
    mocks.mutateAsync.mockResolvedValue({ document_count: 1 })
    mocks.toastError.mockReset()
    mocks.toastSuccess.mockReset()
  })

  afterEach(() => cleanup())

  it("uploads with an existing client and month", async () => {
    const user = await openFilesystemUpload()

    await chooseOption(user, "Transaction kind", "WDT - sales invoices")
    await chooseOption(user, "Client", "Jabil")
    await chooseOption(user, "Month", "Czerwiec 2026")

    const file = new File(["zip"], "invoices.zip", { type: "application/zip" })
    fireEvent.change(getFileInput(), { target: { files: [file] } })

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        file,
        transactionKind: "WDT",
        uploadToFilesystem: true,
        clientName: "Jabil",
        periodMonth: "Czerwiec 2026",
      })
    })
  })

  it("combines a new client with an existing month", async () => {
    const user = await openFilesystemUpload()

    await chooseOption(user, "Transaction kind", "WNT - purchase invoices")
    await chooseOption(user, "Client", "Add new client...")
    await user.type(screen.getByLabelText("New client name"), "  Somfy  ")
    await chooseOption(user, "Month", "Lipiec 2026")

    const file = new File(["zip"], "invoices.zip", { type: "application/zip" })
    fireEvent.change(getFileInput(), { target: { files: [file] } })

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ clientName: "Somfy", periodMonth: "Lipiec 2026" }),
      )
    })
  })

  it("combines an existing client with a new month", async () => {
    const user = await openFilesystemUpload()

    await chooseOption(user, "Transaction kind", "WNT - purchase invoices")
    await chooseOption(user, "Client", "Flex")
    await chooseOption(user, "Month", "Add new month...")
    await user.type(screen.getByLabelText("New month"), "  Sierpień 2026  ")

    const file = new File(["zip"], "invoices.zip", { type: "application/zip" })
    fireEvent.change(getFileInput(), { target: { files: [file] } })

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ clientName: "Flex", periodMonth: "Sierpień 2026" }),
      )
    })
  })

  it("keeps upload disabled until both new values are entered", async () => {
    const user = await openFilesystemUpload()

    await chooseOption(user, "Transaction kind", "WNT - purchase invoices")
    await chooseOption(user, "Client", "Add new client...")
    await chooseOption(user, "Month", "Add new month...")

    const chooseZip = screen.getByRole("button", { name: "Choose ZIP" })
    expect(chooseZip).toBeDisabled()

    await user.type(screen.getByLabelText("New client name"), "Jabil")
    expect(chooseZip).toBeDisabled()

    await user.type(screen.getByLabelText("New month"), "Wrzesień 2026")
    expect(chooseZip).toBeEnabled()
  })

  it("falls back to manual inputs when existing options cannot be loaded", async () => {
    mocks.filterOptions.data = undefined
    mocks.filterOptions.isError = true
    const user = await openFilesystemUpload()

    expect(
      screen.getByText("Could not load existing clients and months. Enter new values manually."),
    ).toBeInTheDocument()

    await chooseOption(user, "Transaction kind", "WDT - sales invoices")
    await user.type(screen.getByLabelText("Client"), "Jabil")
    await user.type(screen.getByLabelText("Month"), "Październik 2026")

    expect(screen.getByRole("button", { name: "Choose ZIP" })).toBeEnabled()
  })
})

async function openFilesystemUpload() {
  const user = userEvent.setup()
  render(<IntrastatUploadBatchButton />)
  await user.click(screen.getByRole("button", { name: "Upload ZIP" }))
  await user.click(screen.getByLabelText("Upload to filesystem"))
  return user
}

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string,
) {
  await user.click(screen.getByLabelText(label))
  await user.click(await screen.findByRole("option", { name: option }))
}

function getFileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error("File input not found")
  return input
}
