import type { Tile } from "@/lib/tiles"
import type { CategoryTab } from "../category-tabs"
import type { HeroView } from "../hero-search"

/**
 * Re-eksport, żeby layout brał kontrakt STĄD, a nie z pliku drugiego layoutu.
 * Oba typy definiują dziś komponenty `classic` (`hero-search.tsx`,
 * `category-tabs.tsx`), ale opisują pola `HubModel`, więc należą do kontraktu,
 * nie do widoku. Bez tego `masthead` importuje z `../../../hero-search`, czyli
 * przeniesienie plików `classic` — a E4 je przenosi, do wariantów CVA — jest
 * zmianą dotykającą OBU layoutów. Dokładnie ten koszt wykładniczy, przed
 * którym D2 stawia D3 i D4.
 */
export type { CategoryTab, HeroView }

/** `"all" | "favorites"` to zakładki syntetyczne, reszta to id kategorii z
 *  aktywnego przekroju (`FUNCTIONAL_CATEGORIES` albo `DEPARTMENT_CATEGORIES`). */
export type ActiveCategory = "all" | "favorites" | string

/**
 * Liczniki są CZTERY, nie jeden, bo hub pokazuje dwie różne liczby kafelków
 * naraz i zgadzają się one tylko przy pustej szukajce: masthead mówi
 * "Narzędzia: N" o CAŁYM katalogu, do którego user ma grant (`authorized`), a
 * zakładka "Wszystkie N" o tym, co przeszło przez szukajkę (`matching`). Jeden
 * wspólny licznik w kontrakcie oznaczałby, że przy wpisanym zapytaniu jedna z
 * tych dwóch liczb jest cicho zła.
 */
export interface HubCounts {
  /** Kafelki z grantem, PRZED filtrem szukania — licznik w masthead. */
  authorized: number
  /** Kafelki po filtrze szukania — licznik zakładki "Wszystkie". */
  matching: number
  /** Kategorie z niezerową liczbą kafelków w bieżącym przekroju. */
  categories: number
  /** Ulubione wśród kafelków po filtrze szukania. */
  favorites: number
}

/**
 * Wszystko, czego layout huba potrzebuje, i nic ponadto — jedyne wejście,
 * jakie dostaje. Dane, dostęp i stan filtrów liczy `useHubModel()`; layout
 * ma je już policzone, więc drugi layout nie kopiuje logiki dostępu (D4).
 */
export interface HubModel {
  /** Już po `canAccessTile()`, szukaniu i wyborze kategorii — do renderu 1:1. */
  tiles: readonly Tile[]
  categories: readonly CategoryTab[]
  favorites: readonly string[]
  counts: HubCounts
  search: { value: string; set: (value: string) => void }
  view: { value: HeroView; set: (value: HeroView) => void }
  activeCategory: { value: ActiveCategory; set: (value: ActiveCategory) => void }
  /** Etykieta kategorii kafelka w bieżącym przekroju; `""` gdy brak. */
  categoryTagFor: (tile: Tile) => string
  toggleFavorite: (id: string) => void
  clearFilters: () => void
  state: "loading" | "error" | "ready"
}

/**
 * Kontrakt layoutu. `state` nie jest tu obsługiwany — ładowanie i błąd
 * rozstrzyga `authed-home.tsx` NAD layoutem, żeby nowy layout nie mógł ich
 * zapomnieć (i żeby nie było N kopii tych samych dwóch ekranów).
 */
export interface HubLayoutProps {
  model: HubModel
}
