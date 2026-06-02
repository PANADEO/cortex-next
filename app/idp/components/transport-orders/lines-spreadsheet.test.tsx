// @vitest-environment jsdom
import type { Invoice, UpdateInvoiceLinesRequest } from "@cortex/types"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { LinesSpreadsheet } from "./lines-spreadsheet"

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
        description_pl: null,
        cn_code: "850440",
        hs: "8504",
        quantity: "1",
        unit_of_measure: "PCS",
        unit_price: null,
        invoice_value: "10",
        net_weight_kg: null,
        gross_weight_kg: null,
        packages_quantity: null,
        packages_type: null,
        packages_marking: null,
        origin_country: "CN",
        source_references: [],
        notes: [],
        sad_override: null,
      },
    ],
  }
}

describe("LinesSpreadsheet", () => {
  it("renders and saves one Customs Code field in customs-code mode", async () => {
    const onSave = vi.fn<(body: UpdateInvoiceLinesRequest) => Promise<void>>(async () => undefined)

    render(
      <LinesSpreadsheet
        invoice={makeInvoice()}
        canEdit
        isSaving={false}
        onSave={onSave}
        useCustomsCode
      />,
    )

    expect(screen.getByRole("button", { name: /customs code/i })).not.toBeNull()
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
      cn_code: "9999999999",
      hs: "9999999999",
    })
  })
})
