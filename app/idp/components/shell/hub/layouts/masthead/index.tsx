"use client"

import { Button, EmptyState } from "@cortex/ui"
import { Search } from "lucide-react"
import { CategoryTabs } from "../../category-tabs"
import { TileCard } from "../../tile-card"
import type { HubLayoutProps } from "../../types"
import { Masthead } from "./masthead"

/**
 * Layout `masthead` — redesign huba Cezarego (`19e1dd2`), od E4 osiągalny:
 * wskazuje go preset `domino`, a przełącznik presetów jest w nagłówku.
 *
 * DO E3 BYŁO TO CIAŁO BEZ SKÓRY. Cherry-pick E0 wziął sześć plików `.tsx` i ani
 * jednej linii CSS, więc ~60 reguł ubierających ten DOM (`.ch-mast`, `.ch-tile`,
 * `.ch-tab`, `.ch-search`, `.ch-fav`, `.ch-empty`, `.ch-acc-*`, stagger i blok
 * `prefers-reduced-motion`) nie istniało na tej gałęzi. E4 wrócił po nie do
 * źródła i ROZŁOŻYŁ je na warstwy z D3 zamiast przepisać jeden do jednego:
 * kolor i metryki są tokenami `.skin-domino` (E2 + 22 tokeny dołożone tutaj),
 * struktura jest wariantami CVA w `hub/tile-card.tsx` i `hub/category-tabs.tsx`,
 * klatki kaskady są w `tailwind.config.ts`. Klas `ch-*` nie ma już ani jednej i
 * nie ma też ani jednej reguły CSS napisanej ręcznie — to jest miara tego, jak
 * dokładnie warstwy pokryły oryginał.
 *
 * Ten plik został przez to layoutem w ścisłym sensie: SAMĄ KOMPOZYCJĄ. Zakładki
 * i kafelki są wspólne z `classic` i różnią się wariantem; własny zostaje tylko
 * `Masthead`, bo tam DOM naprawdę jest inny (tytuł i szukajka w jednym rzędzie
 * zamiast wycentrowanych pod sobą) — czyli dokładnie ta przesłanka, dla której
 * D3 dopuszcza warstwę 3.
 */
export function MastheadHub({ model, variants }: HubLayoutProps) {
  return (
    <>
      <Masthead
        value={model.search.value}
        onChange={model.search.set}
        view={model.view.value}
        onViewChange={model.view.set}
        tileCount={model.counts.authorized}
        categoryCount={model.counts.categories}
      />
      <CategoryTabs
        totalCount={model.counts.matching}
        favoritesCount={model.counts.favorites}
        categories={model.categories}
        activeId={model.activeCategory.value}
        onSelect={model.activeCategory.set}
        variant={variants.tabs}
      />
      {/* Panel: górna krawędź, w którą wtapia się pasek zakładek (te mają
          ujemny margines dolny równy grubości ramki). Jedna sekcja dla obu
          stanów, bo krawędź należy do panelu, nie do siatki. */}
      <section className="border-t-token border-border pt-[22px]">
        {model.tiles.length === 0 ? (
          /* Bez `className` przemalowującego `EmptyState` od środka. U Cezarego
             sześć reguł `.ch-empty` sięgało w jego strukturę selektorami
             `> div:first-child`, `p:first-of-type` i `button` — czyli dokładnie
             ten wzorzec, przez który `app-shell` i `tile-menu` renderowały się
             bez tła poza `.cortex-chrome` (§1). Same tokeny dają tu ramkę
             kreskowaną atramentem, promień 2 px i przycisk w papierze; ginie
             amberowy kwadrat ikony i mono-wersaliki tytułu. To jest świadoma
             strata: odzyskanie ich należy do wariantu NA `EmptyState`, nie do
             selektora zgadującego jego wnętrze. */
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
          </div>
        )}
      </section>
    </>
  )
}
