import type { PresetVariants } from "@/lib/presets/registry"
import type { Tile } from "@/lib/tiles"

/**
 * Oba typy DEKLAROWANE tutaj, a nie re-eksportowane z komponentów, które ich
 * używają. Do E3 stały w `hero-search.tsx` i `category-tabs.tsx`, a kontrakt je
 * tylko podawał dalej — i E4 pokazał, dlaczego to nie mogło zostać: oba pliki
 * właśnie się przeniosły (jeden do `layouts/classic/`, drugi do `hub/` jako
 * wariant CVA), więc każdy import przez nie prowadzący byłby zmianą dotykającą
 * obu layoutów naraz. Kierunek jest teraz jeden: widok czyta kontrakt, kontrakt
 * nie wie o widoku.
 */
export interface CategoryTab {
  id: string
  label: string
  count: number
}

/** Przekrój, w którym hub grupuje kafelki. */
export type HeroView = "functional" | "department"

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
 *
 * `variants` to warstwa 2 z D3, podawana layoutowi Z ZEWNĄTRZ i to jest cała
 * różnica między trzema warstwami a dwiema. Layout, który zaszywa sobie
 * `variant="chiclet"`, sprowadza wariant do własności layoutu — a wtedy pole
 * `variants` w presecie jest martwą daną i nie da się nigdy złożyć presetu
 * „ten układ, inne kafelki" bez pisania trzeciego layoutu.
 *
 * Import typu z `lib/presets/registry` domyka cykl W GRAFIE TYPÓW (preset zna
 * `HubLayoutId` z rejestru huba). Jest to cykl wyłącznie typowy — `import type`
 * znika w kompilacji, a ten plik nie emituje ani jednej instrukcji — więc w
 * grafie modułów runtime'u krawędzi nie ma. Odwrotny kierunek (warianty
 * deklarowane tutaj, preset je importuje) byłby czystszy w grafie, ale
 * przeniósłby publiczną nazwę `PresetVariants` do pliku o kontrakcie huba,
 * gdzie znaczy mniej.
 */
export interface HubLayoutProps {
  model: HubModel
  variants: PresetVariants
}
