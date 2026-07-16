/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { IntrastatDeclarationLine } from "@/lib/intrastat/types"
import { IntrastatLineEditDialog } from "./line-edit-dialog"

const mocks = vi.hoisted(() => ({
  apps: ["intrastat", "intrastat-cn-editor"] as string[],
  patchLine: vi.fn(),
  upsertCnResourceRow: vi.fn(),
}))

vi.mock("@cortex/api", () => ({
  useAuthorizedApps: () => ({ apps: mocks.apps, isLoading: false }),
}))

vi.mock("@/lib/intrastat/hooks", () => ({
  useIntrastatCnSuggestions: () => ({ data: { items: [] }, isFetching: false }),
  useIntrastatPatchLine: () => ({ mutateAsync: mocks.patchLine, isPending: false }),
  useIntrastatUpsertCnResourceRow: () => ({
    mutateAsync: mocks.upsertCnResourceRow,
    isPending: false,
  }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const line: IntrastatDeclarationLine = {
  id: "line-1",
  batch_id: "batch-1",
  invoice_id: "invoice-1",
  lp: 1,
  transaction_kind: "WDT",
  invoice_number: "FV/1",
  invoice_date: "2026-07-14",
  item_index: "NEW-100",
  matched_index: null,
  matched_fragment: null,
  cn_code: null,
  description: "Power supplies",
  quantity: 1,
  value: 100,
  currency: "EUR",
  net_weight: 2,
  origin_country: "PL",
  delivery_terms: "DAP",
  vat_number: "PL123",
  transaction_code: "11",
  transport_type: "3",
  cn_match_status: "unmatched",
  confidence: 0.8,
  match_confidence: 0,
  alerts: [],
  document_type: "invoice",
  corrected_invoice_number: null,
  corrected_invoice_date: null,
  correction_reason: null,
  correction_side: null,
  is_excluded: false,
  exclusion_reason: null,
  source_file: "invoice.pdf",
  created_at: "2026-07-14T10:00:00Z",
  updated_at: "2026-07-14T10:00:00Z",
}

describe("IntrastatLineEditDialog", () => {
  beforeEach(() => {
    mocks.apps = ["intrastat", "intrastat-cn-editor"]
    mocks.patchLine.mockReset().mockResolvedValue(line)
    mocks.upsertCnResourceRow.mockReset().mockResolvedValue({})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("lets a CN editor save a manual correction to the CN database", async () => {
    const user = userEvent.setup()
    render(<IntrastatLineEditDialog batchId="batch-1" line={line} open onOpenChange={vi.fn()} />)

    await user.type(screen.getByLabelText("CN code"), "85044095")
    await user.click(screen.getByRole("button", { name: "Save and add to CN database" }))

    await waitFor(() => {
      expect(mocks.upsertCnResourceRow).toHaveBeenCalledWith({
        payload: {
          index_value: "NEW-100",
          cn8: "85044095",
          cn: "85044095",
          description: "Power supplies",
        },
      })
    })
  })

  it("lets a CN editor save only the declaration line", async () => {
    const user = userEvent.setup()
    render(<IntrastatLineEditDialog batchId="batch-1" line={line} open onOpenChange={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "Save line only" }))

    await waitFor(() => expect(mocks.patchLine).toHaveBeenCalledTimes(1))
    expect(mocks.upsertCnResourceRow).not.toHaveBeenCalled()
  })

  it("does not expose the CN database action without editor permission", () => {
    mocks.apps = ["intrastat"]

    render(<IntrastatLineEditDialog batchId="batch-1" line={line} open onOpenChange={vi.fn()} />)

    expect(
      screen.queryByRole("button", { name: "Save and add to CN database" }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save line" })).toBeInTheDocument()
  })

  it("requires confirmation before replacing a conflicting CN mapping", async () => {
    const user = userEvent.setup()
    const conflict = Object.assign(new Error("conflict"), {
      detail: "cn-resource-index-conflict",
    })
    mocks.upsertCnResourceRow.mockRejectedValueOnce(conflict).mockResolvedValueOnce({})
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
    render(<IntrastatLineEditDialog batchId="batch-1" line={line} open onOpenChange={vi.fn()} />)

    await user.type(screen.getByLabelText("CN code"), "85044095")
    await user.click(screen.getByRole("button", { name: "Save and add to CN database" }))

    await waitFor(() => expect(mocks.upsertCnResourceRow).toHaveBeenCalledTimes(2))
    expect(confirm).toHaveBeenCalledWith(
      "Index NEW-100 already has a different CN code. Replace it with 85044095?",
    )
    expect(mocks.upsertCnResourceRow).toHaveBeenLastCalledWith({
      payload: {
        index_value: "NEW-100",
        cn8: "85044095",
        cn: "85044095",
        description: "Power supplies",
      },
      replaceConflict: true,
    })
  })
})
