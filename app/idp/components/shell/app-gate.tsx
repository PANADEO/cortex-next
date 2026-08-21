"use client"

import { useTranslation } from "react-i18next"

import { canAccessTile } from "@/lib/tiles"
import { useAuthorizedApps, useMe } from "@cortex/api"
import { LoadingState } from "@cortex/ui"
import type { ReactNode } from "react"
import { AccessDeniedScreen } from "./access-denied-screen"

/** Jedyny kafelek, o którym cokolwiek mówi `has_access` z /user/me. */
const IDP_TILE_ID = "idp"

/**
 * Stan oczekiwania bramki. NIE `null`.
 *
 * `return null` gasiło CAŁĄ stronę na czas ładowania: <AppGate> stoi wyżej niż
 * powłoka (sidebar, topbar) na każdym callsite, więc każdy `(main)` mrugał
 * bielą, dopóki useAuthorizedApps() był w locie. Efekt uboczny, przez który to
 * wyszło: <AiToolGate> montuje się NIŻEJ, więc jego własny <LoadingState> nie
 * pokazywał się nigdy — zanim bramka przepuściła dzieci, query było już
 * rozwiązane ze wspólnego cache'u TanStack Query.
 *
 * Wyśrodkowany spinner na pełną wysokość, bez szkieletu chrome'u: ta bramka
 * opakowuje TRZY różne powłoki (generyczny AppShell, własną powłokę Coworka i
 * layout idp), więc nie ma jednego układu, który mogłaby wiernie udawać.
 * `min-h-screen` trzyma tę wysokość, którą za chwilę zajmie powłoka, więc
 * podmiana treści nie przesuwa strony.
 *
 * Etykieta ta sama co w <AiToolGate> — to ten sam komunikat dla użytkownika.
 */
function GatePending() {
  const { t } = useTranslation("shell")
  return <LoadingState className="min-h-screen" label={t("gate.checking")} />
}

interface AppGateProps {
  children: ReactNode
  /**
   * Kod kafelka wymagany na tej trasie. `null` = trasy nie dało się przypisać
   * do żadnego kafelka → odmowa.
   *
   * Prop jest WYMAGANY i nie ma wartości domyślnej. Wcześniej `undefined`
   * po cichu znaczyło "pomiń sprawdzenie kafelka", przez co `(cowork)` i hub
   * przepuszczały każdego, kto miał JAKIKOLWIEK grant. Strona, która nie jest
   * kafelkiem, ma używać <HubGate>, a nie pomijać prop.
   */
  tileId: string | null
}

/**
 * Bramka powłoki przed każdą stroną kafelka. Czyta DWA niezależne sygnały:
 *
 *   1. `/api/me/access` (własny Postgres) — pełna lista grantów tego e-maila.
 *      Źródło prawdy o dostępie; jedyny sygnał wymagany zawsze.
 *   2. `/user/me` (backend IDP, osobne repo) — `has_access`, scoped do
 *      aplikacji `idp` (APPLICATION_CODE=idp po tamtej stronie).
 *
 * Sygnał (2) bramkuje WYŁĄCZNIE kafelek `idp`. Wcześniej blokował też każdy
 * callsite bez `tileId` (hub, Cowork), a jego błąd — czyli również zwykła
 * NIEOBECNOŚĆ backendu IDP w środowisku — gasił całą instancję, niezależnie od
 * tego, co mówił Postgres. Środowisko cortex-next stawiane jest bez tamtego
 * backendu (docs/infrastructure.md), więc awaria/brak /user/me degraduje teraz
 * jeden kafelek zamiast wszystkiego.
 */
export function AppGate({ children, tileId }: AppGateProps) {
  const me = useMe()
  const authorized = useAuthorizedApps()

  if (authorized.isLoading) return <GatePending />

  // Na /user/me CZEKAMY WYŁĄCZNIE dla kafelka idp. To nie jest mikrooptymalizacja:
  // wspólne oczekiwanie renderowało pustą stronę na KAŻDYM kafelku i na hubie,
  // gdy backendu IDP nie ma w środowisku. Na cortex-next middleware przepisuje
  // /user/me na nieistniejący host `idp-app`, więc `getaddrinfo ENOTFOUND` wraca
  // SZYBKO → 500 → query kończy się BŁĘDEM (potwierdzone dwoma przebiegami e2e).
  // Warunek stoi mimo to na `isPending`, bo drugi tryb awarii — host odpowiada
  // na TCP, ale nie na HTTP — zostawia query w `pending` bezterminowo i wtedy
  // oczekiwanie nie kończy się nigdy. Kod jest poprawny w obu.
  if (tileId === IDP_TILE_ID && me.isPending) return <GatePending />

  // Tożsamość na ekran odmowy — z WŁASNEGO źródła w pierwszej kolejności.
  // /api/me/access zwraca ten sam uwierzytelniony e-mail z nagłówka
  // oauth2-proxy, co /api/me/identity, i tak czy owak jest tu wołane, więc
  // bramka nie potrzebuje trzeciego żądania. /user/me tylko podpiera — bramka
  // potrafi dojść tutaj z `authorized.isError`, a wtedy własnego e-maila nie
  // ma. Kierunek jak w useShellUser(): zewnętrzny backend nigdy nie wyprzedza
  // własnego źródła.
  const email = authorized.email ?? me.data?.email ?? null

  if (tileId === IDP_TILE_ID) {
    if (me.isError) return <AccessDeniedScreen reason="error" />
    if (me.data?.has_access !== true) {
      return <AccessDeniedScreen email={email} reason="denied" />
    }
  }

  if (authorized.isError || authorized.allowed === null) {
    return <AccessDeniedScreen reason="error" />
  }
  if (authorized.allowed === false) {
    return <AccessDeniedScreen email={email} reason="denied" />
  }
  if (tileId === null || !canAccessTile(authorized.apps, tileId)) {
    return <AccessDeniedScreen email={email} reason="denied" />
  }

  return <>{children}</>
}

/**
 * Bramka stron, które NIE są kafelkiem — dziś wyłącznie hub. Właściwym
 * warunkiem jest samo `allowed` ("ma dostęp do czegokolwiek"), bo hub nie ma
 * własnego kodu w rejestrze aplikacji i nie da się go sprawdzić przez
 * canAccessTile(). Osobny, jawnie nazwany wariant zamiast pomijania `tileId`
 * w <AppGate>: "brak wartości" nie może znaczyć "mniej sprawdzeń".
 *
 * `has_access` z /user/me nie bierze tu udziału w ogóle — hub to nie kafelek
 * `idp`, a użytkownik bez dostępu do IDP ma normalnie widzieć swoje pozostałe
 * kafelki.
 */
export function HubGate({ children }: { children: ReactNode }) {
  const me = useMe()
  const authorized = useAuthorizedApps()

  if (authorized.isLoading) return <GatePending />

  if (authorized.isError || authorized.allowed === null) {
    return <AccessDeniedScreen reason="error" />
  }
  if (authorized.allowed === false) {
    return <AccessDeniedScreen email={authorized.email ?? me.data?.email ?? null} reason="denied" />
  }

  return <>{children}</>
}
