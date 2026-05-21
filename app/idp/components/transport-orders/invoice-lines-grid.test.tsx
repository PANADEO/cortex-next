// @vitest-environment jsdom
import type { Invoice } from "@cortex/types"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { InvoiceLinesGrid } from "./invoice-lines-grid"

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
        description_pl: null,
        cn_code: "850440",
        hs: "8504",
        quantity: "1144",
        unit_of_measure: "PCS",
        unit_price: null,
        invoice_value: "3077.36",
        net_weight_kg: "92.51",
        gross_weight_kg: "113.51",
        packages_quantity: null,
        packages_type: null,
        packages_marking: null,
        origin_country: "CN",
        source_references: [],
        notes: [],
      },
    ],
  }
}

describe("InvoiceLinesGrid", () => {
  it("renders the full invoice-line preview column set", () => {
    render(
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
      "CN Code",
      "HS Code",
      "Qty",
      "UoM",
      "Value",
      "Net Wt (kg)",
      "Gross Wt (kg)",
      "Origin",
    ]) {
      expect(screen.getByRole("columnheader", { name })).not.toBeNull()
    }
  })
})
