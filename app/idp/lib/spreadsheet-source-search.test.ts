import type { InvoiceLine } from "@cortex/types"
import { describe, expect, it } from "vitest"
import { buildInvoiceLineSpreadsheetSearchTerms } from "./spreadsheet-source-search"

function makeLine(): InvoiceLine {
  return {
    id: "line-1",
    line_number: "1",
    po_number: "PO-123",
    product_code: "BX2486029",
    description: "Second sample product",
    description_pl: null,
    cn_code: "850441",
    hs: "8504",
    quantity: "2,50",
    unit_of_measure: "PCS",
    unit_price: null,
    invoice_value: "20.25",
    net_weight_kg: "4",
    gross_weight_kg: "5.5",
    estimated_gross_weight_kg: null,
    packages_quantity: "2",
    packages_type: "CT",
    packages_marking: null,
    origin_country: "CN",
    source_references: [],
    notes: [],
    sad_override: null,
  }
}

describe("buildInvoiceLineSpreadsheetSearchTerms", () => {
  it("builds weighted terms from invoice line fields", () => {
    const terms = buildInvoiceLineSpreadsheetSearchTerms(makeLine())

    expect(terms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "product_code",
          value: "bx2486029",
          weight: 6,
          allowSubstring: true,
        }),
        expect.objectContaining({
          key: "quantity",
          value: "2,50",
          numericValue: "2.5",
          weight: 2,
        }),
      ]),
    )
  })
})
