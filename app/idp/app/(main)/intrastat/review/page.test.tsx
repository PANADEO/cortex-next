// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import IntrastatReviewPage from "./page"

const { routerPush, routerReplace } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
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
    data: { items: [], total: 0, limit: 100, offset: 0 },
    isFetching: false,
    isPending: false,
  }),
  useIntrastatReprocessBatch: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
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

vi.mock("@/components/intrastat/line-edit-dialog", () => ({
  IntrastatLineEditDialog: () => null,
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
  DataTable: () => <div data-testid="lines-table" />,
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
