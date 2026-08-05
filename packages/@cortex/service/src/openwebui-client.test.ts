// Kontrakt żądań OpenWebUI. Ładunki odpowiedzi w tym pliku są PRZEKLEJONE
// Z ŻYWEJ INSTANCJI 0.11.0 (curl na kontener `chat`), nie wymyślone z
// openapi.json cortex-admina — poprzednia wersja tego testu karmiła mocka
// polem `user_ids` na `GET /id/{id}`, którego ta wersja OpenWebUI tam NIE
// ZWRACA, więc suite świecił na zielono, kiedy produkcja nie usuwała nikogo
// z żadnej grupy. Mock, który sam sobie wymyśla kształt odpowiedzi, testuje
// wyłącznie własną wyobraźnię.
//
// Test SZCZEGÓLNIE pilnuje dwóch rzeczy:
//  - D4: `updateGroupMeta` nigdy nie wysyła `user_ids` (przekazanie go
//    NADPISUJE całe członkostwo grupy);
//  - braku CICHEGO DEFAULTU na odczycie członkostwa — odpowiedź bez
//    czytelnego `user_ids` musi być awarią, nie pustym zbiorem.

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

describe("getGroup — GET /api/v1/groups/id/{id}/export", () => {
  /** Dosłowna odpowiedź `GET /api/v1/groups/id/{id}/export` z OpenWebUI 0.11.0
   *  (GroupExportResponse = GroupResponse + user_ids). */
  const EXPORT_0_11_0 = {
    id: "a9238499-84e0-44ba-ab1e-a39fe7532423",
    user_id: "4ebbb9f4-51ee-4b11-9f43-2ce3f17706a1",
    name: "cortex:konsultanci",
    description: "Zarządzane przez Konfigurację Systemu Cortex360 — nie edytuj członkostwa ręcznie.",
    data: { config: { share: "members" } },
    meta: null,
    permissions: {},
    created_at: 1785946167,
    updated_at: 1785946719,
    member_count: 2,
    user_ids: ["08e6e696-1a7d-411d-b64c-95b99d4884a7", "0ae032ce-234c-4731-84f2-314b212a1c8e"],
  }

  /** Dosłowna odpowiedź `GET /api/v1/groups/id/{id}` z tej samej instancji —
   *  ta sama grupa, `member_count` ZAMIAST `user_ids`. To jest ładunek, który
   *  poprzednia implementacja czytała jako "grupa nie ma nikogo". */
  const GROUP_RESPONSE_0_11_0 = { ...EXPORT_0_11_0, user_ids: undefined }

  it("czyta członkostwo z /export — bo GroupResponse na 0.11.0 już go nie niesie", async () => {
    const fetchMock = stubFetch(jsonResponse(EXPORT_0_11_0))

    const group = await getGroup(CONFIG, EXPORT_0_11_0.id)

    expect(readCall(fetchMock)[0]).toBe(`http://chat.internal/api/v1/groups/id/${EXPORT_0_11_0.id}/export`)
    expect(group).toEqual({
      id: EXPORT_0_11_0.id,
      name: "cortex:konsultanci",
      description: EXPORT_0_11_0.description,
      userIds: EXPORT_0_11_0.user_ids,
    })
  })

  it("grupa bez członków -> user_ids: [] (obecne i puste to CO INNEGO niż nieobecne)", async () => {
    stubFetch(jsonResponse({ ...EXPORT_0_11_0, member_count: 0, user_ids: [] }))

    await expect(getGroup(CONFIG, EXPORT_0_11_0.id)).resolves.toMatchObject({ userIds: [] })
  })

  // ── Regresja bugu: cichy default zamieniał zmianę schematu w cichą awarię
  //    autoryzacji. Odczytu członkostwa NIE WOLNO domyślać.
  it("odpowiedź BEZ user_ids (kształt GroupResponse 0.11.0) -> 'malformed-response', NIGDY []", async () => {
    stubFetch(jsonResponse(GROUP_RESPONSE_0_11_0))

    const error = await getGroup(CONFIG, EXPORT_0_11_0.id).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(OpenwebuiClientError)
    expect((error as OpenwebuiClientError).failure).toBe("malformed-response")
    // Sedno: NIE dostajemy grupy z pustym członkostwem, z której reconciler
    // wyliczyłby "nie ma kogo usuwać".
    expect(error).not.toMatchObject({ userIds: [] })
  })

  it("user_ids o złym typie (null / nie-tablica / element nie-string) -> awaria, nie filtrowanie", async () => {
    for (const broken of [null, "u1,u2", { 0: "u1" }, ["u1", 42]]) {
      stubFetch(jsonResponse({ ...EXPORT_0_11_0, user_ids: broken }))

      await expect(getGroup(CONFIG, EXPORT_0_11_0.id)).rejects.toMatchObject({ failure: "malformed-response" })
    }
  })

  it("404 -> null, NIE wyjątek (grupa skasowana ręcznie w OpenWebUI)", async () => {
    stubFetch(jsonResponse({ detail: "not found" }, 404))

    const group = await getGroup(CONFIG, "nieznana-grupa")

    expect(group).toBeNull()
  })

  it("401 (tak 0.11.0 sygnalizuje BRAK grupy) -> awaria, nie null i nie puste członkostwo", async () => {
    // Upstream rzuca na nieistniejącą grupę HTTP_401_UNAUTHORIZED z detalem
    // NOT_FOUND, więc gałąź 404 -> null jest na tej wersji nieosiągalna.
    // Świadomie NIE zgadujemy "skasowana" z 401: uznanie realnie złego tokenu
    // za "grupy nie ma" zamieniłoby emptyGroupMembership() w cichy no-op.
    stubFetch(jsonResponse({ detail: "We could not find what you're looking for :/" }, 401))

    await expect(getGroup(CONFIG, "nieznana-grupa")).rejects.toMatchObject({ failure: "unauthorized" })
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
