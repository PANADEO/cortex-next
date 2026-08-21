// Test funkcjonalny GET/PUT/DELETE /api/content-guru/templates/:id — bramka
// jest osobno w ../../guard-coverage.test.ts.

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["content-guru"]),
  loadGrantedScopes: vi.fn(async () => ["content-guru:manage-templates"]),
}))

const service = vi.hoisted(() => ({
  getTemplate: vi.fn(async (id: string) =>
    id === "missing"
      ? undefined
      : { id, name: "Post", category: "Główne", content: "Treść", createdBy: "system" },
  ),
  updateTemplate: vi.fn(
    async (id: string, input: { name: string; category: string; content: string }) =>
      id === "missing" ? undefined : { id, ...input, createdBy: "system" },
  ),
  deleteTemplate: vi.fn(async (id: string) => id !== "missing"),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { GET, PUT, DELETE } = await import("./route")

const EMAIL = "manager@firma.pl"

function makeRequest(method: string, body?: unknown): Request {
  const headers = new Headers({ "Content-Type": "application/json", "x-auth-request-email": EMAIL })
  return new Request("http://localhost/api/content-guru/templates/probe", {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  clearTileAccessCache()
  for (const fn of Object.values(service)) fn.mockClear()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

describe("GET /api/content-guru/templates/:id", () => {
  it("200 dla istniejącego szablonu", async () => {
    const response = await GET(makeRequest("GET") as never, ctx("1"))
    expect(response.status).toBe(200)
  })

  it("404 dla nieistniejącego", async () => {
    const response = await GET(makeRequest("GET") as never, ctx("missing"))
    expect(response.status).toBe(404)
  })
})

describe("PUT /api/content-guru/templates/:id", () => {
  const BODY = { name: "Zaktualizowany", category: "Główne", content: "Nowa treść" }

  it("200 happy path", async () => {
    const response = await PUT(makeRequest("PUT", BODY) as never, ctx("1"))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.name).toBe("Zaktualizowany")
  })

  it("404 dla nieistniejącego id", async () => {
    const response = await PUT(makeRequest("PUT", BODY) as never, ctx("missing"))
    expect(response.status).toBe(404)
  })

  it("400 na zły request", async () => {
    const response = await PUT(makeRequest("PUT", { name: "" }) as never, ctx("1"))
    expect(response.status).toBe(400)
    expect(service.updateTemplate).not.toHaveBeenCalled()
  })

  it("409 na naruszenie unikalności", async () => {
    service.updateTemplate.mockRejectedValueOnce(
      Object.assign(new Error("duplicate key"), { code: "23505" }),
    )
    const response = await PUT(makeRequest("PUT", BODY) as never, ctx("1"))
    expect(response.status).toBe(409)
  })
})

describe("DELETE /api/content-guru/templates/:id", () => {
  it("200 happy path", async () => {
    const response = await DELETE(makeRequest("DELETE") as never, ctx("1"))
    expect(response.status).toBe(200)
  })

  it("404 dla nieistniejącego id", async () => {
    const response = await DELETE(makeRequest("DELETE") as never, ctx("missing"))
    expect(response.status).toBe(404)
  })
})
