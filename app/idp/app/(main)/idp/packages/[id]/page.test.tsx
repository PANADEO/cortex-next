// @vitest-environment jsdom
import type {
  PackageActionsResponse,
  PackageDetailsResponse,
  PackageTransitionsResponse,
  PackageTransportOrdersResponse,
} from "@cortex/types"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import PackageDetailPage from "./page"

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "pkg-1" }),
}))

vi.mock("@/components/export-menu", () => ({
  ExportMenu: () => <button type="button">Export</button>,
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
})

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
}

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={freshClient()}>{children}</QueryClientProvider>
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  })
}

function makeFetchMock() {
  const details: PackageDetailsResponse = {
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
  }
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
})
