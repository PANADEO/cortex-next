"use client"

import { useCoworkProjectTiles } from "@/features/cortex-cowork"
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
import { Button, EmptyState, LoadingState } from "@cortex/ui"
import { Search } from "lucide-react"
import { useDeferredValue, useMemo, useState } from "react"
import { CategoryTabs, type CategoryTab } from "./category-tabs"
import { HeroSearch, type HeroView } from "./hero-search"
import { hubApplicationsToTiles } from "./hub-tile"
import { TileCard } from "./tile-card"

type ActiveCategory = "all" | "favorites" | string

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

function categoryLabel(view: HeroView, id: string): string {
  const source = view === "functional" ? FUNCTIONAL_CATEGORIES : DEPARTMENT_CATEGORIES
  return source.find((c) => c.id === id)?.label ?? id
}

function tileBelongsTo(view: HeroView, tile: Tile, categoryId: string): boolean {
  if (view === "functional") return tile.categoryFunctional === categoryId
  return tile.categoryDepartment.includes(categoryId as Tile["categoryDepartment"][number])
}

interface TileGridProps {
  tileHrefOverrides?: TileHrefOverrides | undefined
}

export function TileGrid({ tileHrefOverrides }: TileGridProps = {}) {
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

  const tiles = useMemo(() => {
    const mapped = hubApplicationsToTiles(hub.tiles)
    if (!tileHrefOverrides) return mapped
    return mapped.map((tile) => {
      const href = tileHrefOverrides[tile.id]
      return href ? { ...tile, href } : tile
    })
  }, [hub.tiles, tileHrefOverrides])

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
        label: categoryLabel(view, id),
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

  // Katalog jeszcze nie wrócił z GET /api/hub/tiles — bez tego pierwszy render
  // pokazywałby przez moment "Nie znaleziono aplikacji" (visibleTiles.length
  // === 0 podczas ładowania), nieodróżnialne od realnego braku wyników
  // wyszukiwania. `authorized`/HubGate już przepuściły tego usera (patrz
  // app-gate.tsx) — to tylko chwilowy stan sieci, nie decyzja o dostępie.
  if (hub.isLoading) {
    return <LoadingState label="Wczytywanie aplikacji…" />
  }

  if (hub.isError) {
    return (
      <EmptyState
        icon={Search}
        title="Nie udało się wczytać aplikacji"
        description="Spróbuj odświeżyć stronę. Jeśli problem się powtarza, sprawdź połączenie z bazą danych."
      />
    )
  }

  return (
    <>
      <HeroSearch
        value={searchQuery}
        onChange={setSearchQuery}
        view={view}
        onViewChange={handleViewChange}
      />
      <CategoryTabs
        totalCount={searchedTiles.length}
        favoritesCount={favoritesCount}
        categories={visibleCategories}
        activeId={activeCategory}
        onSelect={setActiveCategory}
      />
      {visibleTiles.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nie znaleziono aplikacji"
          description="Spróbuj zmienić zapytanie lub wyczyścić filtry."
          action={
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              Wyczyść filtry
            </Button>
          }
        />
      ) : (
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleTiles.map((tile) => (
            <TileCard
              key={tile.id}
              tile={tile}
              isFavorite={favorites.includes(tile.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </section>
      )}
    </>
  )
}
