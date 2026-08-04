// Kontrakt żądań OpenWebUI, zweryfikowany wprost w
// ~/REPO/cortex-admin/openwebui.openapi.json (GroupForm, GroupUpdateForm,
// GroupResponse, UserIdsForm) — patrz nagłówek openwebui-client.ts. Test
// SZCZEGÓLNIE pilnuje D4: `updateGroupMeta` nigdy nie wysyła `user_ids`
// (GroupUpdateForm je dopuszcza, ale przekazanie go NADPISUJE całe
// członkostwo grupy — dokładnie ten bug, którego ten adapter ma nie odtworzyć).

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  addUsersToGroup,
  createGroup,
  getGroup,
  listAllUserEmailIds,
  listGroups,
  OpenwebuiClientError,
  removeUsersFromGroup,
  updateGroupMeta,
  type OpenwebuiConfig,
} from "./openwebui-client"

const CONFIG: OpenwebuiConfig = { baseUrl: "http://chat.internal", adminToken: "sekret-admina-nie-do-logow" }

type FetchMock = ReturnType<typeof stubFetch>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

function stubFetch(response: Response | (() => Response | Promise<Response>)) {
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
    typeof response === "function" ? response() : response,
  )
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function readCall(fetchMock: FetchMock): [string, RequestInit] {
  const call = fetchMock.mock.calls[0]
  if (!call) throw new Error("fetch nie został zawołany")
  return call
}

function readBody(fetchMock: FetchMock): unknown {
  const body = readCall(fetchMock)[1].body
  return typeof body === "string" ? JSON.parse(body) : body
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("uwierzytelnienie — sekret WYŁĄCZNIE nagłówkiem", () => {
  it("każde żądanie niesie Authorization: Bearer <token>, nigdy w query stringu", async () => {
    const fetchMock = stubFetch(jsonResponse([]))

    await listGroups(CONFIG)

    const [url, init] = readCall(fetchMock)
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${CONFIG.adminToken}`)
    expect(url).not.toContain(CONFIG.adminToken)
  })
})

describe("createGroup — POST /api/v1/groups/create", () => {
  it("wysyła GroupForm {name, description, permissions: {}}", async () => {
    const fetchMock = stubFetch(jsonResponse({ id: "g1", name: "cortex:hr" }))

    const result = await createGroup(CONFIG, "cortex:hr", "opis")

    const [url, init] = readCall(fetchMock)
    expect(url).toBe("http://chat.internal/api/v1/groups/create")
    expect(init.method).toBe("POST")
    expect(readBody(fetchMock)).toEqual({ name: "cortex:hr", description: "opis", permissions: {} })
    expect(result).toEqual({ id: "g1", name: "cortex:hr" })
  })
})

describe("getGroup — GET /api/v1/groups/id/{id}, BEZ łańcucha fallbacków cortex-admina", () => {
  it("zwraca user_ids z GroupResponse", async () => {
    const fetchMock = stubFetch(
      jsonResponse({ id: "g1", name: "cortex:hr", description: "d", user_ids: ["u1", "u2"] }),
    )

    const group = await getGroup(CONFIG, "g1")

    expect(readCall(fetchMock)[0]).toBe("http://chat.internal/api/v1/groups/id/g1")
    expect(group).toEqual({ id: "g1", name: "cortex:hr", description: "d", userIds: ["u1", "u2"] })
  })

  it("404 -> null, NIE wyjątek (grupa skasowana ręcznie w OpenWebUI)", async () => {
    stubFetch(jsonResponse({ detail: "not found" }, 404))

    const group = await getGroup(CONFIG, "nieznana-grupa")

    expect(group).toBeNull()
  })
})

describe("updateGroupMeta — POST .../update — NIGDY user_ids (D4)", () => {
  it("wysyła WYŁĄCZNIE {name, description}", async () => {
    const fetchMock = stubFetch(jsonResponse({ id: "g1" }))

    await updateGroupMeta(CONFIG, "g1", "cortex:hr", "Zarządzane przez Konfigurację Systemu")

    const body = readBody(fetchMock) as Record<string, unknown>
    expect(body).toEqual({ name: "cortex:hr", description: "Zarządzane przez Konfigurację Systemu" })
    expect(body).not.toHaveProperty("user_ids")
    expect(readCall(fetchMock)[0]).toBe("http://chat.internal/api/v1/groups/id/g1/update")
  })

  it("sygnatura funkcji nie przyjmuje user_ids w ogóle — pomyłka jest niemożliwa do popełnienia z tego adaptera", () => {
    // Test typów, nie runtime: `updateGroupMeta` ma dokładnie cztery parametry
    // (config, groupId, name, description). Jeśli ktoś kiedyś dołoży piąty
    // (`userIds`), ten plik przestanie się kompilować i trzeba będzie
    // świadomie zdecydować, czy to naprawdę bezpieczne.
    expect(updateGroupMeta.length).toBe(4)
  })
})

describe("addUsersToGroup / removeUsersFromGroup — przyrostowo (D4)", () => {
  it("addUsersToGroup wysyła UserIdsForm {user_ids}", async () => {
    const fetchMock = stubFetch(jsonResponse(null))

    await addUsersToGroup(CONFIG, "g1", ["u1", "u2"])

    expect(readCall(fetchMock)[0]).toBe("http://chat.internal/api/v1/groups/id/g1/users/add")
    expect(readBody(fetchMock)).toEqual({ user_ids: ["u1", "u2"] })
  })

  it("removeUsersFromGroup wysyła UserIdsForm {user_ids}", async () => {
    const fetchMock = stubFetch(jsonResponse(null))

    await removeUsersFromGroup(CONFIG, "g1", ["u3"])

    expect(readCall(fetchMock)[0]).toBe("http://chat.internal/api/v1/groups/id/g1/users/remove")
    expect(readBody(fetchMock)).toEqual({ user_ids: ["u3"] })
  })

  it("pusta lista -> ZERO żądań HTTP (idempotencja: brak zmian, brak ruchu sieciowego)", async () => {
    const fetchMock = stubFetch(jsonResponse(null))

    await addUsersToGroup(CONFIG, "g1", [])
    await removeUsersFromGroup(CONFIG, "g1", [])

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("listAllUserEmailIds — jedyne dotknięcie kont (D6), mapowanie e-mail -> id", () => {
  it("parsuje UserListResponse {users: [...]} i normalizuje e-mail do lowercase", async () => {
    stubFetch(
      jsonResponse({
        users: [
          { id: "u1", email: "Jan@Firma.pl" },
          { id: "u2", email: "ania@firma.pl" },
        ],
        total: 2,
      }),
    )

    const byEmail = await listAllUserEmailIds(CONFIG)

    expect(byEmail.get("jan@firma.pl")).toBe("u1")
    expect(byEmail.get("ania@firma.pl")).toBe("u2")
  })
})

describe("mapowanie awarii sieci/HTTP na OpenwebuiClientError", () => {
  it("401/403 -> failure 'unauthorized'", async () => {
    stubFetch(jsonResponse({ detail: "unauthorized" }, 401))

    await expect(listGroups(CONFIG)).rejects.toMatchObject({
      name: "OpenwebuiClientError",
      failure: "unauthorized",
    })
  })

  it("500 -> failure 'upstream-error'", async () => {
    stubFetch(jsonResponse({ detail: "boom" }, 500))

    await expect(listGroups(CONFIG)).rejects.toMatchObject({ failure: "upstream-error" })
  })

  it("fetch rzuca (sieć nieosiągalna) -> failure 'unreachable', BEZ przecieku URL-a w komunikacie", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error(`connect ECONNREFUSED ${CONFIG.baseUrl}`))),
    )

    const error = await listGroups(CONFIG).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(OpenwebuiClientError)
    expect((error as OpenwebuiClientError).failure).toBe("unreachable")
    expect((error as Error).message).not.toContain(CONFIG.baseUrl)
  })

  it("odpowiedź nie-JSON -> failure 'malformed-response'", async () => {
    stubFetch(new Response("<html>nie json</html>", { status: 200 }))

    await expect(listGroups(CONFIG)).rejects.toMatchObject({ failure: "malformed-response" })
  })
})
