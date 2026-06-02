// @vitest-environment jsdom
import type { PackageTransportOrdersResponse } from "@cortex/types"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TransportOrdersPanel } from "./transport-orders-panel"

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
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
  })
}

function makeTransportOrders(): PackageTransportOrdersResponse {
  return {
    package_id: "pkg-1",
    verified_transport_orders: null,
    transport_orders: [
      {
        id: "order-1",
        transport_order_number: "TO-1",
        mode: "AIR",
        truck_plate: null,
        trailer_plate: null,
        country_of_dispatch: "CN",
        country_of_destination: "PL",
        seller: null,
        buyer: null,
        consignor: null,
        consignee: null,
        sad_context: null,
        invoice_processing: null,
        invoices: [],
      },
    ],
  }
}

describe("TransportOrdersPanel", () => {
  it("hides SAD context editor when Huzar export is disabled", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({
        "/packages/pkg-1/transport-orders": { body: makeTransportOrders() },
        "/packages/export-templates": {
          body: [{ name: "csv", display_name: "CSV", format: "csv", description: "" }],
        },
      }),
    )

    render(
      <Wrapper client={freshClient()}>
        <TransportOrdersPanel packageId="pkg-1" canEdit={false} />
      </Wrapper>,
    )

    expect(await screen.findByRole("heading", { name: /transport order to-1/i })).not.toBeNull()

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /sad \/ huzar/i })).toBeNull()
    })
  })

  it("shows SAD context editor when SAD XML export is enabled", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({
        "/packages/pkg-1/transport-orders": { body: makeTransportOrders() },
        "/packages/export-templates": {
          body: [{ name: "sad_xml", display_name: "SAD XML", format: "xml", description: "" }],
        },
      }),
    )

    render(
      <Wrapper client={freshClient()}>
        <TransportOrdersPanel packageId="pkg-1" canEdit={false} />
      </Wrapper>,
    )

    expect(await screen.findByRole("heading", { name: /sad \/ huzar/i })).not.toBeNull()
  })
})
