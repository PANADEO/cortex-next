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

    await chooseOption(user, "Rodzaj transakcji", "WDT — faktury sprzedaży")
    await chooseOption(user, "Klient", "Jabil")
    await chooseOption(user, "Miesiąc", "Czerwiec 2026")

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

    await chooseOption(user, "Rodzaj transakcji", "WNT — faktury zakupu")
    await chooseOption(user, "Klient", "Dodaj nowego klienta…")
    await user.type(screen.getByLabelText("Nazwa nowego klienta"), "  Somfy  ")
    await chooseOption(user, "Miesiąc", "Lipiec 2026")

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

    await chooseOption(user, "Rodzaj transakcji", "WNT — faktury zakupu")
    await chooseOption(user, "Klient", "Flex")
    await chooseOption(user, "Miesiąc", "Dodaj nowy miesiąc…")
    await user.type(screen.getByLabelText("Nowy miesiąc"), "  Sierpień 2026  ")

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

    await chooseOption(user, "Rodzaj transakcji", "WNT — faktury zakupu")
    await chooseOption(user, "Klient", "Dodaj nowego klienta…")
    await chooseOption(user, "Miesiąc", "Dodaj nowy miesiąc…")

    const chooseZip = screen.getByRole("button", { name: "Wybierz ZIP" })
    expect(chooseZip).toBeDisabled()

    await user.type(screen.getByLabelText("Nazwa nowego klienta"), "Jabil")
    expect(chooseZip).toBeDisabled()

    await user.type(screen.getByLabelText("Nowy miesiąc"), "Wrzesień 2026")
    expect(chooseZip).toBeEnabled()
  })

  it("falls back to manual inputs when existing options cannot be loaded", async () => {
    mocks.filterOptions.data = undefined
    mocks.filterOptions.isError = true
    const user = await openFilesystemUpload()

    expect(
      screen.getByText("Nie udało się wczytać listy klientów i miesięcy. Wpisz wartości ręcznie."),
    ).toBeInTheDocument()

    await chooseOption(user, "Rodzaj transakcji", "WDT — faktury sprzedaży")
    await user.type(screen.getByLabelText("Klient"), "Jabil")
    await user.type(screen.getByLabelText("Miesiąc"), "Październik 2026")

    expect(screen.getByRole("button", { name: "Wybierz ZIP" })).toBeEnabled()
  })
})

async function openFilesystemUpload() {
  const user = userEvent.setup()
  render(<IntrastatUploadBatchButton />)
  await user.click(screen.getByRole("button", { name: "Wgraj ZIP" }))
  await user.click(screen.getByLabelText("Wgraj na dysk sieciowy"))
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
