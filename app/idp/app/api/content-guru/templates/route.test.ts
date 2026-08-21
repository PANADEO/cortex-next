// Test funkcjonalny GET/POST /api/content-guru/templates — bramka
// autoryzacji (bypass attempts, w tym manage-templates dla POST) jest osobno
// w ../guard-coverage.test.ts, tutaj tylko kontrakt/logika ZA bramką.

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["content-guru"]),
  loadGrantedScopes: vi.fn(async () => ["content-guru:manage-templates"]),
}))

const service = vi.hoisted(() => ({
  listTemplates: vi.fn(async () => [] as unknown[]),
  createTemplate: vi.fn(
    async (input: { name: string; category: string; content: string }, createdBy: string) => ({
      id: "template-1",
      ...input,
      createdBy,
      createdAt: new Date("2026-08-03T00:00:00Z"),
      updatedAt: new Date("2026-08-03T00:00:00Z"),
    }),
  ),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { GET, POST } = await import("./route")

const EMAIL = "manager@firma.pl"

function makeRequest(method: string, body?: unknown): Request {
  const headers = new Headers({ "Content-Type": "application/json", "x-auth-request-email": EMAIL })
  return new Request("http://localhost/api/content-guru/templates", {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

beforeEach(() => {
  clearTileAccessCache()
  service.listTemplates.mockClear()
  service.createTemplate.mockClear()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

describe("GET /api/content-guru/templates", () => {
  it("zwraca listę szablonów", async () => {
    service.listTemplates.mockResolvedValueOnce([
      { id: "1", name: "Post", category: "Główne", content: "Treść" },
    ])

    const response = await GET(makeRequest("GET") as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toHaveLength(1)
  })
})

describe("POST /api/content-guru/templates", () => {
  it("400 na zły request (brak nazwy)", async () => {
    const response = await POST(
      makeRequest("POST", { category: "Główne", content: "Treść" }) as never,
    )
    expect(response.status).toBe(400)
    // `toEqual` na PEŁNYM ciele, nie sam status: brak `message` ma być
    // dowiedziony, a nie domniemany. Zdanie Zoda jest techniczne i wpisane
    // w kodzie w jednym języku — przepuszczone do ciała trafiało na ekran
    // zamiast przetłumaczonego zapasu podanego przez wołającego.
    expect(await response.json()).toEqual({ error: "invalid-request" })
    expect(service.createTemplate).not.toHaveBeenCalled()
  })

  it("201 happy path: tworzy szablon, createdBy = email z nagłówka", async () => {
    const response = await POST(
      makeRequest("POST", { name: "Nowy", category: "Główne", content: "Treść promptu" }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(service.createTemplate).toHaveBeenCalledWith(
      { name: "Nowy", category: "Główne", content: "Treść promptu" },
      EMAIL,
    )
    expect(json.id).toBe("template-1")
  })

  it("409 na naruszenie unikalności category+name", async () => {
    service.createTemplate.mockRejectedValueOnce(
      Object.assign(new Error("duplicate key"), { code: "23505" }),
    )

    const response = await POST(
      makeRequest("POST", { name: "Duplikat", category: "Główne", content: "Treść" }) as never,
    )

    expect(response.status).toBe(409)
  })
})
