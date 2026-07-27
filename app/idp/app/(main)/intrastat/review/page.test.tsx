// @vitest-environment jsdom
import type { IntrastatDeclarationLine } from "@/lib/intrastat/types"
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import IntrastatReviewPage from "./page"

const { authorizedApps, createLine, patchLine, routerPush, routerReplace, upsertCnResourceRow } =
  vi.hoisted(() => ({
    authorizedApps: { value: ["intrastat", "intrastat-cn-editor"] as string[] },
    createLine: vi.fn(),
    patchLine: vi.fn(),
    routerPush: vi.fn(),
    routerReplace: vi.fn(),
    upsertCnResourceRow: vi.fn(),
  }))

const batches = [
  {
    id: "batch-1",
    transaction_kind: "WNT" as const,
    source_type: "filesystem",
    name: "First batch",
    client_name: "Client A",
    period_month: "June 2026",
    status: "ready" as const,
    invoice_count: 1,
    line_count: 1,
    alert_count: 0,
    error_message: null,
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
    documents: [],
  },
  {
    id: "batch-2",
    transaction_kind: "WDT" as const,
    source_type: "filesystem",
    name: "Clicked batch",
    client_name: "Client B",
    period_month: "July 2026",
    status: "ready" as const,
    invoice_count: 1,
    line_count: 1,
    alert_count: 0,
    error_message: null,
    created_at: "2026-07-01T10:00:00Z",
    updated_at: "2026-07-01T10:00:00Z",
    documents: [],
  },
]

const line: IntrastatDeclarationLine = {
  id: "line-1",
  batch_id: "batch-1",
  invoice_id: "invoice-1",
  lp: 1,
  transaction_kind: "WNT",
  invoice_number: "FV/1",
  invoice_date: "2026-07-23",
  item_index: "ABC",
  matched_index: "ABC",
  matched_fragment: "ABC",
  cn_code: "85444290",
  description: "Cable",
  quantity: 1,
  value: 100,
  currency: "EUR",
  net_weight: 1,
  origin_country: "DE",
  delivery_terms: "EXW",
  vat_number: "DE123",
  transaction_code: "11",
  transport_type: "3",
  cn_match_status: "exact",
  confidence: 1,
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
  created_at: "2026-07-23T10:00:00Z",
  updated_at: "2026-07-23T10:00:00Z",
}

const excludedCorrectionLine: IntrastatDeclarationLine = {
  ...line,
  id: "line-excluded",
  invoice_id: "invoice-correction",
  lp: 2,
  invoice_number: "KOR/1",
  document_type: "correction",
  corrected_invoice_number: "FV/1",
  corrected_invoice_date: "2026-07-23",
  correction_reason: "Quantity correction",
  correction_side: "before",
  is_excluded: true,
  exclusion_reason: "correction-before-version",
  source_file: "correction.pdf",
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
  }),
}))

vi.mock("@cortex/api", () => ({
  useAuthorizedApps: () => ({
    apps: authorizedApps.value,
    isLoading: false,
  }),
}))

vi.mock("@/lib/intrastat/hooks", () => ({
  useIntrastatBatch: (id: string) => ({
    data: batches.find((batch) => batch.id === id),
  }),
  useIntrastatBatches: () => ({
    data: { items: batches, total: batches.length, limit: 100, offset: 0 },
    isFetching: false,
  }),
  useIntrastatLines: () => ({
    data: { items: [line, excludedCorrectionLine], total: 2, limit: 100, offset: 0 },
    isFetching: false,
    isPending: false,
  }),
  useIntrastatCnSuggestions: () => ({
    data: { items: [] },
    isFetching: false,
  }),
  useIntrastatCreateLine: () => ({
    isPending: false,
    mutateAsync: createLine,
  }),
  useIntrastatPatchLine: () => ({
    isPending: false,
    mutateAsync: patchLine,
  }),
  useIntrastatReprocessBatch: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useIntrastatUpsertCnResourceRow: () => ({
    isPending: false,
    mutateAsync: upsertCnResourceRow,
  }),
}))

vi.mock("@/components/intrastat/document-preview-panel", () => ({
  IntrastatDocumentPreviewPanel: ({ batchId }: { batchId: string }) => (
    <div data-testid="preview-batch-id">{batchId}</div>
  ),
}))

vi.mock("@/components/intrastat/export-buttons", () => ({
  IntrastatExportButtons: ({ batchId }: { batchId?: string }) => (
    <div data-testid="export-batch-id">{batchId ?? ""}</div>
  ),
}))

vi.mock("@/components/intrastat/delete-batch-button", () => ({
  IntrastatDeleteBatchButton: () => <button type="button">Delete batch</button>,
}))

vi.mock("@/components/intrastat/correction-info", () => ({
  IntrastatCorrectionInfo: ({ line: selectedLine }: { line: IntrastatDeclarationLine }) =>
    selectedLine.document_type === "correction" ? <span>Correction</span> : null,
}))

vi.mock("@/components/intrastat/line-details-dialog", () => ({
  IntrastatLineDetailsDialog: ({
    line: selectedLine,
    open,
  }: {
    line: IntrastatDeclarationLine | null
    open: boolean
  }) => (open && selectedLine ? <div>Details for {selectedLine.id}</div> : null),
}))

vi.mock("@/components/intrastat/match-details-popover", () => ({
  IntrastatMatchDetailsPopover: () => <span>Match</span>,
}))

vi.mock("@/components/intrastat/period-invoices-dialog", () => ({
  IntrastatPeriodInvoicesDialog: () => <button type="button">Invoices</button>,
}))

vi.mock("@/components/intrastat/status", () => ({
  IntrastatKindBadge: ({ kind }: { kind: string }) => <span>{kind}</span>,
  IntrastatStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
  getIntrastatMatchLabel: (value: string) => value,
}))

vi.mock("react-resizable-panels", () => ({
  Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PanelGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PanelResizeHandle: (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}))

vi.mock("@cortex/ui", () => ({
  Button: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { size?: string; variant?: string }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Checkbox: ({
    checked,
    onCheckedChange,
    ...props
  }: Omit<InputHTMLAttributes<HTMLInputElement>, "checked" | "onChange"> & {
    checked?: boolean | "indeterminate"
    onCheckedChange?: (checked: boolean) => void
  }) => (
    <input
      {...props}
      type="checkbox"
      checked={checked === true}
      aria-checked={checked === "indeterminate" ? "mixed" : checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
  DataTable: ({
    columns,
    data,
    tableClassName,
  }: {
    columns: Array<{
      accessorKey?: string
      id?: string
      cell?: (context: { row: { original: IntrastatDeclarationLine } }) => ReactNode
    }>
    data: IntrastatDeclarationLine[]
    tableClassName?: string
  }) => (
    <table
      data-testid="lines-table"
      data-columns={columns.map((column) => column.id ?? column.accessorKey).join(",")}
      data-table-class-name={tableClassName}
    >
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            {columns.map((column) => (
              <td key={column.id ?? column.accessorKey}>
                {column.cell?.({ row: { original: row } })}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  PageHeader: ({ actions, title }: { actions?: ReactNode; title: string }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
  Pagination: () => <nav>Pagination</nav>,
  Select: ({ children, value }: { children?: ReactNode; value?: string }) => (
    <div data-testid="select" data-value={value}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children?: ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

afterEach(() => {
  cleanup()
  routerPush.mockClear()
  routerReplace.mockClear()
})

beforeEach(() => {
  authorizedApps.value = ["intrastat", "intrastat-cn-editor"]
  patchLine.mockReset().mockResolvedValue(line)
  createLine.mockReset().mockResolvedValue({ ...line, id: "line-2", item_index: "NEW-100" })
  upsertCnResourceRow.mockReset().mockResolvedValue({})
})

describe("IntrastatReviewPage batch selection", () => {
  it("keeps the batch id from the URL when the batch list is already loaded", async () => {
    window.history.pushState({}, "", "/intrastat/review?batch=batch-2")

    render(<IntrastatReviewPage />)

    await waitFor(() => {
      expect(screen.getByTestId("export-batch-id")).toHaveTextContent("batch-2")
    })
  })

  it("falls back to the first batch only when the URL does not specify a batch", async () => {
    window.history.pushState({}, "", "/intrastat/review")

    render(<IntrastatReviewPage />)

    await waitFor(() => {
      expect(screen.getByTestId("export-batch-id")).toHaveTextContent("batch-1")
    })
  })
})

describe("IntrastatReviewPage line actions", () => {
  it("keeps the actions column first and sticky on the left", () => {
    window.history.pushState({}, "", "/intrastat/review?batch=batch-1")
    render(<IntrastatReviewPage />)

    const table = screen.getByTestId("lines-table")

    expect(table.getAttribute("data-columns")?.split(",")[0]).toBe("actions")
    expect(table.getAttribute("data-table-class-name")).toContain("[&_th:first-child]:sticky")
    expect(table.getAttribute("data-table-class-name")).toContain("[&_td:first-child]:sticky")
  })

  it("edits and saves an existing line directly in the table", async () => {
    const user = userEvent.setup()
    window.history.pushState({}, "", "/intrastat/review?batch=batch-1")
    render(<IntrastatReviewPage />)

    await user.click(screen.getByRole("button", { name: "Edit line line-1" }))
    const description = screen.getByRole("textbox", { name: "Description line-1" })
    await user.clear(description)
    await user.type(description, "Updated cable")
    await user.click(screen.getByRole("button", { name: "Save line line-1" }))

    await waitFor(() =>
      expect(patchLine).toHaveBeenCalledWith({
        lineId: "line-1",
        payload: expect.objectContaining({ description: "Updated cable" }),
      }),
    )
  })

  it("adds a draft line to the reference invoice", async () => {
    const user = userEvent.setup()
    window.history.pushState({}, "", "/intrastat/review?batch=batch-1")
    render(<IntrastatReviewPage />)

    await user.click(screen.getByRole("button", { name: "Add line after line-1" }))
    await user.type(screen.getByRole("textbox", { name: "Item index draft:line-1" }), "NEW-100")
    await user.type(screen.getByRole("textbox", { name: "CN code draft:line-1" }), "85044095")
    await user.click(screen.getByRole("button", { name: "Save line draft:line-1" }))

    await waitFor(() =>
      expect(createLine).toHaveBeenCalledWith(
        expect.objectContaining({
          reference_line_id: "line-1",
          item_index: "NEW-100",
          cn_code: "85044095",
          currency: "EUR",
          delivery_terms: "EXW",
          vat_number: "DE123",
        }),
      ),
    )
  })

  it("opens the read-only line details", async () => {
    const user = userEvent.setup()
    window.history.pushState({}, "", "/intrastat/review?batch=batch-1")
    render(<IntrastatReviewPage />)

    await user.click(screen.getByRole("button", { name: "View line line-1" }))

    expect(screen.getByText("Details for line-1")).toBeInTheDocument()
  })

  it("excludes a selected line from the XLSX export without removing it from review", async () => {
    const user = userEvent.setup()
    window.history.pushState({}, "", "/intrastat/review?batch=batch-1")
    render(<IntrastatReviewPage />)

    await user.click(screen.getByRole("checkbox", { name: "Select line line-1" }))
    await user.click(screen.getByRole("button", { name: "Exclude from XLSX (1)" }))

    await waitFor(() =>
      expect(patchLine).toHaveBeenCalledWith({
        lineId: "line-1",
        payload: {
          is_excluded: true,
          exclusion_reason: "manual-exclusion",
        },
      }),
    )
    expect(screen.getByText("FV/1")).toBeInTheDocument()
  })

  it("restores an excluded correction line to the XLSX export", async () => {
    const user = userEvent.setup()
    window.history.pushState({}, "", "/intrastat/review?batch=batch-1")
    render(<IntrastatReviewPage />)

    expect(screen.getByText("Excluded from XLSX")).toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: "Select line line-excluded" }))
    await user.click(screen.getByRole("button", { name: "Restore to XLSX (1)" }))

    await waitFor(() =>
      expect(patchLine).toHaveBeenCalledWith({
        lineId: "line-excluded",
        payload: {
          is_excluded: false,
          exclusion_reason: null,
        },
      }),
    )
    expect(screen.getByText("KOR/1")).toBeInTheDocument()
  })

  it("saves an edited mapping to the CN database for an authorized user", async () => {
    const user = userEvent.setup()
    window.history.pushState({}, "", "/intrastat/review?batch=batch-1")
    render(<IntrastatReviewPage />)

    await user.click(screen.getByRole("button", { name: "Edit line line-1" }))
    await user.click(
      screen.getByRole("button", {
        name: "Save line line-1 and add to CN database",
      }),
    )

    await waitFor(() =>
      expect(upsertCnResourceRow).toHaveBeenCalledWith({
        payload: {
          index_value: "ABC",
          cn8: "85444290",
          cn: "85444290",
          description: "Cable",
        },
      }),
    )
  })

  it("requires confirmation before replacing a conflicting CN mapping", async () => {
    const user = userEvent.setup()
    const conflict = Object.assign(new Error("conflict"), {
      detail: "cn-resource-index-conflict",
    })
    upsertCnResourceRow.mockRejectedValueOnce(conflict).mockResolvedValueOnce({})
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
    window.history.pushState({}, "", "/intrastat/review?batch=batch-1")
    render(<IntrastatReviewPage />)

    await user.click(screen.getByRole("button", { name: "Edit line line-1" }))
    await user.click(
      screen.getByRole("button", {
        name: "Save line line-1 and add to CN database",
      }),
    )

    await waitFor(() => expect(upsertCnResourceRow).toHaveBeenCalledTimes(2))
    expect(confirm).toHaveBeenCalledWith(
      "Index ABC already has a different CN code. Replace it with 85444290?",
    )
    expect(upsertCnResourceRow).toHaveBeenLastCalledWith({
      payload: {
        index_value: "ABC",
        cn8: "85444290",
        cn: "85444290",
        description: "Cable",
      },
      replaceConflict: true,
    })
  })

  it("hides the CN database action without editor permission", async () => {
    authorizedApps.value = ["intrastat"]
    const user = userEvent.setup()
    window.history.pushState({}, "", "/intrastat/review?batch=batch-1")
    render(<IntrastatReviewPage />)

    await user.click(screen.getByRole("button", { name: "Edit line line-1" }))

    expect(
      screen.queryByRole("button", {
        name: "Save line line-1 and add to CN database",
      }),
    ).not.toBeInTheDocument()
  })
})
