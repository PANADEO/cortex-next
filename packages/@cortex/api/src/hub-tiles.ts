"use client"

import type { TileKind } from "@cortex/tile-sdk"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import { queryKeys } from "./query-keys"

/** Kształt po stronie klienta: daty przychodzą z API jako stringi ISO, nie
 *  Date — lustro `system_config.applications`
 *  (packages/@cortex/db/src/schema/system-config.ts). WYŁĄCZNIE metadane
 *  renderu (D7, PROJECT/cortex-frontend-hub-db-driven-projekt.md) — ten
 *  katalog nie ma i nie może mieć pól decydujących o dostępie. */
export interface HubTile {
  id: string
  code: string
  name: string
  description: string | null
  /**
   * Komplet tłumaczeń kafelka, kluczowany kodem języka ("en") —
   * PROJECT/cortex-frontend/ARTIFACTS/i18n/cortex-frontend-tlumaczenia-nazw-
   * kafelkow-projekt.md. Klucz obecny => w bazie stoi wiersz, w którym co
   * najmniej jedno z pól jest nie-NULL; oba pola są osobno nullowalne, bo
   * wolno przetłumaczyć samą nazwę i zostawić opis na wartości bazowej.
   *
   * Serwer NIE rozstrzyga nazwy — nie zna języka użytkownika (wybór siedzi w
   * `localStorage`, §3 projektu). Rozstrzyga KLIENT, jedną regułą:
   *   nazwa(locale) = translations[locale]?.name ?? name
   * Kafelek bez tłumaczeń dostaje pustą mapę, nigdy `undefined`.
   */
  translations: Record<string, { name: string | null; description: string | null }>
  icon: string | null
  kind: TileKind
  route: string | null
  url: string | null
  target: string | null
  isActive: boolean
  sortOrder: number
  showOnHub: boolean
  color: string | null
  categoryFunctional: string | null
  categoryDepartment: string[] | null
  activatedAt: string | null
  createdAt: string
  updatedAt: string
}

interface UseHubTilesResult {
  tiles: HubTile[]
  isLoading: boolean
  isError: boolean
}

const EMPTY_TILES: HubTile[] = []

/**
 * Katalog kafelków huba (`GET /api/hub/tiles`) — wzorem `useAuthorizedApps()`.
 * Krok 2 (D7): zero konsumenta dziś — `TileGrid` nadal czyta statyczny
 * `TILES`, przełącza dopiero Krok 3. Filtrowanie po uprawnieniach zostaje W
 * CAŁOŚCI po stronie klienta, dokładnie jak dziś: ten hook zwraca wyłącznie
 * katalog metadanych, nigdy nie decyduje kto co widzi.
 */
export function useHubTiles(): UseHubTilesResult {
  const query = useQuery<HubTile[]>({
    queryKey: queryKeys.hubTiles(),
    queryFn: () => apiClient.get<HubTile[]>("/api/hub/tiles"),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })

  return {
    tiles: query.data ?? EMPTY_TILES,
    isLoading: query.isPending,
    isError: query.isError,
  }
}
