"use client"

import { canAccessAiTool, isAiToolId } from "@/lib/ai-tools/app-codes"
import { useCoworkProjectTiles } from "@/features/cortex-cowork"
import { useFavoritesStore } from "@/lib/stores/favorites-store"
import {
  canAccessTile,
  COWORK_APP_CODE,
  DEPARTMENT_CATEGORIES,
  FUNCTIONAL_CATEGORIES,
  TILES,
  type Tile,
  type TileHrefOverrides,
} from "@/lib/tiles"
import { useAuthorizedApps } from "@cortex/api"
import { Button, EmptyState } from "@cortex/ui"
import { Search } from "lucide-react"
import { useDeferredValue, useMemo, useState } from "react"
import { CategoryTabs, type CategoryTab } from "./category-tabs"
import { HeroSearch, type HeroView } from "./hero-search"
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

  const tiles = useMemo(
    () =>
      TILES.map((tile) => {
        const href = tileHrefOverrides?.[tile.id]
        return href ? { ...tile, href } : tile
      }),
    [tileHrefOverrides],
  )

  // Kafelki code-backed filtruje grant z `applications` (własny Postgres, przez
  // /api/me/access). Kafelki task-chat nie mają tam własnego wiersza — płyną z
  // governance store, który zna WYŁĄCZNIE role per projekt i o grant
  // `cortex-cowork` nie pyta w ogóle. Dlatego SEKCJĘ bramkuje tu ten sam kod,
  // którego na trasie pilnuje <AppGate tileId={COWORK_APP_CODE}>: bez tego user
  // bez grantu widział na hubie kafelki, które trasa i tak odmawia. Filtrowanie
  // PER PROJEKT zostaje po stronie governance — to osobna warstwa.
  const authorizedTiles = useMemo(
    () => [
      ...tiles.filter((tile) =>
        isAiToolId(tile.id)
          ? canAccessAiTool(authorized.apps, tile.id)
          : authorized.apps.includes(tile.id),
      ),
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
