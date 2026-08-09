"use client"

import { Button, EmptyState } from "@cortex/ui"
import { Search } from "lucide-react"
import { CategoryTabs } from "../../category-tabs"
import { TileCard } from "../../tile-card"
import type { HubLayoutProps } from "../../types"
import { HeroSearch } from "./hero-search"

/**
 * Layout `classic` — hub sprzed redesignu Cezarego, markup 1:1 z `return (...)`
 * z `tile-grid.tsx` na `b7ba35e`. Cała różnica względem tamtego pliku to źródło
 * danych: przychodzą propsem z `useHubModel()`, zamiast być liczone na miejscu.
 *
 * To NIE jest layout do zastąpienia — D2 przyjmuje dwa layouty huba w
 * utrzymaniu na stałe, a `classic` jest tym, który zostaje domyślny dla
 * instancji bez presetu Domino. E0 podmienił go w miejscu (cherry-pick
 * `19e1dd2` zamiast dołożenia wariantu); tutaj wraca, a markup Domino stoi
 * obok jako `layouts/masthead/`.
 *
 * Reguła dla WSZYSTKICH plików pod `layouts/`: żadnego importu z
 * `@cortex/api` ani z `@/lib/tiles` poza typem — dane i dostęp liczy
 * wyłącznie warstwa 0. Pilnuje tego `no-restricted-imports` w `.eslintrc.cjs`,
 * nie sama dobra wola.
 *
 * `variants` idą PROSTO Z PROPSÓW do komponentów warstwy 2, bez sprawdzania,
 * co w nich jest. Layout nie ma prawa wiedzieć, że `classic` „jest od kart":
 * gdyby zaszył `variant="card"`, preset łączący ten układ z chicletami stałby
 * się niewyrażalny, a `PresetVariants` — martwą daną.
 */
export function ClassicHub({ model, variants }: HubLayoutProps) {
  return (
    <>
      <HeroSearch
        value={model.search.value}
        onChange={model.search.set}
        view={model.view.value}
        onViewChange={model.view.set}
      />
      <CategoryTabs
        totalCount={model.counts.matching}
        favoritesCount={model.counts.favorites}
        categories={model.categories}
        activeId={model.activeCategory.value}
        onSelect={model.activeCategory.set}
        variant={variants.tabs}
      />
      {model.tiles.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nie znaleziono aplikacji"
          description="Spróbuj zmienić zapytanie lub wyczyścić filtry."
          action={
            <Button variant="outline" size="sm" onClick={model.clearFilters}>
              Wyczyść filtry
            </Button>
          }
        />
      ) : (
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {model.tiles.map((tile, index) => (
            <TileCard
              key={tile.id}
              tile={tile}
              isFavorite={model.favorites.includes(tile.id)}
              onToggleFavorite={model.toggleFavorite}
              variant={variants.tile}
              index={index}
              categoryTag={model.categoryTagFor(tile)}
            />
          ))}
        </section>
      )}
    </>
  )
}
