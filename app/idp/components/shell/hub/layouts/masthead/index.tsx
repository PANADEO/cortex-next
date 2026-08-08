"use client"

import { Button, EmptyState } from "@cortex/ui"
import { Search } from "lucide-react"
import type { HubLayoutProps } from "../../types"
import { Masthead } from "./masthead"
import { TileChiclet } from "./tile-chiclet"
import { WorkspaceTabs } from "./workspace-tabs"

/**
 * Layout `masthead` — redesign huba Cezarego (`19e1dd2`), zaparkowany co do
 * elementu. NIEOSIĄGALNY do E3: `DEFAULT_HUB_LAYOUT` wskazuje `classic`, a
 * presetu, który mógłby wskazać ten, jeszcze nie ma.
 *
 * Dlaczego stoi tu już teraz, skoro nikt go nie renderuje: E0 wniósł ten DOM
 * PODMIENIAJĄC hub zamiast dokładając wariant, więc jedyna alternatywa dla
 * zaparkowania go było skasowanie i odtwarzanie w E4 z `git show`. E4 ma go
 * dopracować (warianty CVA, `accent.ts`, wyjście z klas `ch-*` na tokeny), nie
 * rekonstruować.
 *
 * TO JEST CIAŁO BEZ SKÓRY i trzeba to nazwać wprost: cherry-pick E0
 * (`7e841e6`) wziął sześć plików `.tsx` i ani jednej linii CSS, więc z
 * designu Domino przeniesiony jest WYŁĄCZNIE ten DOM. Około sześćdziesięciu
 * reguł, które go ubierają — `.ch-mast`, `.ch-tile`, `.ch-tab`, `.ch-search`,
 * `.ch-fav`, `.ch-empty`, `.ch-acc-*`, tokeny `--ch-*` w `:root`/`.dark` oraz
 * blok `prefers-reduced-motion` — nie istnieje na tej gałęzi w ogóle i NIE
 * powstanie w E2: skin to wyłącznie wartości, ani jednej reguły układu
 * (D3/D8). E4 musi po nie wrócić do `19e1dd2:libs/@cortex/styles/globals.css`
 * i przełożyć je na warianty CVA plus tokeny — nie ma tu czego „dopolerować".
 *
 * Dlatego ten layout renderuje się nieostylowany i takie jest oczekiwanie.
 * Zawinięcia `.cortex-home`/`.ch-scope`, którymi Cezary zakresował tamte
 * reguły, zostały zdjęte z `authed-home.tsx` — uzasadnienie tam, przy
 * miejscu, z którego zniknęły.
 *
 * Trzy komponenty obok (`Masthead`, `WorkspaceTabs`, `TileChiclet`) to
 * odpowiedniki `HeroSearch`/`CategoryTabs`/`TileCard` z `classic`. Są layoutu,
 * nie wspólne, bo ich DOM nie pokrywa się ani jednym elementem — wspólny
 * komponent musiałby brać sumę propsów obu layoutów i rozgałęziać się w
 * środku, czyli być wariantem CVA przed czasem. To jest robota E4.
 */
export function MastheadHub({ model }: HubLayoutProps) {
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
      <div className="ch-workspace">
        <WorkspaceTabs
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
              <TileChiclet
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
