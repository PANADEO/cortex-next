// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

beforeAll(() => {
  // Prevent the cold-cache test from making real network requests:
  // usePackage stays in `isLoading` while fetch never resolves, so the
  // hook returns the unchanged trail (which is exactly what we assert).
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  )
})

afterAll(() => {
  vi.unstubAllGlobals()
})

const { breadcrumbsFromPath, useResolvedBreadcrumbs } = await import("./breadcrumbs")
const { queryKeys } = await import("@cortex/api")
const { default: i18nInstance } = await import("./i18n")

describe("breadcrumbsFromPath", () => {
  it("returns IDP root for /idp", () => {
    expect(breadcrumbsFromPath("/idp")).toEqual([{ label: "IDP", href: "/" }])
  })

  it("maps /idp/packages to IDP / Extraction", () => {
    expect(breadcrumbsFromPath("/idp/packages")).toEqual([
      { label: "IDP", href: "/" },
      { label: "Ekstrakcja" },
    ])
  })

  it("falls through to raw segment for /idp/packages/<id>", () => {
    expect(breadcrumbsFromPath("/idp/packages/abc-123")).toEqual([
      { label: "IDP", href: "/" },
      { label: "Ekstrakcja", href: "/idp/packages" },
      { label: "abc-123" },
    ])
  })

  it("maps /idp/dashboard to IDP / Dashboard", () => {
    expect(breadcrumbsFromPath("/idp/dashboard")).toEqual([
      { label: "IDP", href: "/" },
      { label: "Dashboard" },
    ])
  })

  it("maps /idp-basic/dashboard to IDP Basic / Dashboard", () => {
    expect(breadcrumbsFromPath("/idp-basic/dashboard")).toEqual([
      { label: "IDP Basic", href: "/" },
      { label: "Dashboard" },
    ])
  })

  it("maps /idp-basic/files to IDP Basic / Files", () => {
    expect(breadcrumbsFromPath("/idp-basic/files")).toEqual([
      { label: "IDP Basic", href: "/" },
      { label: "Pliki" },
    ])
  })

  it("maps /idp-basic/results detail to IDP Basic / Results / id", () => {
    expect(breadcrumbsFromPath("/idp-basic/results/result-1")).toEqual([
      { label: "IDP Basic", href: "/" },
      { label: "Wyniki", href: "/idp-basic/results" },
      { label: "result-1" },
    ])
  })

  it("maps /intrastat/review to Intrastat / Review", () => {
    expect(breadcrumbsFromPath("/intrastat/review")).toEqual([
      { label: "Intrastat", href: "/" },
      { label: "Weryfikacja" },
    ])
  })

  it("maps /invoice-supervisor/inbox to Nadzorca Faktur / Skrzynka", () => {
    expect(breadcrumbsFromPath("/invoice-supervisor/inbox")).toEqual([
      { label: "Nadzorca Faktur", href: "/" },
      { label: "Skrzynka" },
    ])
  })

  it("maps /ai-tools to the app hub root", () => {
    expect(breadcrumbsFromPath("/ai-tools")).toEqual([{ label: "Aplikacje", href: "/" }])
  })

  it("maps /ai-tools/text-highlighter to Aplikacje / Podświetlacz", () => {
    expect(breadcrumbsFromPath("/ai-tools/text-highlighter")).toEqual([
      { label: "Aplikacje", href: "/" },
      { label: "Podświetlacz" },
    ])
  })

  it("tolerates trailing slash on package detail path", () => {
    expect(breadcrumbsFromPath("/idp/packages/abc-123/")).toEqual([
      { label: "IDP", href: "/" },
      { label: "Ekstrakcja", href: "/idp/packages" },
      { label: "abc-123" },
    ])
  })

  it("maps /system-config/users to Konfiguracja Systemu / Użytkownicy", () => {
    expect(breadcrumbsFromPath("/system-config/users")).toEqual([
      { label: "Konfiguracja Systemu", href: "/" },
      { label: "Użytkownicy" },
    ])
  })

  it("maps /token-usage to Raportowanie Tokenów root with no trailing crumb", () => {
    expect(breadcrumbsFromPath("/token-usage")).toEqual([
      { label: "Raportowanie Tokenów", href: "/" },
    ])
  })

  it("maps /ilustromat/templates to Ilustromat / Szablony", () => {
    expect(breadcrumbsFromPath("/ilustromat/templates")).toEqual([
      { label: "Ilustromat", href: "/" },
      { label: "Szablony" },
    ])
  })

  it("maps /cortex-config/projects to Cortex Config / Projekty", () => {
    expect(breadcrumbsFromPath("/cortex-config/projects")).toEqual([
      { label: "Cortex Config", href: "/" },
      { label: "Projekty" },
    ])
  })

  it("gives cortex-config a real root label and non-/idp/* middle links for a nested path", () => {
    const trail = breadcrumbsFromPath("/cortex-config/governance/users/new")
    expect(trail[0]).toEqual({ label: "Cortex Config", href: "/" })
    for (const entry of trail.slice(1)) {
      if (entry.href) {
        expect(entry.href.startsWith("/idp/")).toBe(false)
        expect(entry.href.startsWith("/cortex-config/")).toBe(true)
      }
    }
    expect(trail[trail.length - 1]).toEqual({ label: "new" })
  })

  it("resolves the governance middle segment to the real /cortex-config/governance page", () => {
    expect(breadcrumbsFromPath("/cortex-config/governance/users/new")).toEqual([
      { label: "Cortex Config", href: "/" },
      { label: "governance", href: "/cortex-config/governance" },
      { label: "users", href: "/cortex-config/governance/users" },
      { label: "new" },
    ])
  })

  it("maps /store-pit/dashboard to sp-console's tile label, not sp-client's", () => {
    expect(breadcrumbsFromPath("/store-pit/dashboard")).toEqual([
      { label: "Store-Pit Re-Rating", href: "/" },
      { label: "Przegląd" },
    ])
  })

  it("maps /store-pit/clients to sp-client's tile label, not sp-console's", () => {
    expect(breadcrumbsFromPath("/store-pit/clients")).toEqual([
      { label: "Store-Pit Client Zone", href: "/" },
      { label: "Klienci" },
    ])
  })

  it("falls back to the first store-pit tile for a segment neither sp-console nor sp-client owns by href", () => {
    expect(breadcrumbsFromPath("/store-pit/pricing")).toEqual([
      { label: "Store-Pit Re-Rating", href: "/" },
      { label: "Reguły cenowe" },
    ])
  })

  it("maps /okna-czasowe/films to Okna czasowe / Filmy", () => {
    expect(breadcrumbsFromPath("/okna-czasowe/films")).toEqual([
      { label: "Okna czasowe", href: "/" },
      { label: "Filmy" },
    ])
  })
})

interface SeededPackage {
  id: string
  file_name: string
  package_name?: string | null
}

function seededClient(seeds: SeededPackage[] = []): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  })
  for (const seed of seeds) {
    client.setQueryData(queryKeys.packages.detail(seed.id), seed)
  }
  return client
}

function wrapper(client: QueryClient) {
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children)
  }
  Wrapper.displayName = "TestQueryClientProvider"
  return Wrapper
}

describe("useResolvedBreadcrumbs", () => {
  it("swaps the last entry's label with file_name when package is in cache", () => {
    const client = seededClient([{ id: "abc-123", file_name: "INV-2026-001.zip" }])
    const { result } = renderHook(() => useResolvedBreadcrumbs("/idp/packages/abc-123"), {
      wrapper: wrapper(client),
    })
    expect(result.current).toEqual([
      { label: "IDP", href: "/" },
      { label: "Ekstrakcja", href: "/idp/packages" },
      { label: "INV-2026-001.zip" },
    ])
  })

  it("prefers package_name over file_name when package has a display name", () => {
    const client = seededClient([
      { id: "abc-123", file_name: "INV-2026-001.zip", package_name: "May shipment" },
    ])
    const { result } = renderHook(() => useResolvedBreadcrumbs("/idp/packages/abc-123"), {
      wrapper: wrapper(client),
    })
    expect(result.current).toEqual([
      { label: "IDP", href: "/" },
      { label: "Ekstrakcja", href: "/idp/packages" },
      { label: "May shipment" },
    ])
  })

  it("returns unchanged trail on non-package routes", () => {
    const client = seededClient()
    const { result } = renderHook(() => useResolvedBreadcrumbs("/idp/dashboard"), {
      wrapper: wrapper(client),
    })
    expect(result.current).toEqual([{ label: "IDP", href: "/" }, { label: "Dashboard" }])
  })

  it("returns unchanged trail when package data is unavailable (cold cache)", () => {
    const client = seededClient()
    const { result } = renderHook(() => useResolvedBreadcrumbs("/idp/packages/missing-id"), {
      wrapper: wrapper(client),
    })
    expect(result.current).toEqual([
      { label: "IDP", href: "/" },
      { label: "Ekstrakcja", href: "/idp/packages" },
      { label: "missing-id" },
    ])
  })
})

describe("nazwy kafelków w drugim języku", () => {
  const aiTools = (locale: string) => i18nInstance.getFixedT(locale, "ai-tools")

  /** Tłumaczenia nazw kafelków przychodzą z KATALOGU (`GET /api/hub/tiles`),
   *  kluczowane kodem aplikacji — nie z pliku w repo. Ta sama dana, z której
   *  hub składa etykiety kafelków. */
  const catalogue = {
    "idp-basic": { en: { name: "Simple IDP", description: null } },
    "system-config": { en: { name: "System Configuration", description: null } },
  }

  // Ta ścieżka omijała tłumaczenia w ogóle: okruszek narzędzia AI brał
  // `shortLabel` wprost z rejestru, więc w interfejsie angielskim pokazywał
  // polską nazwę. Nie miała pokrycia, bo cała reszta okruszków chodzi przez
  // klucze nawigacji i wyglądała poprawnie.
  it("okruszek narzędzia AI jest tłumaczony, a nie brany z rejestru", () => {
    expect(
      breadcrumbsFromPath("/ai-tools/text-highlighter", (k) => k, catalogue, "en", aiTools("en")),
    ).toEqual([{ label: "nav.hub", href: "/" }, { label: "Highlighter" }])
  })

  /** Korzeń okruszka JEST nazwą kafelka — musi brzmieć tak samo jak kafelek
   *  na hubie, bo stoi w topbarze nad nim. Wcześniej brał ją z `locales/en/
   *  tiles.json`, czyli z pliku, którego admin nie edytuje; teraz z katalogu. */
  it("korzeń okruszka bierze nazwę kafelka z tłumaczeń katalogu", () => {
    const [root] = breadcrumbsFromPath("/system-config/users", (k) => k, catalogue, "en")
    expect(root).toEqual({ label: "System Configuration", href: "/" })
  })

  it("po polsku korzeń zostaje na wartości bazowej", () => {
    const [root] = breadcrumbsFromPath("/system-config/users", (k) => k, catalogue, "pl")
    expect(root).toEqual({ label: "Konfiguracja Systemu", href: "/" })
  })

  /** Katalog jeszcze nie wrócił z sieci, albo kafelek jest ukryty z huba
   *  (`show_on_hub=false`) i w katalogu go nie ma. Okruszek ma wtedy pokazać
   *  etykietę z rejestru — nazwę zdegradowaną do języka źródłowego, NIGDY
   *  surowy segment URL-a. */
  it("bez wpisu w katalogu korzeń spada na etykietę z rejestru", () => {
    const [root] = breadcrumbsFromPath("/token-usage", (k) => k, {}, "en")
    expect(root).toEqual({ label: "Raportowanie Tokenów", href: "/" })
  })

  // Krótka nazwa NIE jest daną instancji, więc — inaczej niż nazwa kafelka —
  // w języku źródłowym też idzie z pliku tłumaczeń, nie z rejestru. Rejestr
  // zostaje wyłącznie zapasem na narzędzie bez wpisu.
  it("w języku źródłowym krótka nazwa idzie z przestrzeni `ai-tools`", () => {
    expect(
      breadcrumbsFromPath("/ai-tools/text-highlighter", (k) => k, catalogue, "pl", aiTools("pl")),
    ).toEqual([{ label: "nav.hub", href: "/" }, { label: "Podświetlacz" }])
  })
})
