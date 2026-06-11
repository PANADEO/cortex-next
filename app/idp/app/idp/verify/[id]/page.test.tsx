// @vitest-environment jsdom
import type { Invoice, PackageDetailsResponse, PackageTransportOrdersResponse } from "@cortex/types"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

const { useParams } = vi.hoisted(() => ({
  useParams: vi.fn(() => ({ id: "test-1" })),
}))

vi.mock("next/navigation", () => ({
  useParams,
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

function Wrapper({ client, children }: { client: QueryClient; children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

interface RouteResponse {
  status?: number
  body: unknown
}

function makeFetchMock(routes: Record<string, RouteResponse>) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString()
    const path = url.startsWith("http") ? new URL(url).pathname : (url.split("?")[0] ?? url)
    const route = routes[path ?? ""]
    if (!route) {
      return new Promise<Response>(() => {})
    }
    return Promise.resolve(
      new Response(JSON.stringify(route.body), {
        status: route.status ?? 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
  })
}

function makePackage(): PackageDetailsResponse {
  return {
    id: "test-1",
    file_name: "invoice-bundle.zip",
    package_name: null,
    file_hash: "hash",
    file_size_mb: 1,
    created_date: "2026-05-18T10:00:00Z",
    processing_state: "ready",
    verification_state: "in_progress",
    assignee: "dev@cortex.local",
    uploaded_by: "dev@cortex.local",
    custom_status: null,
    user_notes: null,
    last_additional_ai_context: null,
    analysis_result: {},
    verified_result: null,
    total_tokens: null,
    total_cost_usd: null,
  }
}

function makeInvoice(overrides: Partial<Invoice> & Pick<Invoice, "id">): Invoice {
  return {
    invoice_number: "FV-1",
    invoice_date: "2026-05-18",
    invoice_currency: "EUR",
    country_of_dispatch: "DE",
    country_of_destination: "PL",
    delivery_terms: null,
    invoice_totals: null,
    warnings: [],
    notes: [],
    lines: [
      {
        id: `${overrides.id}-line-1`,
        line_number: "1",
        po_number: null,
        product_code: "SKU-1",
        description: "Product",
        description_pl: null,
        cn_code: null,
        hs: null,
        quantity: "1",
        unit_of_measure: "pcs",
        unit_price: null,
        invoice_value: "10",
        net_weight_kg: null,
        gross_weight_kg: null,
        estimated_gross_weight_kg: null,
        packages_quantity: null,
        packages_type: null,
        packages_marking: null,
        origin_country: "DE",
        source_references: [],
        notes: [],
      },
    ],
    ...overrides,
  }
}

function makeTransportOrders(): PackageTransportOrdersResponse {
  return {
    package_id: "test-1",
    verified_transport_orders: null,
    transport_orders: [
      {
        id: "order-1",
        transport_order_number: "TO-1",
        mode: null,
        truck_plate: null,
        trailer_plate: null,
        country_of_dispatch: "DE",
        country_of_destination: "PL",
        seller: null,
        buyer: null,
        consignor: null,
        consignee: null,
        sad_context: null,
        invoice_processing: null,
        invoices: [
          makeInvoice({ id: "invoice-1", invoice_number: "FV-1" }),
          makeInvoice({
            id: "invoice-2",
            invoice_number: "FV-2",
            lines: [
              {
                id: "line-2",
                line_number: "1",
                po_number: null,
                product_code: "SKU-2",
                description: "Second product",
                description_pl: null,
                cn_code: null,
                hs: null,
                quantity: "2",
                unit_of_measure: "pcs",
                unit_price: null,
                invoice_value: "20",
                net_weight_kg: null,
                gross_weight_kg: null,
                estimated_gross_weight_kg: null,
                packages_quantity: null,
                packages_type: null,
                packages_marking: null,
                origin_country: "DE",
                source_references: [],
                notes: [],
              },
              {
                id: "line-3",
                line_number: "2",
                po_number: null,
                product_code: "SKU-3",
                description: "Third product",
                description_pl: null,
                cn_code: null,
                hs: null,
                quantity: "3",
                unit_of_measure: "pcs",
                unit_price: null,
                invoice_value: "30",
                net_weight_kg: null,
                gross_weight_kg: null,
                estimated_gross_weight_kg: null,
                packages_quantity: null,
                packages_type: null,
                packages_marking: null,
                origin_country: "DE",
                source_references: [],
                notes: [],
              },
            ],
          }),
        ],
      },
    ],
  }
}

import VerifyWorkspacePage from "./page"

describe("VerifyWorkspacePage — document preview toggle", () => {
  it("hides and shows the source materials preview panel", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({
        "/user/me": { body: { email: "dev@cortex.local", has_access: true } },
        "/packages/test-1": { body: makePackage() },
        "/packages/test-1/transitions": { body: { transitions: [] } },
        "/packages/test-1/transport-orders": { body: makeTransportOrders() },
        "/packages/test-1/source-files": { body: [] },
      }),
    )

    render(
      <Wrapper client={freshClient()}>
        <VerifyWorkspacePage />
      </Wrapper>,
    )

    expect(await screen.findByTestId("document-preview-panel")).not.toBeNull()

    await userEvent.click(screen.getByRole("button", { name: /hide document preview/i }))

    expect(screen.queryByTestId("document-preview-panel")).toBeNull()
    expect(screen.getByRole("button", { name: /show document preview/i })).not.toBeNull()

    await userEvent.click(screen.getByRole("button", { name: /show document preview/i }))

    expect(await screen.findByTestId("document-preview-panel")).not.toBeNull()
  })

  it("shows every invoice as a tab and switches the left invoice data panel", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({
        "/user/me": { body: { email: "dev@cortex.local", has_access: true } },
        "/packages/test-1": { body: makePackage() },
        "/packages/test-1/transitions": { body: { transitions: [] } },
        "/packages/test-1/transport-orders": { body: makeTransportOrders() },
        "/packages/test-1/source-files": { body: [] },
      }),
    )

    render(
      <Wrapper client={freshClient()}>
        <VerifyWorkspacePage />
      </Wrapper>,
    )

    expect(await screen.findByRole("tab", { name: /invoice fv-1/i })).not.toBeNull()
    expect(screen.getByRole("tab", { name: /invoice fv-2/i })).not.toBeNull()
    expect(screen.getByRole("heading", { name: /invoice fv-1.*1 lines/i })).not.toBeNull()

    await userEvent.click(screen.getByRole("tab", { name: /invoice fv-2/i }))

    expect(screen.getByRole("heading", { name: /invoice fv-2.*2 lines/i })).not.toBeNull()
  })

  it("shows and calls admin unlock when backend returns unlock transition", async () => {
    const fetchMock = makeFetchMock({
      "/user/me": { body: { email: "admin@cortex.local", has_access: true } },
      "/packages/test-1": {
        body: { ...makePackage(), assignee: "dev@cortex.local" },
      },
      "/packages/test-1/transitions": { body: { transitions: ["unlock_verification"] } },
      "/packages/test-1/transport-orders": { body: makeTransportOrders() },
      "/packages/test-1/source-files": { body: [] },
      "/packages/test-1/unlock-verification": { body: {} },
    })
    vi.stubGlobal("fetch", fetchMock)

    render(
      <Wrapper client={freshClient()}>
        <VerifyWorkspacePage />
      </Wrapper>,
    )

    await userEvent.click(await screen.findByRole("button", { name: /unlock package/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/packages/test-1/unlock-verification",
        expect.objectContaining({ method: "POST" }),
      )
    })
  })
})
