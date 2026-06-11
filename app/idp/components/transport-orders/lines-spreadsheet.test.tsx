// @vitest-environment jsdom
import { downloadBlob } from "@/lib/download"
import { queryKeys } from "@cortex/api"
import type { Invoice, UpdateInvoiceLinesRequest } from "@cortex/types"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LinesSpreadsheet } from "./lines-spreadsheet"

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
        po_number: null,
        product_code: "AX2486029",
        description: "Sample product",
        description_pl: "Produkt testowy",
        cn_code: "850440",
        hs: "8504",
        quantity: "1",
        unit_of_measure: "PCS",
        unit_price: null,
        invoice_value: "10",
        net_weight_kg: null,
        gross_weight_kg: null,
        estimated_gross_weight_kg: null,
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
              quantity: "1",
            },
          ],
        },
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

describe("LinesSpreadsheet", () => {
  beforeEach(() => {
    vi.mocked(downloadBlob).mockClear()
  })

  it("renders and saves one Customs Code field in customs-code mode", async () => {
    const onSave = vi.fn<(body: UpdateInvoiceLinesRequest) => Promise<void>>(async () => undefined)

    renderWithPreferences(
      <LinesSpreadsheet
        invoice={makeInvoice()}
        canEdit
        isSaving={false}
        onSave={onSave}
        useCustomsCode
      />,
    )

    expect(screen.getByRole("button", { name: /customs code/i })).not.toBeNull()
    expect(screen.getByRole("button", { name: /polish name/i })).not.toBeNull()
    expect(screen.queryByRole("button", { name: /^cn$/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /^hs$/i })).toBeNull()

    const customsInput = screen.getByDisplayValue("850440")
    await userEvent.clear(customsInput)
    await userEvent.type(customsInput, "9999999999")
    await userEvent.click(screen.getByRole("button", { name: /save lines/i }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })
    const savedBody = onSave.mock.calls[0]?.[0]
    if (!savedBody) throw new Error("Expected onSave to receive a payload")
    const savedLine = savedBody.lines[0]
    if (!savedLine) throw new Error("Expected onSave to receive one line")
    expect(savedLine).toMatchObject({
      description_pl: "Produkt testowy",
      cn_code: "9999999999",
      hs: "9999999999",
    })
  })

  it("hides configured columns from the editable spreadsheet", () => {
    renderWithPreferences(
      <LinesSpreadsheet
        invoice={makeInvoice()}
        canEdit
        isSaving={false}
        onSave={async () => undefined}
      />,
      ["product_code"],
    )

    expect(screen.queryByRole("button", { name: /product/i })).toBeNull()
    expect(screen.queryByDisplayValue("AX2486029")).toBeNull()
    expect(screen.getByRole("button", { name: /^qty/i })).not.toBeNull()
  })

  it("hides A.TR spreadsheet columns when A.TR processing is disabled", () => {
    renderWithPreferences(
      <LinesSpreadsheet
        invoice={makeInvoice()}
        canEdit
        isSaving={false}
        onSave={async () => undefined}
        showAtrProcessing={false}
      />,
    )

    expect(screen.queryByRole("button", { name: /^pref/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /^pref\. docs/i })).toBeNull()
    expect(screen.queryByDisplayValue("400")).toBeNull()
    expect(screen.queryByDisplayValue("N018 / ATR-123 / 1")).toBeNull()
  })

  it("downloads the current spreadsheet values as CSV", async () => {
    renderWithPreferences(
      <LinesSpreadsheet
        invoice={makeInvoice()}
        canEdit
        isSaving={false}
        onSave={async () => undefined}
      />,
    )

    const productInput = screen.getByDisplayValue("AX2486029")
    await userEvent.clear(productInput)
    await userEvent.type(productInput, "UPDATED-SKU")
    await userEvent.click(screen.getByRole("button", { name: /download csv/i }))

    expect(downloadBlob).toHaveBeenCalledTimes(1)
    const [blob, fileName] = vi.mocked(downloadBlob).mock.calls[0] ?? []
    expect(fileName).toBe("FV-1_invoice_lines.csv")
    const csv = await readBlobText(blob as Blob)
    expect(csv).toContain("UPDATED-SKU")
    expect(csv).toContain("N018 | ATR-123 | 1")
  })
})
