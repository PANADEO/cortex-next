// @vitest-environment jsdom
import { downloadBlob } from "@/lib/download"
import { useSourceMaterialSelectionStore } from "@/lib/stores/source-material-selection"
import { queryKeys } from "@cortex/api"
import type { Invoice, InvoiceLineSourceReference, UpdateInvoiceLinesRequest } from "@cortex/types"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
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
  const invoicePdfRef: InvoiceLineSourceReference = {
    path: "invoice.pdf",
    relation_type: "invoice",
    page_number: 2,
    highlight_boxes: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
    label: "Invoice PDF",
  }
  const packingListRef: InvoiceLineSourceReference = {
    path: "packing-list.xlsx",
    relation_type: "packing_list",
    page_number: null,
    highlight_boxes: [],
    label: "Packing list",
  }

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
        net_weight_kg: "2",
        gross_weight_kg: "3",
        estimated_gross_weight_kg: "3.5",
        packages_quantity: "1",
        packages_type: null,
        packages_marking: null,
        origin_country: "CN",
        source_references: [invoicePdfRef],
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
      {
        id: "line-2",
        line_number: "2",
        po_number: null,
        product_code: "BX2486029",
        description: "Second sample product",
        description_pl: "Drugi produkt testowy",
        cn_code: "850441",
        hs: "8504",
        quantity: "2.5",
        unit_of_measure: "PCS",
        unit_price: null,
        invoice_value: "20.25",
        net_weight_kg: "4",
        gross_weight_kg: "5.5",
        estimated_gross_weight_kg: "6",
        packages_quantity: "2",
        packages_type: null,
        packages_marking: null,
        origin_country: "CN",
        source_references: [packingListRef],
        notes: [],
        sad_override: null,
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
    useSourceMaterialSelectionStore.getState().clear()
  })

  it("shows business column totals without summing line numbers", () => {
    renderWithPreferences(
      <LinesSpreadsheet
        invoice={makeInvoice()}
        canEdit
        isSaving={false}
        onSave={async () => undefined}
      />,
    )

    const totalRow = screen.getByText("Total").closest("tr")
    if (!totalRow) throw new Error("Expected total row")
    const totalCells = within(totalRow).getAllByRole("cell")
    expect(totalCells[0]?.textContent).toBe("Total")
    expect(within(totalRow).getByText("3.5")).not.toBeNull()
    expect(within(totalRow).getByText("30.25")).not.toBeNull()
    expect(within(totalRow).getByText("6")).not.toBeNull()
    expect(within(totalRow).getByText("8.5")).not.toBeNull()
    expect(within(totalRow).getByText("9.5")).not.toBeNull()
    expect(within(totalRow).getByText("3")).not.toBeNull()
  })

  it("hides totals for hidden business columns", () => {
    renderWithPreferences(
      <LinesSpreadsheet
        invoice={makeInvoice()}
        canEdit
        isSaving={false}
        onSave={async () => undefined}
      />,
      ["invoice_value"],
    )

    const totalRow = screen.getByText("Total").closest("tr")
    if (!totalRow) throw new Error("Expected total row")
    expect(within(totalRow).queryByText("30.25")).toBeNull()
    expect(within(totalRow).getByText("3.5")).not.toBeNull()
  })

  it("hides totals for empty business columns", () => {
    const invoice = makeInvoice()
    invoice.lines = invoice.lines.map((line) => ({
      ...line,
      estimated_gross_weight_kg: null,
    }))

    renderWithPreferences(
      <LinesSpreadsheet
        invoice={invoice}
        canEdit
        isSaving={false}
        onSave={async () => undefined}
      />,
    )

    const totalRow = screen.getByText("Total").closest("tr")
    if (!totalRow) throw new Error("Expected total row")
    expect(within(totalRow).queryByText("0")).toBeNull()
    expect(within(totalRow).getByText("30.25")).not.toBeNull()
  })

  it("shows zero totals for columns with numeric zero values", () => {
    const invoice = makeInvoice()
    invoice.lines = invoice.lines.map((line) => ({
      ...line,
      estimated_gross_weight_kg: "0",
    }))

    renderWithPreferences(
      <LinesSpreadsheet
        invoice={invoice}
        canEdit
        isSaving={false}
        onSave={async () => undefined}
      />,
      ["quantity", "invoice_value", "net_weight_kg", "gross_weight_kg", "packages_quantity"],
    )

    const totalRow = screen.getByText("Total").closest("tr")
    if (!totalRow) throw new Error("Expected total row")
    expect(within(totalRow).getByText("0")).not.toBeNull()
  })

  it("updates totals from unsaved spreadsheet edits", async () => {
    renderWithPreferences(
      <LinesSpreadsheet
        invoice={makeInvoice()}
        canEdit
        isSaving={false}
        onSave={async () => undefined}
      />,
    )

    const valueInput = screen.getByDisplayValue("10")
    await userEvent.clear(valueInput)
    await userEvent.type(valueInput, "40.25")

    const totalRow = screen.getByText("Total").closest("tr")
    if (!totalRow) throw new Error("Expected total row")
    expect(within(totalRow).getByText("60.5")).not.toBeNull()
    expect(within(totalRow).queryByText("30.25")).toBeNull()
  })

  it("selects source references when a row is clicked or focused", async () => {
    renderWithPreferences(
      <LinesSpreadsheet
        invoice={makeInvoice()}
        canEdit={false}
        isSaving={false}
        onSave={async () => undefined}
      />,
    )

    await userEvent.click(screen.getByDisplayValue("Second sample product"))

    expect(useSourceMaterialSelectionStore.getState()).toMatchObject({
      activePath: "packing-list.xlsx",
      activePage: null,
      highlightBoxes: [],
      selectionLabel: "Packing list",
    })
    expect(useSourceMaterialSelectionStore.getState().spreadsheetSearchTerms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "product_code",
          value: "bx2486029",
        }),
      ]),
    )

    await userEvent.click(screen.getByDisplayValue("AX2486029"))

    expect(useSourceMaterialSelectionStore.getState()).toMatchObject({
      activePath: "invoice.pdf",
      activePage: 2,
      highlightBoxes: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
      selectionLabel: "Invoice PDF",
    })
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

  it("hides Polish name from the editable spreadsheet", () => {
    renderWithPreferences(
      <LinesSpreadsheet
        invoice={makeInvoice()}
        canEdit
        isSaving={false}
        onSave={async () => undefined}
      />,
      ["description_pl"],
    )

    expect(screen.queryByRole("button", { name: /polish name/i })).toBeNull()
    expect(screen.queryByDisplayValue("Produkt testowy")).toBeNull()
    expect(screen.getByRole("button", { name: /description/i })).not.toBeNull()
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

  it("excludes hidden Polish name from the spreadsheet CSV", async () => {
    renderWithPreferences(
      <LinesSpreadsheet
        invoice={makeInvoice()}
        canEdit
        isSaving={false}
        onSave={async () => undefined}
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
