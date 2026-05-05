import type { Invoice } from "@cortex/types"
import { describe, expect, it } from "vitest"
import { buildNotifications, summarize } from "./ai-notifications-panel"

function invoice(overrides: Partial<Invoice> & Pick<Invoice, "id">): Invoice {
  return {
    invoice_number: null,
    invoice_date: null,
    invoice_currency: null,
    country_of_dispatch: null,
    country_of_destination: null,
    delivery_terms: null,
    lines: [],
    invoice_totals: null,
    warnings: [],
    notes: [],
    ...overrides,
  }
}

describe("buildNotifications", () => {
  it("returns an empty list when invoices have no warnings or notes", () => {
    const result = buildNotifications([invoice({ id: "inv-1" })])
    expect(result).toEqual([])
  })

  it("maps warnings to severity warning and notes to severity info for a single invoice without source field", () => {
    const result = buildNotifications([
      invoice({
        id: "inv-1",
        invoice_number: "INV-0001",
        warnings: ["Net weight exceeds gross weight on line 2"],
        notes: ["Currency inferred from line items"],
      }),
    ])

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: "inv-1-w-0",
      severity: "warning",
      title: "Net weight exceeds gross weight on line 2",
    })
    expect(result[1]).toEqual({
      id: "inv-1-n-0",
      severity: "info",
      title: "Currency inferred from line items",
    })
  })

  it("adds Invoice <number> source field for multi-invoice packages and falls back to id when invoice_number is null", () => {
    const result = buildNotifications([
      invoice({
        id: "inv-1",
        invoice_number: "INV-0001",
        warnings: ["Totals do not reconcile"],
      }),
      invoice({
        id: "inv-2-uuid",
        invoice_number: null,
        notes: ["Incoterm defaulted to DAP"],
      }),
    ])

    expect(result).toHaveLength(2)
    expect(result[0]?.sourceField).toBe("Invoice INV-0001")
    expect(result[1]?.sourceField).toBe("Invoice inv-2-uuid")
  })
})

describe("summarize", () => {
  it("returns 0/0 for an empty list", () => {
    expect(summarize([])).toEqual({ warning: 0, info: 0 })
  })

  it("counts warnings and infos separately across multiple items", () => {
    const items = buildNotifications([
      invoice({
        id: "inv-1",
        warnings: ["a", "b", "c"],
        notes: ["x", "y"],
      }),
    ])
    expect(summarize(items)).toEqual({ warning: 3, info: 2 })
  })

  it("aggregates across multiple invoices", () => {
    const items = buildNotifications([
      invoice({ id: "inv-1", warnings: ["a"], notes: ["x"] }),
      invoice({ id: "inv-2", warnings: ["b", "c"], notes: ["y"] }),
    ])
    expect(summarize(items)).toEqual({ warning: 3, info: 2 })
  })
})
