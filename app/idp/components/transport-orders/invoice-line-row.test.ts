import type { InvoiceLine } from "@cortex/types"
import { describe, expect, it } from "vitest"
import { invoiceLineRowToRequest, invoiceLineToRow } from "./invoice-line-row"

function makeLine(overrides: Partial<InvoiceLine> = {}): InvoiceLine {
  return {
    id: "line-1",
    line_number: "1",
    po_number: null,
    product_code: "SKU-1",
    description: "Product",
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
    ...overrides,
  }
}

describe("invoice line row code mapping", () => {
  it("keeps CN and HS separate in default mode", () => {
    const row = invoiceLineToRow(makeLine())

    expect(row.cn_code).toBe("850440")
    expect(row.hs).toBe("8504")
  })

  it("uses CN as Customs Code and mirrors it into HS in customs-code mode", () => {
    const row = invoiceLineToRow(makeLine(), { useCustomsCode: true })
    row.cn_code = "9999999999"

    const request = invoiceLineRowToRequest("line-1", row, makeLine(), {
      useCustomsCode: true,
    })

    expect(row.cn_code).toBe("9999999999")
    expect(row.hs).toBe("850440")
    expect(request.cn_code).toBe("9999999999")
    expect(request.hs).toBe("9999999999")
  })

  it("falls back to HS when CN is empty in customs-code mode", () => {
    const row = invoiceLineToRow(makeLine({ cn_code: null, hs: "8536" }), {
      useCustomsCode: true,
    })

    expect(row.cn_code).toBe("8536")
    expect(row.hs).toBe("8536")
  })
})
