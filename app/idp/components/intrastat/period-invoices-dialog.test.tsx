/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { IntrastatDocument } from "@/lib/intrastat/types"
import { IntrastatPeriodInvoicesDialog } from "./period-invoices-dialog"

const documents: IntrastatDocument[] = [
  {
    id: "document-1",
    batch_id: "batch-1",
    file_name: "FV-1001.pdf",
    media_type: "application/pdf",
    size_bytes: 1024,
    preview_kind: "pdf",
    created_at: "2026-07-01T10:00:00Z",
  },
  {
    id: "document-2",
    batch_id: "batch-1",
    file_name: "FV-2002.pdf",
    media_type: "application/pdf",
    size_bytes: 2048,
    preview_kind: "pdf",
    created_at: "2026-07-01T10:00:00Z",
  },
]

describe("IntrastatPeriodInvoicesDialog", () => {
  beforeAll(() => {
    Object.defineProperties(Element.prototype, {
      hasPointerCapture: { configurable: true, value: () => false },
      releasePointerCapture: { configurable: true, value: () => undefined },
      setPointerCapture: { configurable: true, value: () => undefined },
    })
  })

  afterEach(() => cleanup())

  it("shows the invoice count and filters by file name", async () => {
    const user = userEvent.setup()
    render(
      <IntrastatPeriodInvoicesDialog
        periodLabel="Somfy / Lipiec 2026"
        invoiceCount={2}
        documents={documents}
        onInvoiceSelect={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Otwórz faktury dla Somfy / Lipiec 2026" }))

    expect(
      screen.getByText("Faktur w tym okresie: 2. Wybierz plik, żeby zobaczyć podgląd."),
    ).toBeInTheDocument()
    expect(screen.getByText("FV-1001.pdf")).toBeInTheDocument()
    expect(screen.getByText("FV-2002.pdf")).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText("Szukaj pliku faktury…"), "2002")

    expect(screen.queryByText("FV-1001.pdf")).not.toBeInTheDocument()
    expect(screen.getByText("FV-2002.pdf")).toBeInTheDocument()
  })

  it("opens the selected invoice preview and closes the popup", async () => {
    const user = userEvent.setup()
    const onInvoiceSelect = vi.fn()
    render(
      <IntrastatPeriodInvoicesDialog
        periodLabel="Somfy / Lipiec 2026"
        invoiceCount={2}
        documents={documents}
        onInvoiceSelect={onInvoiceSelect}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Otwórz faktury dla Somfy / Lipiec 2026" }))
    await user.click(screen.getByRole("button", { name: "FV-2002.pdf Podgląd" }))

    expect(onInvoiceSelect).toHaveBeenCalledWith("FV-2002.pdf")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
