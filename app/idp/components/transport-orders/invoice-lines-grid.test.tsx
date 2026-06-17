// @vitest-environment jsdom
import { downloadBlob } from "@/lib/download"
import { queryKeys } from "@cortex/api"
import type { Invoice } from "@cortex/types"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { InvoiceLinesGrid } from "./invoice-lines-grid"

vi.mock("@/lib/download", () => ({
  downloadBlob: vi.fn(),
}))

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function renderWithPreferences(ui: ReactNode, hiddenColumns: string[] | null = null) {
  const client = freshClient()
  client.setQueryData(queryKeys.userPreferences(), {
    document_panel_ratio: null,
    theme_mode: null,
    invoice_line_hidden_columns: hiddenColumns,
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function makeInvoice(): Invoice {
  return {
    id: "invoice-1",
    invoice_number: "FV-1",
    invoice_date: "2026-05-21",
    invoice_currency: "EUR",
    country_of_dispatch: "CN",
    country_of_destination: "PL",
    delivery_terms: null,
    invoice_totals: null,
    warnings: [],
    notes: [],
    lines: [
      {
        id: "line-1",
        line_number: "1",
        po_number: "1302773684",
        product_code: "AX2486029",
        description: "Sample product",
        description_pl: "Produkt testowy",
        cn_code: "850440",
        hs: "8504",
        quantity: "1144",
        unit_of_measure: "PCS",
        unit_price: null,
        invoice_value: "3077.36",
        net_weight_kg: "92.51",
        gross_weight_kg: "113.51",
        estimated_gross_weight_kg: "115.25",
        packages_quantity: null,
        packages_type: null,
        packages_marking: null,
        origin_country: "CN",
        source_references: [],
        notes: [],
        sad_override: {
          preference_code: "400",
          atr_documents: [
            {
              product_code: "AX2486029",
              document_code: "N018",
              document_number: "ATR-123",
              quantity: "1144",
            },
          ],
        },
      },
    ],
  }
}

function makeInvoiceWithHsFallback(): Invoice {
  const invoice = makeInvoice()
  return {
    ...invoice,
    lines: [
      {
        ...invoice.lines[0]!,
        cn_code: null,
        hs: "8536",
      },
    ],
  }
}

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

describe("InvoiceLinesGrid", () => {
  beforeEach(() => {
    vi.mocked(downloadBlob).mockClear()
  })

  it("renders the full invoice-line preview column set", () => {
    renderWithPreferences(
      <InvoiceLinesGrid
        invoice={makeInvoice()}
        canEdit={false}
        isSaving={false}
        onSaveLines={async () => undefined}
      />,
    )

    expect(screen.getByRole("heading", { name: "Invoice Lines" })).not.toBeNull()
    for (const name of [
      "#",
      "PO Number",
      "Product Code",
      "Description",
      "Polish Name",
      "CN Code",
      "HS Code",
      "Pref.",
      "Pref. Docs",
      "Qty",
      "UoM",
      "Value",
      "Net Wt (kg)",
      "Gross Wt (kg)",
      "Est. Gross Wt (kg)",
      "Origin",
    ]) {
      expect(screen.getByRole("columnheader", { name })).not.toBeNull()
    }
    expect(screen.getByText("400")).not.toBeNull()
    expect(screen.getByText("Produkt testowy")).not.toBeNull()
    expect(screen.getByText("115.25")).not.toBeNull()
    expect(screen.getByText("N018 / ATR-123 / 1144")).not.toBeNull()
  })

  it("renders one Customs Code column when customs-code mode is enabled", () => {
    renderWithPreferences(
      <InvoiceLinesGrid
        invoice={makeInvoiceWithHsFallback()}
        canEdit={false}
        isSaving={false}
        onSaveLines={async () => undefined}
        useCustomsCode
      />,
    )

    expect(screen.getByRole("columnheader", { name: "Customs Code" })).not.toBeNull()
    expect(screen.queryByRole("columnheader", { name: "CN Code" })).toBeNull()
    expect(screen.queryByRole("columnheader", { name: "HS Code" })).toBeNull()
    expect(screen.getByText("8536")).not.toBeNull()
  })

  it("hides configured data columns without hiding the edit action", () => {
    renderWithPreferences(
      <InvoiceLinesGrid
        invoice={makeInvoice()}
        canEdit
        isSaving={false}
        onSaveLines={async () => undefined}
      />,
      ["description"],
    )

    expect(screen.queryByRole("columnheader", { name: "Description" })).toBeNull()
    expect(screen.queryByText("Sample product")).toBeNull()
    expect(screen.getByRole("button", { name: "Edit line" })).not.toBeNull()
  })

  it("hides Polish name without hiding the edit action", () => {
    renderWithPreferences(
      <InvoiceLinesGrid
        invoice={makeInvoice()}
        canEdit
        isSaving={false}
        onSaveLines={async () => undefined}
      />,
      ["description_pl"],
    )

    expect(screen.queryByRole("columnheader", { name: "Polish Name" })).toBeNull()
    expect(screen.queryByText("Produkt testowy")).toBeNull()
    expect(screen.getByRole("columnheader", { name: "Description" })).not.toBeNull()
    expect(screen.getByRole("button", { name: "Edit line" })).not.toBeNull()
  })

  it("hides A.TR columns when A.TR processing is disabled", () => {
    renderWithPreferences(
      <InvoiceLinesGrid
        invoice={makeInvoice()}
        canEdit={false}
        isSaving={false}
        onSaveLines={async () => undefined}
        showAtrProcessing={false}
      />,
    )

    expect(screen.queryByRole("columnheader", { name: "Pref." })).toBeNull()
    expect(screen.queryByRole("columnheader", { name: "Pref. Docs" })).toBeNull()
    expect(screen.queryByText("400")).toBeNull()
    expect(screen.queryByText("N018 / ATR-123 / 1144")).toBeNull()
  })

  it("downloads visible invoice-line columns as CSV", async () => {
    renderWithPreferences(
      <InvoiceLinesGrid
        invoice={makeInvoice()}
        canEdit={false}
        isSaving={false}
        onSaveLines={async () => undefined}
      />,
      ["description"],
    )

    await userEvent.click(screen.getByRole("button", { name: /download csv/i }))

    expect(downloadBlob).toHaveBeenCalledTimes(1)
    const [blob, fileName] = vi.mocked(downloadBlob).mock.calls[0] ?? []
    expect(fileName).toBe("FV-1_invoice_lines.csv")
    const csv = await readBlobText(blob as Blob)
    expect(csv).toContain("PO Number")
    expect(csv).not.toContain("Description")
    expect(csv).toContain("N018 / ATR-123 / 1144")
  })

  it("excludes hidden Polish name from the grid CSV", async () => {
    renderWithPreferences(
      <InvoiceLinesGrid
        invoice={makeInvoice()}
        canEdit={false}
        isSaving={false}
        onSaveLines={async () => undefined}
      />,
      ["description_pl"],
    )

    await userEvent.click(screen.getByRole("button", { name: /download csv/i }))

    expect(downloadBlob).toHaveBeenCalledTimes(1)
    const [blob] = vi.mocked(downloadBlob).mock.calls[0] ?? []
    const csv = await readBlobText(blob as Blob)
    expect(csv).not.toContain("Polish Name")
    expect(csv).not.toContain("Produkt testowy")
    expect(csv).toContain("Sample product")
  })
})
