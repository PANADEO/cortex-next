// @vitest-environment jsdom
import { queryKeys } from "@cortex/api"
import type {
  PackageActionsResponse,
  PackageDetailsResponse,
  PackageTransitionsResponse,
  PackageTransportOrdersResponse,
} from "@cortex/types"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import "@testing-library/jest-dom/vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import PackageDetailPage from "./page"

const { exportMenuMock } = vi.hoisted(() => ({
  exportMenuMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "pkg-1" }),
}))

vi.mock("@/components/export-menu", () => ({
  ExportMenu: (props: { packageId: string; fileName: string }) => {
    exportMenuMock(props)
    return <button type="button">Export</button>
  },
}))

vi.mock("@/components/ai-notifications-panel", () => ({
  AiNotificationsPanel: () => <div>AI notifications panel</div>,
  useAiNotificationCounts: () => ({ warning: 0, info: 0, isLoaded: true }),
}))

vi.mock("@/components/ai-notifications-chip", () => ({
  AiNotificationsChip: () => null,
}))

vi.mock("@/components/ai-notifications-tab-trigger", () => ({
  AiNotificationsTabTrigger: () => <button type="button">AI Notifications</button>,
}))

vi.mock("@/components/rules/package-rules-panel", () => ({
  PackageRulesPanel: () => <div>Rules panel</div>,
}))

vi.mock("@/components/source-materials-panel", () => ({
  SourceMaterialsPanel: () => <div>Source materials panel</div>,
}))

vi.mock("@/components/transport-orders/transport-orders-panel", () => ({
  TransportOrdersPanel: () => <div>Transport panel</div>,
}))

vi.mock("@/components/package-metadata-editors", () => ({
  PackageMetadataEditors: () => <div>Metadata editors</div>,
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  exportMenuMock.mockClear()
})

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
}

function Wrapper({ children, client }: { children: ReactNode; client?: QueryClient }) {
  return <QueryClientProvider client={client ?? freshClient()}>{children}</QueryClientProvider>
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  })
}

function makePackageDetails(
  overrides: Partial<PackageDetailsResponse> = {},
): PackageDetailsResponse {
  return {
    id: "pkg-1",
    file_name: "import_20260512_112118.zip",
    package_name: null,
    file_hash: "HASH123",
    file_size_mb: 12.4,
    created_date: "2026-05-12T13:21:00Z",
    processing_state: "ready",
    verification_state: "not_started",
    assignee: null,
    uploaded_by: "akwiatek@example.com",
    custom_status: null,
    user_notes: null,
    last_additional_ai_context: null,
    analysis_result: { ok: true },
    verified_result: null,
    total_tokens: 2400,
    total_cost_usd: "0.0942",
    ...overrides,
  }
}

function makeFetchMock(overrides: Partial<PackageDetailsResponse> = {}) {
  const details: PackageDetailsResponse = makePackageDetails(overrides)
  const transitions: PackageTransitionsResponse = {
    transitions: ["start_verification", "reprocess"],
  }
  const actions: PackageActionsResponse = {
    package_id: "pkg-1",
    actions: [],
  }
  const transportOrders = {
    package_id: "pkg-1",
    transport_orders: [
      {
        id: "order-1",
        transport_order_number: "1070021484",
        country_of_dispatch: "CN",
        country_of_destination: "PL",
        mode: "SEA",
        invoices: [{ id: "invoice-1" }],
      },
    ],
    verified_transport_orders: null,
  } as PackageTransportOrdersResponse

  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString()
    const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0]
    const routes: Record<string, unknown> = {
      "/user/me": { email: "dev@example.com", has_access: true },
      "/packages/pkg-1": details,
      "/packages/pkg-1/actions": actions,
      "/packages/pkg-1/transitions": transitions,
      "/packages/pkg-1/transport-orders": transportOrders,
    }
    const body = routes[path ?? ""]
    if (body === undefined) return Promise.resolve(jsonResponse({}))
    return Promise.resolve(jsonResponse(body))
  })
}

describe("PackageDetailPage summary collapse", () => {
  it("passes package display name to export menu when present", async () => {
    vi.stubGlobal("fetch", makeFetchMock({ package_name: "May Customs Batch" }))

    render(
      <Wrapper>
        <PackageDetailPage />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(exportMenuMock).toHaveBeenCalledWith({
        packageId: "pkg-1",
        fileName: "May Customs Batch",
      })
    })
  })

  it("keeps statuses and actions visible while collapsing and expanding summary details", async () => {
    vi.stubGlobal("fetch", makeFetchMock())

    render(
      <Wrapper>
        <PackageDetailPage />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeInTheDocument()
      expect(screen.getByText("Not started")).toBeInTheDocument()
    })
    expect(screen.getByRole("link", { name: /open verification workspace/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /download zip/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /show structure/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /start verification/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /reprocess/i })).toBeInTheDocument()
    expect(screen.getByText("Actions")).toBeInTheDocument()
    expect(await screen.findByText("1070021484")).toBeInTheDocument()
    expect(screen.getByText("Uploaded")).toBeInTheDocument()
    expect(screen.getByText("HASH123")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Collapse package summary" }))

    expect(screen.getByText("Ready")).toBeInTheDocument()
    expect(screen.getByText("Not started")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /open verification workspace/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /download zip/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /show structure/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /start verification/i })).toBeInTheDocument()
    expect(screen.queryByText("Actions")).not.toBeInTheDocument()
    expect(screen.queryByText("1070021484")).not.toBeInTheDocument()
    expect(screen.queryByText("Uploaded")).not.toBeInTheDocument()
    expect(screen.queryByText("HASH123")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Expand package summary" }))

    expect(screen.getByText("1070021484")).toBeInTheDocument()
    expect(screen.getByText("Uploaded")).toBeInTheDocument()
    expect(screen.getByText("HASH123")).toBeInTheDocument()
    expect(screen.getByText("Actions")).toBeInTheDocument()
  })

  it("refreshes available actions when package transitions change", async () => {
    let transitions: PackageTransitionsResponse = {
      transitions: ["start_verification", "reprocess"],
    }
    const fetchMock = makeFetchMock()
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString()
        const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0]
        if (path === "/packages/pkg-1/transitions")
          return Promise.resolve(jsonResponse(transitions))
        return fetchMock(input)
      }),
    )

    render(
      <Wrapper>
        <PackageDetailPage />
      </Wrapper>,
    )

    expect(await screen.findByRole("button", { name: /start verification/i })).toBeInTheDocument()

    transitions = {
      transitions: ["reset_verification", "reprocess"],
    }
    fireEvent.click(screen.getByRole("button", { name: /refresh now/i }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /reset verification/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole("button", { name: /start verification/i })).not.toBeInTheDocument()
  })

  it("refreshes actions when package workflow state changes outside the current user action", async () => {
    const client = freshClient()
    let details = makePackageDetails({
      verification_state: "in_progress",
      assignee: "dev@example.com",
    })
    let transitions: PackageTransitionsResponse = {
      transitions: ["cancel_verification", "finish_verification"],
    }
    const fetchMock = makeFetchMock()
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString()
        const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0]
        if (path === "/packages/pkg-1") return Promise.resolve(jsonResponse(details))
        if (path === "/packages/pkg-1/transitions")
          return Promise.resolve(jsonResponse(transitions))
        return fetchMock(input)
      }),
    )

    render(
      <Wrapper client={client}>
        <PackageDetailPage />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getByText("In verification")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /cancel verification/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /finish verification/i })).toBeInTheDocument()
    })

    details = makePackageDetails({
      verification_state: "not_started",
      assignee: null,
    })
    transitions = {
      transitions: ["start_verification", "reprocess"],
    }

    act(() => {
      client.setQueryData(queryKeys.packages.detail("pkg-1"), details)
    })

    await waitFor(() => {
      expect(screen.getByText("Not started")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /start verification/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole("button", { name: /cancel verification/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /finish verification/i })).not.toBeInTheDocument()
  })
})
