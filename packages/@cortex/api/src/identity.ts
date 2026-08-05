"use client"

import type { UserIdentityResponse } from "@cortex/types"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import { useMe } from "./me"
import { queryKeys } from "./query-keys"

/**
 * Kto jest zalogowany — WŁASNY endpoint (nagłówek oauth2-proxy + własny
 * Postgres), niezależny od zewnętrznego backendu IDP.
 *
 * Świadomie NIE zastępuje useMe(). /user/me niesie dwa pojęcia, których ten
 * endpoint nie zna i znać nie może: `has_access` (bramka kafelka `idp`
 * w AppGate) oraz `scopes` (m.in. `package_unlock` → badge "IDP admin").
 * Oba są własnością backendu IDP i na środowisku, gdzie on stoi (demo-dev),
 * muszą działać dalej.
 */
export function useMyIdentity() {
  return useQuery({
    queryKey: queryKeys.identity(),
    queryFn: () => apiClient.get<UserIdentityResponse>("/api/me/identity"),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export interface ShellUser {
  email: string
  name: string | null
  scopes: readonly string[] | null
}

/**
 * Użytkownik dla menu powłoki, złożony z DWÓCH źródeł o różnej dostępności:
 *
 *   - tożsamość (e-mail, nazwa) — z własnego /api/me/identity, więc działa
 *     wszędzie, także tam gdzie backendu IDP nie ma (cortex-next),
 *   - `scopes` — z /user/me, gdy backend IDP jest w środowisku obecny.
 *
 * Efekt na środowisku BEZ backendu IDP: e-mail/nazwa widoczne normalnie, badge
 * "IDP admin" po prostu nie występuje — i tak nie miałby o czym informować,
 * skoro nie ma IDP. Efekt na demo-dev: bez zmian, badge nadal działa.
 *
 * Reguła mieszania żyje TUTAJ, w jednym miejscu — obie powłoki (Topbar,
 * ShellHeader) mają ją tylko konsumować, nie odtwarzać u siebie.
 *
 * E-mail ma fallback na /user/me wyłącznie po to, żeby ta zmiana była ściśle
 * nieregresyjna: gdyby na demo-dev zawiodło /api/me/identity, a backend IDP
 * odpowiadał, menu pokaże to, co pokazywało przedtem, zamiast "—". Kierunek
 * pozostaje jednoznaczny — własny endpoint jest źródłem prawdy, /user/me tylko
 * podpiera. `null` zwracamy dopiero, gdy tożsamości nie zna ŻADNE z dwóch
 * źródeł.
 */
export function useShellUser(): ShellUser | null {
  const identity = useMyIdentity()
  const me = useMe()

  // /user/me jest PODPORĄ po awarii własnego źródła, nigdy KONKURENTEM w oknie
  // startowym. Warunek na samym `identity.data` tego nie odróżniał: brak danych
  // znaczy też "zapytanie jeszcze leci", a /user/me bywa ciepłe z cache
  // (staleTime 60 s), więc powłoka zdążyła mignąć e-mailem z backendu IDP, zanim
  // podmieniła go na własny. Przy rozjeździe adresów (inna wielkość liter,
  // nieaktualny wiersz w IDP, user z dwoma adresami) to mignięcie CUDZĄ
  // tożsamością. Query nie ma `enabled`, więc `isSuccess || isError` wyczerpuje
  // wszystkie jego stany poza `pending` — a dokładnie w `pending` fallback ma
  // milczeć.
  const identitySettled = identity.isSuccess || identity.isError
  const email = identity.data?.email ?? (identitySettled ? me.data?.email : undefined)
  if (!email) return null

  return { email, name: identity.data?.name ?? null, scopes: me.data?.scopes ?? null }
}
