/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { IntrastatDeclarationLine } from "@/lib/intrastat/types"
import { IntrastatLineDetailsDialog } from "./line-details-dialog"

const line: IntrastatDeclarationLine = {
  id: "line-1",
  batch_id: "batch-1",
  invoice_id: "invoice-1",
  lp: 1,
  transaction_kind: "WDT",
  invoice_number: "FV/1",
  invoice_date: "2026-07-23",
  item_index: "NEW-100",
  matched_index: "NEW-100",
  matched_fragment: "NEW",
  cn_code: "85044095",
  description: "Power supply",
  quantity: 2,
  value: 250,
  currency: "EUR",
  net_weight: 3,
  origin_country: "PL",
  delivery_terms: "DAP",
  vat_number: "PL123",
  transaction_code: "11",
  transport_type: "3",
  cn_match_status: "manual",
  confidence: 1,
  match_confidence: 1,
  alerts: ["Check net weight."],
  document_type: "correction",
  corrected_invoice_number: "FV/0",
  corrected_invoice_date: "2026-07-01",
  correction_reason: "Quantity correction",
  correction_side: "after",
  is_excluded: false,
  exclusion_reason: null,
  source_file: "invoice.pdf",
  created_at: "2026-07-23T10:00:00Z",
  updated_at: "2026-07-23T10:00:00Z",
}

afterEach(cleanup)

describe("IntrastatLineDetailsDialog", () => {
  it("shows declaration, matching, correction, and alert details", () => {
    render(<IntrastatLineDetailsDialog line={line} open onOpenChange={vi.fn()} />)

    expect(
      screen.getByRole("heading", { name: "Szczegóły pozycji deklaracji" }),
    ).toBeInTheDocument()
    expect(screen.getAllByText("NEW-100")).toHaveLength(2)
    expect(screen.getByText("Power supply")).toBeInTheDocument()
    expect(screen.getByText("FV/0")).toBeInTheDocument()
    expect(screen.getByText("Check net weight.")).toBeInTheDocument()
  })
})
