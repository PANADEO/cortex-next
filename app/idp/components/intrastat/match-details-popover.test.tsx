// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { IntrastatMatchDetailsPopover } from "@/components/intrastat/match-details-popover"
import type { IntrastatDeclarationLine } from "@/lib/intrastat/types"

const baseLine: IntrastatDeclarationLine = {
  id: "line-1",
  batch_id: "batch-1",
  invoice_id: "invoice-1",
  lp: 1,
  transaction_kind: "WDT",
  invoice_number: "FV/1/2026",
  invoice_date: "2026-07-03",
  item_index: "VA10363N",
  matched_index: "VA10363N",
  matched_fragment: "VA10363N",
  cn_code: "85322200",
  description: "Capacitor 10uF",
  quantity: 10,
  value: 25,
  currency: "EUR",
  net_weight: 1.2,
  origin_country: "PL",
  delivery_terms: "EXW",
  vat_number: "PL1234567890",
  transaction_code: "11",
  transport_type: "3",
  cn_match_status: "exact",
  confidence: 0.9,
  match_confidence: 1,
  alerts: [],
  document_type: "invoice",
  corrected_invoice_number: null,
  corrected_invoice_date: null,
  correction_reason: null,
  correction_side: null,
  is_excluded: false,
  exclusion_reason: null,
  source_file: "invoice.pdf",
  created_at: "2026-07-03T10:00:00Z",
  updated_at: "2026-07-03T10:00:00Z",
}

describe("IntrastatMatchDetailsPopover", () => {
  it("explains exact index matches", async () => {
    render(<IntrastatMatchDetailsPopover line={baseLine} />)

    expect(screen.getByText("Exact 100%")).not.toBeNull()
    await userEvent.click(screen.getByRole("button", { name: /show exact match details/i }))

    expect(screen.getByText("Exact match")).not.toBeNull()
    expect(screen.getByText(/CN is tied to the product index/i)).not.toBeNull()
    expect(screen.getByText("Invoice index")).not.toBeNull()
    expect(screen.getByText("Resource index")).not.toBeNull()
    expect(screen.getByText("CN match confidence")).not.toBeNull()
    expect(screen.getByText("Overall line confidence")).not.toBeNull()
    expect(screen.getByText("100%")).not.toBeNull()
    expect(screen.getByText("90%")).not.toBeNull()
    expect(screen.getByText(/uses the lower of document extraction confidence/i)).not.toBeNull()
  })

  it("explains semantic matches and their score fragment", async () => {
    render(
      <IntrastatMatchDetailsPopover
        line={{
          ...baseLine,
          cn_match_status: "semantic_match",
          matched_fragment: "semantic:0.87",
          confidence: 0.87,
          match_confidence: 0.87,
        }}
      />,
    )

    expect(screen.getByText("Semantic 87%")).not.toBeNull()
    await userEvent.click(screen.getByRole("button", { name: /show semantic match details/i }))

    expect(screen.getByText("Semantic match")).not.toBeNull()
    expect(screen.getByText(/description embeddings as a technical way/i)).not.toBeNull()
    expect(screen.getByText("semantic:0.87")).not.toBeNull()
  })

  it("shows the same limiting confidence for the match and overall line", async () => {
    render(
      <IntrastatMatchDetailsPopover
        line={{
          ...baseLine,
          cn_match_status: "prefix_unique",
          confidence: 0.7,
          match_confidence: 0.7,
        }}
      />,
    )

    expect(screen.getByText("Closest index 70%")).not.toBeNull()
    await userEvent.click(screen.getByRole("button", { name: /show closest index match details/i }))

    expect(screen.getAllByText("70%")).toHaveLength(2)
  })

  it("keeps missing fields separate from exact CN match confidence", async () => {
    render(
      <IntrastatMatchDetailsPopover
        line={{
          ...baseLine,
          alerts: [
            "delivery_terms not found.",
            "net_weight not found.",
            "origin_country not found.",
            "cn_code not found.",
          ],
        }}
      />,
    )

    expect(screen.getByText("Exact 100%")).not.toBeNull()
    await userEvent.click(screen.getByRole("button", { name: /show exact match details/i }))

    expect(screen.getByText("4 fields require review")).not.toBeNull()
    expect(screen.getByText("delivery_terms not found.")).not.toBeNull()
  })
})
