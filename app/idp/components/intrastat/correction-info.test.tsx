// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { IntrastatCorrectionInfo } from "@/components/intrastat/correction-info"
import type { IntrastatDeclarationLine } from "@/lib/intrastat/types"

const correctionLine: IntrastatDeclarationLine = {
  id: "line-1",
  batch_id: "batch-1",
  invoice_id: "invoice-1",
  lp: 1,
  transaction_kind: "WNT",
  invoice_number: "K1",
  invoice_date: "2026-01-07",
  item_index: "VA10753M",
  matched_index: "VA10012A",
  matched_fragment: "VA10",
  cn_code: "85129090",
  description: "Correction item",
  quantity: 80,
  value: 492.73,
  currency: "EUR",
  net_weight: 3,
  origin_country: "PL",
  delivery_terms: "FCA",
  vat_number: "PL7791939992",
  transaction_code: "11",
  transport_type: "3",
  cn_match_status: "prefix_unique",
  confidence: 0.75,
  match_confidence: 0.75,
  alerts: [],
  document_type: "correction",
  corrected_invoice_number: "FV-ORIG",
  corrected_invoice_date: "2025-12-03",
  correction_reason: "Quality claim",
  correction_side: "before",
  is_excluded: true,
  exclusion_reason: "correction-before-version",
  source_file: "K1.pdf",
  created_at: "2026-01-07T10:00:00Z",
  updated_at: "2026-01-07T10:00:00Z",
}

describe("IntrastatCorrectionInfo", () => {
  it("shows the correction relationship and historical state", () => {
    render(<IntrastatCorrectionInfo line={correctionLine} />)

    expect(screen.getByText("Correction")).toBeInTheDocument()
    expect(screen.getByText("Before correction")).toBeInTheDocument()
    expect(screen.getByText("Historical / excluded")).toBeInTheDocument()
    expect(screen.getByText("FV-ORIG")).toBeInTheDocument()
    expect(screen.getByText("Reason: Quality claim")).toBeInTheDocument()
    expect(screen.getByText(/2025-12-03/)).toBeInTheDocument()
  })

  it("does not add correction details to regular invoices", () => {
    const { container } = render(
      <IntrastatCorrectionInfo
        line={{
          ...correctionLine,
          document_type: "invoice",
          corrected_invoice_number: null,
          corrected_invoice_date: null,
          correction_reason: null,
          correction_side: null,
          is_excluded: false,
          exclusion_reason: null,
        }}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
