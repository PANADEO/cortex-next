"use client"

import { useAuthorizedApps, useMe } from "@cortex/api"
import type { ReactNode } from "react"
import { canAccessTile } from "@/lib/tiles"
import { AccessDeniedScreen } from "./access-denied-screen"

/** Jedyny kafelek, o którym cokolwiek mówi `has_access` z /user/me. */
const IDP_TILE_ID = "idp"

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

  if (authorized.isLoading) return null

  // Na /user/me CZEKAMY WYŁĄCZNIE dla kafelka idp. To nie jest mikrooptymalizacja:
  // nieobecny backend IDP nie zawsze kończy się błędem — potrafi nie odpowiadać
  // w ogóle (rewrite middleware na host, którego nie ma). Wtedy `me.isPending`
  // zostaje `true` bezterminowo, a wspólne oczekiwanie renderowało pustą stronę
  // na KAŻDYM kafelku i na hubie. Zweryfikowane na żywo — awaria widoczna
  // dopiero na realnym środowisku, testy z mockiem zawsze rozstrzygały useMe().
  if (tileId === IDP_TILE_ID && me.isPending) return null

  // Tożsamość na ekran odmowy: /user/me bywa niedostępne, a /api/me/access
  // i tak zwraca e-mail, którym się przedstawiliśmy.
  const email = me.data?.email ?? authorized.email

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

  if (authorized.isLoading) return null

  if (authorized.isError || authorized.allowed === null) {
    return <AccessDeniedScreen reason="error" />
  }
  if (authorized.allowed === false) {
    return <AccessDeniedScreen email={me.data?.email ?? authorized.email} reason="denied" />
  }

  return <>{children}</>
}
