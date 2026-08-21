"use client"

import { useCoworkProjectTiles } from "@/features/cortex-cowork"
import { useLocaleStore } from "@/lib/i18n/locale-store"
import { useFavoritesStore } from "@/lib/stores/favorites-store"
import {
  canAccessTile,
  COWORK_APP_CODE,
  DEPARTMENT_CATEGORIES,
  FUNCTIONAL_CATEGORIES,
  type Tile,
  type TileHrefOverrides,
} from "@/lib/tiles"
import { useAuthorizedApps, useHubTiles } from "@cortex/api"
import { useDeferredValue, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { hubApplicationsToTiles } from "./hub-tile"
import type { ActiveCategory, CategoryTab, HeroView, HubModel } from "./types"

// Warstwa 0 huba: dane, dostęp i stan filtrów. ZERO JSX — plik jest `.ts`, nie
// `.tsx`, więc kompilator pilnuje tego za nas. Wszystko poniżej mieszkało do
// tej pory w `tile-grid.tsx` razem z markupem; rozdzielenie jest warunkiem
// koniecznym przełączalnych layoutów (D4), bo inaczej każdy kolejny layout
// kopiuje logikę dostępu i od pierwszego dnia dryfuje.

function matchesSearch(tile: Tile, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return tile.label.toLowerCase().includes(q) || tile.description.toLowerCase().includes(q)
}

function categoryIdsForView(view: HeroView): readonly string[] {
  return view === "functional"
    ? FUNCTIONAL_CATEGORIES.map((c) => c.id)
    : DEPARTMENT_CATEGORIES.map((c) => c.id)
}

function categoryLabel(view: HeroView, id: string, t: (key: string) => string): string {
  const source = view === "functional" ? FUNCTIONAL_CATEGORIES : DEPARTMENT_CATEGORIES
  const key = source.find((c) => c.id === id)?.labelKey
  return key ? t(key) : id
}

function tileBelongsTo(view: HeroView, tile: Tile, categoryId: string): boolean {
  if (view === "functional") return tile.categoryFunctional === categoryId
  return tile.categoryDepartment.includes(categoryId as Tile["categoryDepartment"][number])
}

export function useHubModel(tileHrefOverrides?: TileHrefOverrides | undefined): HubModel {
  const [searchQuery, setSearchQuery] = useState("")
  const deferredQuery = useDeferredValue(searchQuery)
  const [view, setView] = useState<HeroView>("functional")
  const [activeCategory, setActiveCategory] = useState<ActiveCategory>("all")
  const favorites = useFavoritesStore((s) => s.favorites)
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite)
  const authorized = useAuthorizedApps()
  const coworkProjects = useCoworkProjectTiles()
  // Katalog kafelków code-backed (Krok 3, D7): WYŁĄCZNIE metadane wyglądu z
  // GET /api/hub/tiles, już przefiltrowane po stronie serwera do
  // is_active=true AND show_on_hub=true. Kto z tego katalogu faktycznie widzi
  // dany kafelek nadal rozstrzyga wyłącznie canAccessTile() niżej — ten hook
  // nie ma i nie może mieć logiki dostępu.
  const hub = useHubTiles()
  // Tłumaczenie katalogu idzie przestrzenią `tiles`, kluczowaną KODEM
  // aplikacji — patrz `hub-tile.ts`. Hook musi tu być, bo `t` zmienia
  // tożsamość przy zmianie języka i to ono przelicza `useMemo` niżej.
  const { t: tTiles } = useTranslation("tiles")
  const { t: tCommon } = useTranslation("common")
  const locale = useLocaleStore((s) => s.locale)

  const tiles = useMemo(() => {
    const mapped = hubApplicationsToTiles(hub.tiles, tTiles, locale)
    if (!tileHrefOverrides) return mapped
    return mapped.map((tile) => {
      const href = tileHrefOverrides[tile.id]
      return href ? { ...tile, href } : tile
    })
  }, [hub.tiles, tileHrefOverrides, tTiles, locale])

  // Kafelki code-backed filtruje grant z `applications` (własny Postgres, przez
  // /api/me/access) przez JEDNO miejsce z regułą dostępu — canAccessTile()
  // (D9: usuwa duplikowane "blanket ai-tools OR konkretny kod", które tu
  // wcześniej żyło osobno od AppGate). Kafelki task-chat nie mają własnego
  // wiersza w rejestrze — płyną z governance store, który zna WYŁĄCZNIE role
  // per projekt i o grant `cortex-cowork` nie pyta w ogóle. Dlatego SEKCJĘ
  // bramkuje tu ten sam kod, którego na trasie pilnuje
  // <AppGate tileId={COWORK_APP_CODE}>: bez tego user bez grantu widział na
  // hubie kafelki, które trasa i tak odmawia. Filtrowanie PER PROJEKT zostaje
  // po stronie governance — to osobna warstwa.
  //
  // To jest ta granica governance, o którą chodzi w D4: żyje tu, w warstwie 0,
  // i żaden layout nie ma jej u siebie powtarzać ani obchodzić.
  const authorizedTiles = useMemo(
    () => [
      ...tiles.filter((tile) => canAccessTile(authorized.apps, tile.id)),
      ...(canAccessTile(authorized.apps, COWORK_APP_CODE) ? coworkProjects.tiles : []),
    ],
    [authorized.apps, tiles, coworkProjects.tiles],
  )

  const searchedTiles = useMemo(
    () => authorizedTiles.filter((t) => matchesSearch(t, deferredQuery)),
    [authorizedTiles, deferredQuery],
  )

  const favoritesCount = useMemo(
    () => searchedTiles.filter((t) => favorites.includes(t.id)).length,
    [searchedTiles, favorites],
  )

  const visibleCategories = useMemo<CategoryTab[]>(() => {
    return categoryIdsForView(view)
      .map((id) => ({
        id,
        label: categoryLabel(view, id, tCommon),
        count: searchedTiles.filter((t) => tileBelongsTo(view, t, id)).length,
      }))
      .filter((c) => c.count > 0)
  }, [searchedTiles, view])

  const visibleTiles = useMemo<Tile[]>(() => {
    if (activeCategory === "all") return searchedTiles
    if (activeCategory === "favorites") {
      return searchedTiles.filter((t) => favorites.includes(t.id))
    }
    return searchedTiles.filter((t) => tileBelongsTo(view, t, activeCategory))
  }, [searchedTiles, activeCategory, favorites, view])

  const handleViewChange = (next: HeroView) => {
    setView(next)
    if (
      activeCategory !== "all" &&
      activeCategory !== "favorites" &&
      !categoryIdsForView(next).includes(activeCategory)
    ) {
      setActiveCategory("all")
    }
  }

  const handleClearFilters = () => {
    setSearchQuery("")
    setActiveCategory("all")
  }

  // Pusty string, a nie etykieta zastępcza: kafelek bez kategorii istnieje
  // realnie (`document-parser`, `visual-guru` — manifest bez pól
  // prezentacyjnych, plus każdy kafelek założony z UI), a `categoryFunctional`
  // jest tu nullowalne, inaczej niż na `main`, skąd ten kod przyszedł.
  const categoryTagFor = (tile: Tile): string => {
    if (view === "functional") {
      return tile.categoryFunctional ? categoryLabel(view, tile.categoryFunctional, tCommon) : ""
    }
    const first = tile.categoryDepartment[0]
    return first ? categoryLabel(view, first, tCommon) : ""
  }

  // Katalog jeszcze nie wrócił z GET /api/hub/tiles — bez tego pierwszy render
  // pokazywałby przez moment "Nie znaleziono aplikacji" (visibleTiles.length
  // === 0 podczas ładowania), nieodróżnialne od realnego braku wyników
  // wyszukiwania. `authorized`/HubGate już przepuściły tego usera (patrz
  // app-gate.tsx) — to tylko chwilowy stan sieci, nie decyzja o dostępie.
  const state = hub.isLoading ? "loading" : hub.isError ? "error" : "ready"

  return {
    tiles: visibleTiles,
    categories: visibleCategories,
    favorites,
    counts: {
      authorized: authorizedTiles.length,
      matching: searchedTiles.length,
      categories: visibleCategories.length,
      favorites: favoritesCount,
    },
    search: { value: searchQuery, set: setSearchQuery },
    view: { value: view, set: handleViewChange },
    activeCategory: { value: activeCategory, set: setActiveCategory },
    categoryTagFor,
    toggleFavorite,
    clearFilters: handleClearFilters,
    state,
  }
}
