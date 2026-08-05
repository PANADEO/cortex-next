// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

interface MeMock {
  data?: { email: string; has_access: boolean } | undefined
  isPending: boolean
  isError: boolean
}

interface AuthorizedMock {
  allowed: boolean | null
  apps: string[]
  email: string | null
  isLoading: boolean
  isError: boolean
}

let meMock: MeMock = { isPending: true, isError: false }
let authorizedMock: AuthorizedMock = {
  allowed: null,
  apps: [],
  email: null,
  isLoading: true,
  isError: false,
}

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", props),
}))

vi.mock("@cortex/api", () => ({
  useMe: () => meMock,
  useAuthorizedApps: () => authorizedMock,
}))

import { AppGate, HubGate } from "./app-gate"

beforeEach(() => {
  meMock = { isPending: true, isError: false }
  authorizedMock = { allowed: null, apps: [], email: null, isLoading: true, isError: false }
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
})

const Child = () => createElement("div", { "data-testid": "child" }, "child-content")

/** Zalogowany, sprawny backend IDP, dostęp do wymienionych kafelków. */
function signedIn(apps: string[], options: { hasAccess?: boolean; email?: string } = {}): void {
  const email = options.email ?? "u@x.com"
  meMock = {
    isPending: false,
    isError: false,
    data: { email, has_access: options.hasAccess ?? true },
  }
  authorizedMock = { allowed: apps.length > 0, apps, email, isLoading: false, isError: false }
}

/** Backend IDP nieosiągalny (albo nieobecny w środowisku) — /user/me błądzi,
 *  tożsamość i uprawnienia znamy wyłącznie z własnego /api/me/access. */
function idpBackendDown(apps: string[], email = "u@x.com"): void {
  meMock = { isPending: false, isError: true }
  authorizedMock = { allowed: apps.length > 0, apps, email, isLoading: false, isError: false }
}

/** Oba źródła znają tożsamość, ale RÓŻNĄ. Na demo-dev to nie teoria: nieaktualny
 *  wiersz w bazie IDP, użytkownik z dwoma adresami, inna wielkość liter. Jedyny
 *  układ, w którym widać KIERUNEK pierwszeństwa — signedIn() i idpBackendDown()
 *  dają oba adresy identyczne albo tylko jeden z nich. */
function mismatchedIdentity(apps: string[]): void {
  meMock = {
    isPending: false,
    isError: false,
    data: { email: "stary-idp@firma.pl", has_access: true },
  }
  authorizedMock = {
    allowed: apps.length > 0,
    apps,
    email: "wlasny@firma.pl",
    isLoading: false,
    isError: false,
  }
}

function renderGate(tileId: string | null, children: ReactNode = <Child />) {
  return render(<AppGate tileId={tileId}>{children}</AppGate>)
}

function expectDenied(): void {
  expect(screen.queryByTestId("child")).toBeNull()
  expect(screen.getByRole("heading", { name: "Brak dostępu" })).not.toBeNull()
}

function expectError(): void {
  expect(screen.queryByTestId("child")).toBeNull()
  expect(screen.getByRole("button", { name: "Spróbuj ponownie" })).not.toBeNull()
}

function expectAllowed(): void {
  expect(screen.getByTestId("child").textContent).toBe("child-content")
}

/**
 * Bramka CZEKA na rozstrzygnięcie autoryzacji.
 *
 * Poprzednia wersja tych testów sprawdzała `container.firstChild === null`,
 * czyli "nie renderuje się DOSŁOWNIE nic". To wiązało właściwą gwarancję
 * (dzieci nie wyciekają przed autoryzacją) z detalem implementacyjnym
 * (`return null`) — a to ten detal był błędem: każda strona `(main)` mrugała
 * bielą, bo <AppGate> stoi nad całą powłoką.
 *
 * Gwarancja jest tu asertowana WPROST, nie ubocznie, i w trzech punktach:
 *   1. dzieci NIE są w drzewie (to samo, co chronił stary warunek),
 *   2. nie pokazujemy przedwcześnie odmowy — bramka nie może fail-closed'ować
 *      na danych, których jeszcze nie ma (stary warunek pilnował tego tylko
 *      przypadkiem, przy okazji "nic nie ma"),
 *   3. użytkownik widzi, że coś trwa — czego stary warunek WYKLUCZAŁ.
 */
function expectPending(): void {
  expect(screen.queryByTestId("child")).toBeNull()
  expect(screen.queryByRole("heading", { name: "Brak dostępu" })).toBeNull()
  // `AccessDeniedScreen` ma DWA tytuły zależne od `reason` (access-denied-screen.tsx):
  // "Brak dostępu" dla `denied` i "Brak uprawnień" dla `error`. Punkt 2. wyżej
  // wykluczał tylko pierwszy, a `AppGate` fail-closed'uje na `reason="error"`
  // CZĘŚCIEJ niż na `"denied"` — więc asercja pokrywała mniej niż połowę
  // przypadków, które sama deklaruje. Wyszło z mutation testu (review 05.08.2026):
  // wariant "spinner + AccessDeniedScreen reason=error" jako jedyny z dziesięciu
  // przechodził cały plik na zielono.
  expect(screen.queryByRole("heading", { name: "Brak uprawnień" })).toBeNull()
  expect(screen.getByText("Sprawdzanie dostępu…")).not.toBeNull()
}

describe("AppGate — stany ładowania", () => {
  it("pokazuje stan ładowania i NIE wpuszcza dzieci, dopóki oba sygnały się ładują", () => {
    renderGate("idp")
    expectPending()
  })

  it("pokazuje stan ładowania, dopóki ładuje się samo /api/me/access", () => {
    meMock = { isPending: false, isError: false, data: { email: "u@x.com", has_access: true } }
    authorizedMock = { allowed: null, apps: [], email: null, isLoading: true, isError: false }

    renderGate("idp")

    expectPending()
  })

  it("czeka też na samo /user/me — kafelek idp, granty już są", () => {
    // Trzecie miejsce, które zwracało `null`. Dotyczy WYŁĄCZNIE kafelka idp
    // (patrz D7), ale mrugało bielą tak samo jak dwa pozostałe.
    meMock = { isPending: true, isError: false }
    authorizedMock = {
      allowed: true,
      apps: ["idp"],
      email: "u@x.com",
      isLoading: false,
      isError: false,
    }

    renderGate("idp")

    expectPending()
  })

  it("NIE czeka na /user/me na innym kafelku — tam ma się renderować treść", () => {
    // Kontrola dla powyższego: gdyby oczekiwanie na /user/me rozlało się poza
    // idp, każdy inny kafelek utknąłby na spinnerze w środowisku bez backendu
    // IDP (a takie jest cortex-next).
    meMock = { isPending: true, isError: false }
    authorizedMock = {
      allowed: true,
      apps: ["intrastat"],
      email: "u@x.com",
      isLoading: false,
      isError: false,
    }

    renderGate("intrastat")

    expectAllowed()
  })
})

describe("AppGate — uprawnienia z /api/me/access", () => {
  it("wpuszcza przy zgodnym kodzie kafelka", () => {
    signedIn(["intrastat"])
    renderGate("intrastat")
    expectAllowed()
  })

  it("odmawia dostępu do kafelka, którego user nie ma", () => {
    signedIn(["idp"])
    renderGate("intrastat")
    expectDenied()
  })

  it("odmawia, gdy tileId jest null — nierozpoznana trasa, fail-closed", () => {
    signedIn(["idp"])
    renderGate(null)
    expectDenied()
  })

  it("odmawia przy allowed:false, z e-mailem na ekranie", () => {
    signedIn([])
    renderGate("intrastat")
    expectDenied()
    expect(screen.getByText("u@x.com")).not.toBeNull()
  })

  it("pokazuje wariant błędu, gdy /api/me/access się wywali (fail-closed)", () => {
    meMock = { isPending: false, isError: false, data: { email: "u@x.com", has_access: true } }
    authorizedMock = { allowed: null, apps: [], email: null, isLoading: false, isError: true }

    renderGate("intrastat")

    expectError()
  })
})

describe("AppGate — has_access dotyczy WYŁĄCZNIE kafelka idp (D7)", () => {
  it("odmawia idp przy has_access:false, mimo grantu w bazie", () => {
    signedIn(["idp"], { hasAccess: false })
    renderGate("idp")
    expectDenied()
  })

  it("wpuszcza idp przy has_access:true i grancie", () => {
    signedIn(["idp"])
    renderGate("idp")
    expectAllowed()
  })

  it("NIE odmawia innego kafelka przy has_access:false", () => {
    signedIn(["intrastat"], { hasAccess: false })
    renderGate("intrastat")
    expectAllowed()
  })

  it("blokuje idp, gdy backend IDP jest nieosiągalny", () => {
    // Kafelek idp bez potwierdzenia z /user/me to jedyny przypadek, w którym
    // awaria tamtego backendu nadal odcina — i ma odcinać.
    idpBackendDown(["idp"])
    renderGate("idp")
    expectError()
  })

  it("WPUSZCZA inne kafelki, gdy backend IDP jest nieosiągalny", () => {
    // Sedno D7: wcześniej me.isError odcinało KAŻDĄ stronę, więc środowisko bez
    // backendu IDP (a takie jest cortex-next) było martwe niezależnie od tego,
    // co mówił własny Postgres.
    idpBackendDown(["ilustromat"])
    renderGate("ilustromat")
    expectAllowed()
  })

  it("przy nieosiągalnym /user/me bierze e-mail na ekran odmowy z /api/me/access", () => {
    idpBackendDown([], "kto@firma.pl")
    renderGate("ilustromat")
    expectDenied()
    expect(screen.getByText("kto@firma.pl")).not.toBeNull()
  })

  it("nadal odmawia kafelka bez grantu, gdy backend IDP jest nieosiągalny", () => {
    idpBackendDown(["idp-basic"])
    renderGate("ilustromat")
    expectDenied()
  })
})

describe("Ekran odmowy — CZYJ e-mail pokazujemy", () => {
  it("SEDNO: bierze adres z własnego /api/me/access, nie z /user/me", () => {
    // Regresja, którą to zamyka: powrót do `me.data?.email ?? authorized.email`
    // w app-gate.tsx — jedna linia, którą łatwo cofnąć przy rozwiązywaniu
    // konfliktu merge'a, a wszystkie pozostałe testy zostają zielone. Skutek na
    // środowisku z nieaktualnym wierszem w bazie IDP: ekran odmowy pokazuje
    // użytkownikowi CUDZY adres i każe mu z nim iść do administratora.
    mismatchedIdentity([])
    renderGate("intrastat")
    expectDenied()
    expect(screen.getByText("wlasny@firma.pl")).not.toBeNull()
    expect(screen.queryByText("stary-idp@firma.pl")).toBeNull()
  })
})

describe("AppGate — AI Tools", () => {
  it("wpuszcza narzędzie przez grant zbiorczy ai-tools", () => {
    signedIn(["ai-tools"])
    renderGate("linkedin-generator")
    expectAllowed()
  })

  it("wpuszcza narzędzie przez jego własny kod", () => {
    signedIn(["linkedin-generator"])
    renderGate("linkedin-generator")
    expectAllowed()
  })

  it("odmawia narzędzia, gdy user ma grant na inne", () => {
    signedIn(["text-analyzer"])
    renderGate("linkedin-generator")
    expectDenied()
  })

  it("wpuszcza na hub /ai-tools przy grancie zbiorczym", () => {
    signedIn(["ai-tools"])
    renderGate("ai-tools")
    expectAllowed()
  })

  it("wpuszcza na hub /ai-tools użytkownika z JEDNYM narzędziem", () => {
    // Ta sama reguła co AiToolGate bez toolId — inaczej pozycja "Dashboard"
    // w sidebarze prowadziłaby do ekranu odmowy.
    signedIn(["linkedin-generator"])
    renderGate("ai-tools")
    expectAllowed()
  })

  it("odmawia huba /ai-tools bez żadnego narzędzia", () => {
    signedIn(["intrastat"])
    renderGate("ai-tools")
    expectDenied()
  })
})

describe("AppGate — cortex-cowork jest teraz sprawdzany per kod", () => {
  it("wpuszcza przy grancie cortex-cowork", () => {
    signedIn(["cortex-cowork"])
    renderGate("cortex-cowork")
    expectAllowed()
  })

  it("odmawia użytkownikowi z innym grantem", () => {
    // Regresja, którą to zamyka: layout (cowork) wołał <AppGate> BEZ tileId,
    // więc do Coworka wchodził każdy, kto miał jakikolwiek grant.
    signedIn(["idp"])
    renderGate("cortex-cowork")
    expectDenied()
  })
})

describe("HubGate — hub nie jest kafelkiem", () => {
  function renderHub() {
    return render(
      <HubGate>
        <Child />
      </HubGate>,
    )
  }

  it("wpuszcza na podstawie samego allowed", () => {
    signedIn(["intrastat"])
    renderHub()
    expectAllowed()
  })

  it("odmawia, gdy user nie ma żadnego grantu", () => {
    signedIn([])
    renderHub()
    expectDenied()
    expect(screen.getByText("u@x.com")).not.toBeNull()
  })

  it("też bierze adres z /api/me/access, nie z /user/me", () => {
    // HubGate ma własną kopię tego wyrażenia — musi mieć własny dowód.
    mismatchedIdentity([])
    renderHub()
    expectDenied()
    expect(screen.getByText("wlasny@firma.pl")).not.toBeNull()
    expect(screen.queryByText("stary-idp@firma.pl")).toBeNull()
  })

  it("IGNORUJE has_access — hub to nie kafelek idp", () => {
    signedIn(["intrastat"], { hasAccess: false })
    renderHub()
    expectAllowed()
  })

  it("działa, gdy backend IDP jest nieosiągalny", () => {
    idpBackendDown(["intrastat"])
    renderHub()
    expectAllowed()
  })

  it("pokazuje wariant błędu, gdy /api/me/access się wywali", () => {
    meMock = { isPending: false, isError: false, data: { email: "u@x.com", has_access: true } }
    authorizedMock = { allowed: null, apps: [], email: null, isLoading: false, isError: true }

    renderHub()

    expectError()
  })

  it("pokazuje stan ładowania i NIE wpuszcza dzieci w trakcie ładowania", () => {
    renderHub()
    expectPending()
  })
})
