// @vitest-environment jsdom
// Sedno tej suity: reguła mieszania dwóch źródeł w useShellUser(). Tożsamość ma
// pochodzić z własnego /api/me/identity (działa wszędzie), a `scopes` z
// /user/me (backend IDP, obecny tylko na części środowisk). Testy pilnują obu
// kierunków regresji naraz:
//   - cortex-next (brak backendu IDP) → e-mail nadal widoczny, badge znika,
//   - demo-dev (backend IDP stoi)     → badge "IDP admin" działa jak dotąd.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
}

function wrapper(client: QueryClient) {
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children)
  }
  Wrapper.displayName = "TestQueryClientProvider"
  return Wrapper
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

/**
 * Żądanie, które NIGDY się nie rozstrzyga — ani odpowiedzią, ani błędem.
 *
 * To przypadek ŚCIŚLE TRUDNIEJSZY niż awaria z kodem błędu i dlatego suita
 * trzyma się jego: query zostaje `isPending` bez końca, więc każdy warunek
 * napisany jako "poczekaj, aż /user/me odpowie" gaśnie tu na zawsze. Właśnie ta
 * różnica raz przeszła przez zielone testy na produkcję — suita zaślepiona
 * samym 503 rozstrzygała query i nigdy nie dotykała stanu, który realnie gasił
 * powłokę (patrz app-gate.tsx, home-page-client.tsx,
 * e2e/support/mocks/shell-access.ts).
 *
 * UWAGA, żeby nie sprowadzić na manowce następnego debugowania: to NIE jest to,
 * co dzieje się na cortex-next. Tam middleware przepisuje /user/me na
 * IDP_BACKEND_URL (`http://idp-app`), tego hosta nie ma w ogóle, więc
 * `getaddrinfo ENOTFOUND idp-app` wraca SZYBKO → 500 → query kończy się BŁĘDEM.
 * Wiszące żądanie to przypadek graniczny (host odpowiada na TCP, ale nie na
 * HTTP), nie domyślny tryb awarii tamtego środowiska.
 */
const NEVER_RESOLVES = (): Promise<Response> => new Promise<Response>(() => {})

/** Odpowiedź sterowana z testu — pozwala trzymać endpoint w `pending`. */
function deferredResponse() {
  let settle!: (response: Response) => void
  const promise = new Promise<Response>((resolve) => {
    settle = resolve
  })
  return { get: () => promise, settle }
}

interface StubRoutes {
  identity?: () => Response | Promise<Response>
  me?: () => Response | Promise<Response>
}

/** Zaślepia obie ścieżki naraz; brak wpisu = endpoint odpowiada 503. */
function stubFetch(routes: StubRoutes) {
  const spy = vi.fn((input: string) => {
    if (input.includes("/api/me/identity")) {
      return Promise.resolve(routes.identity?.() ?? json({ error: "unavailable" }, 503))
    }
    if (input.includes("/user/me")) {
      return Promise.resolve(routes.me?.() ?? json({ error: "unavailable" }, 503))
    }
    throw new Error(`nieoczekiwany fetch: ${input}`)
  })
  vi.stubGlobal("fetch", spy)
  return spy
}

describe("useMyIdentity", () => {
  it("czyta własny endpoint /api/me/identity, nie /user/me", async () => {
    const fetchSpy = stubFetch({ identity: () => json({ email: "u@x.com", name: null }) })
    const { useMyIdentity } = await import("./identity")

    const { result } = renderHook(() => useMyIdentity(), { wrapper: wrapper(freshClient()) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/me/identity")
    expect(result.current.data).toEqual({ email: "u@x.com", name: null })
  })
})

describe("useShellUser — środowisko BEZ backendu IDP (cortex-next)", () => {
  it("SEDNO: zwraca e-mail mimo niedostępnego /user/me — koniec z '—' w menu", async () => {
    stubFetch({ identity: () => json({ email: "jan@firma.pl", name: null }) })
    const { useShellUser } = await import("./identity")

    const { result } = renderHook(() => useShellUser(), { wrapper: wrapper(freshClient()) })

    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current).toEqual({ email: "jan@firma.pl", name: null, scopes: null })
  })

  it("preferuje nazwę z bazy, gdy full_name jest uzupełniony", async () => {
    stubFetch({ identity: () => json({ email: "jan@firma.pl", name: "Jan Kowalski" }) })
    const { useShellUser } = await import("./identity")

    const { result } = renderHook(() => useShellUser(), { wrapper: wrapper(freshClient()) })

    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current?.name).toBe("Jan Kowalski")
  })

  it("SEDNO: zwraca e-mail, gdy /user/me WISI bez rozstrzygnięcia — właściwy tryb awarii", async () => {
    stubFetch({
      identity: () => json({ email: "jan@firma.pl", name: "Jan Kowalski" }),
      me: NEVER_RESOLVES,
    })
    const { useShellUser } = await import("./identity")

    const { result } = renderHook(() => useShellUser(), { wrapper: wrapper(freshClient()) })

    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current).toEqual({ email: "jan@firma.pl", name: "Jan Kowalski", scopes: null })
  })

  it("bez /user/me nie ma scope'ów — badge 'IDP admin' nie ma się z czego wziąć", async () => {
    stubFetch({ identity: () => json({ email: "jan@firma.pl", name: null }) })
    const { useShellUser } = await import("./identity")

    const { result } = renderHook(() => useShellUser(), { wrapper: wrapper(freshClient()) })

    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current?.scopes).toBeNull()
  })
})

describe("useShellUser — środowisko Z backendem IDP (demo-dev)", () => {
  it("SEDNO: zachowuje scopes z /user/me, więc badge 'IDP admin' nie znika", async () => {
    stubFetch({
      identity: () => json({ email: "admin@firma.pl", name: "Admin" }),
      me: () => json({ email: "admin@firma.pl", has_access: true, scopes: ["package_unlock"] }),
    })
    const { useShellUser } = await import("./identity")

    const { result } = renderHook(() => useShellUser(), { wrapper: wrapper(freshClient()) })

    await waitFor(() => expect(result.current?.scopes).toEqual(["package_unlock"]))
    expect(result.current).toEqual({
      email: "admin@firma.pl",
      name: "Admin",
      scopes: ["package_unlock"],
    })
  })

  it("tożsamość idzie z własnego endpointu nawet gdy /user/me też ją zwraca", async () => {
    // Własny Postgres jest źródłem prawdy o tym, kim user jest — /user/me
    // dokłada wyłącznie scope'y. Rozjazd e-maili nie może przełączyć źródła.
    stubFetch({
      identity: () => json({ email: "wlasny@firma.pl", name: "Z bazy" }),
      me: () => json({ email: "stary-idp@firma.pl", has_access: true, scopes: [] }),
    })
    const { useShellUser } = await import("./identity")

    const { result } = renderHook(() => useShellUser(), { wrapper: wrapper(freshClient()) })

    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current?.email).toBe("wlasny@firma.pl")
    expect(result.current?.name).toBe("Z bazy")
  })

  it("SEDNO: przy OPÓŹNIONYM własnym endpoincie NIE pokazuje e-maila z /user/me", async () => {
    // Test powyżej przechodzi także na kodzie, który tylko UDAJE właściwy
    // kierunek: useMyIdentity() jest wołane pierwsze, więc jego fetch startuje
    // pierwszy i wygrywa wyścig sam z siebie. Tutaj kolejność jest odwrócona —
    // /user/me odpowiada natychmiast, własny endpoint dopiero na sygnał z testu.
    // W tym oknie powłoka NIE MA PRAWA pokazać tożsamości z backendu IDP; taki
    // przebłysk to na demo-dev (ciepłe /user/me z cache, staleTime 60 s) pokazanie
    // CUDZEGO adresu. Ten test pilnuje też, żeby nikt nie "uprościł"
    // useShellUser() do `me.data?.email ?? identity.data?.email` ani nie wyciął
    // query tożsamości.
    const identity = deferredResponse()
    stubFetch({
      identity: identity.get,
      me: () => json({ email: "stary-idp@firma.pl", has_access: true, scopes: [] }),
    })
    const { useShellUser } = await import("./identity")
    const { useMe } = await import("./me")

    const rendered: (string | null)[] = []
    const { result } = renderHook(
      () => {
        const shellUser = useShellUser()
        rendered.push(shellUser?.email ?? null)
        return { shellUser, me: useMe() }
      },
      { wrapper: wrapper(freshClient()) },
    )

    await waitFor(() => expect(result.current.me.isSuccess).toBe(true))
    expect(result.current.shellUser).toBeNull()

    identity.settle(json({ email: "wlasny@firma.pl", name: "Z bazy" }))

    await waitFor(() => expect(result.current.shellUser?.email).toBe("wlasny@firma.pl"))
    expect(rendered).not.toContain("stary-idp@firma.pl")
  })
})

describe("useShellUser — stan nieustalony", () => {
  it("zwraca null, dopóki tożsamości nie zna ŻADNE ze źródeł", async () => {
    stubFetch({ identity: NEVER_RESOLVES, me: NEVER_RESOLVES })
    const { useShellUser } = await import("./identity")

    const { result } = renderHook(() => useShellUser(), { wrapper: wrapper(freshClient()) })

    await waitFor(() => expect(result.current).toBeNull())
    expect(result.current).toBeNull()
  })

  it("NIEREGRESYJNOŚĆ: gdy padnie własny endpoint, a /user/me żyje — e-mail zamiast '—'", async () => {
    // Ten kierunek jest odwrotnością awarii z cortex-next i dotyczy demo-dev:
    // powłoka nie ma pokazać MNIEJ niż przed wprowadzeniem /api/me/identity.
    stubFetch({ me: () => json({ email: "z-idp@firma.pl", has_access: true, scopes: [] }) })
    const { useShellUser } = await import("./identity")

    const { result } = renderHook(() => useShellUser(), { wrapper: wrapper(freshClient()) })

    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current).toEqual({ email: "z-idp@firma.pl", name: null, scopes: [] })
  })
})
