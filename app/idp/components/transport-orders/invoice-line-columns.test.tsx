// @vitest-environment jsdom
import { queryKeys } from "@cortex/api"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { InvoiceLineColumnsDialog } from "./invoice-line-columns"

function installLocalStorageMock() {
  const values = new Map<string, string>()
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
      clear: vi.fn(() => values.clear()),
    },
  })
}

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function renderWithClient(
  ui: ReactNode,
  preferences: {
    document_panel_ratio: number | null
    theme_mode: null
    invoice_line_hidden_columns?: string[] | null
  } = {
    document_panel_ratio: null,
    theme_mode: null,
    invoice_line_hidden_columns: null,
  },
) {
  const client = freshClient()
  client.setQueryData(queryKeys.userPreferences(), preferences)
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function mockPreferencesPost() {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    void _input
    void _init
    return new Response(
      JSON.stringify({
        document_panel_ratio: null,
        theme_mode: null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

beforeEach(() => {
  installLocalStorageMock()
})

afterEach(() => vi.unstubAllGlobals())

describe("InvoiceLineColumnsDialog", () => {
  it("cancels draft changes, saves hidden columns, and resets defaults", async () => {
    const fetchMock = mockPreferencesPost()
    const user = userEvent.setup()

    renderWithClient(<InvoiceLineColumnsDialog />)

    await user.click(screen.getByRole("button", { name: /columns/i }))
    await user.click(screen.getByRole("checkbox", { name: /product code/i }))
    await user.click(screen.getByRole("button", { name: /cancel/i }))

    expect(fetchMock).toHaveBeenCalledTimes(0)

    await user.click(screen.getByRole("button", { name: /columns/i }))
    expect(screen.getByRole("checkbox", { name: /product code/i }).getAttribute("data-state")).toBe(
      "checked",
    )

    await user.click(screen.getByRole("checkbox", { name: /product code/i }))
    await user.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      invoice_line_hidden_columns: ["product_code"],
    })

    await user.click(screen.getByRole("button", { name: /columns/i }))
    expect(screen.getByRole("checkbox", { name: /product code/i }).getAttribute("data-state")).toBe(
      "unchecked",
    )
    await user.click(screen.getByRole("button", { name: /reset defaults/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      invoice_line_hidden_columns: null,
    })
  })

  it("uses local storage when the backend response does not include invoice-line columns", async () => {
    window.localStorage.setItem("idp.invoiceLineHiddenColumns", JSON.stringify(["product_code"]))
    const user = userEvent.setup()

    renderWithClient(<InvoiceLineColumnsDialog />, {
      document_panel_ratio: null,
      theme_mode: null,
    })

    await user.click(screen.getByRole("button", { name: /columns/i }))

    expect(screen.getByRole("checkbox", { name: /product code/i }).getAttribute("data-state")).toBe(
      "unchecked",
    )
  })
})
