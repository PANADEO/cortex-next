"use client"

import { Button, EmptyState } from "@cortex/ui"
import { Search } from "lucide-react"
import { CategoryTabs } from "../../../category-tabs"
import { HeroSearch } from "../../../hero-search"
import { TileCard } from "../../../tile-card"
import type { HubLayoutProps } from "../../types"

/**
 * Layout `classic` — markup huba w kształcie 1:1 z tym, co do tej pory
 * renderował `tile-grid.tsx`. Cała różnica względem tamtego pliku to źródło
 * danych: przychodzą propsem z `useHubModel()`, zamiast być liczone na
 * miejscu.
 *
 * Reguła dla WSZYSTKICH plików pod `layouts/`: żadnego importu z
 * `@cortex/api` ani z `@/lib/tiles` poza typem — dane i dostęp liczy
 * wyłącznie warstwa 0. Pilnuje tego `no-restricted-imports` w `.eslintrc.cjs`,
 * nie sama dobra wola.
 */
export function ClassicHub({ model }: HubLayoutProps) {
  return (
    <>
      <HeroSearch
        value={model.search.value}
        onChange={model.search.set}
        view={model.view.value}
        onViewChange={model.view.set}
        tileCount={model.counts.authorized}
        categoryCount={model.counts.categories}
      />
      <div className="ch-workspace">
        <CategoryTabs
          totalCount={model.counts.matching}
          favoritesCount={model.counts.favorites}
          categories={model.categories}
          activeId={model.activeCategory.value}
          onSelect={model.activeCategory.set}
        />
        {model.tiles.length === 0 ? (
          <section className="ch-panel">
            <EmptyState
              icon={Search}
              title="Nie znaleziono aplikacji"
              description="Spróbuj zmienić zapytanie lub wyczyścić filtry."
              className="ch-empty"
              action={
                <Button variant="outline" size="sm" onClick={model.clearFilters}>
                  Wyczyść filtry
                </Button>
              }
            />
          </section>
        ) : (
          <section className="ch-panel ch-grid grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {model.tiles.map((tile, index) => (
              <TileCard
                key={tile.id}
                tile={tile}
                isFavorite={model.favorites.includes(tile.id)}
                onToggleFavorite={model.toggleFavorite}
                categoryTag={model.categoryTagFor(tile)}
                index={index}
              />
            ))}
          </section>
        )}
      </div>
    </>
  )
}
