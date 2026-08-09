import type { TileCategoryFunctional } from "@/lib/tiles"

/**
 * Jeden z trzech akcentów Domino, wyrażony NUMEREM tokena `--chart-1..3`
 * (D6), a nie nazwą koloru. Wersja Cezarego zwracała przyrostki klas
 * (`amber`/`teal`/`terracotta`), przez co nazwa koloru siedziała w trzech
 * miejscach naraz: w CSS-ie, w typie i w klasie na kafelku — i żaden inny
 * skin nie mógł tych akcentów przemalować, bo „amber" znaczyło amber.
 */
export type Accent = 1 | 2 | 3

/**
 * Deterministyczny akcent kafelka: suma kodów znaków kategorii funkcjonalnej
 * modulo trzy. Ta sama kategoria zawsze dostaje ten sam kolor, więc siatka
 * czyta się jak pogrupowana, mimo że nikt kolorów nie przydzielał ręcznie.
 *
 * `null` jest wejściem REALNYM, nie defensywą, i to jest jedyny powód, dla
 * którego ta funkcja w ogóle ma warunek na wejściu: `document-parser` i
 * `visual-guru` to zwykłe kafelki huba na standardowej instancji, a ich
 * manifesty nie niosą pól prezentacyjnych (§5b) — do tego każdy kafelek
 * założony z panelu startuje bez kategorii. Wersja z `main` brała `string`
 * i wołała `.length` wprost, bo tam kategoria płynęła ze statycznej listy;
 * przeniesiona bez zmian rzucałaby TypeError na świeżej instancji.
 *
 * Akcent 1, a nie „brak akcentu": kwadrat ikony jest w tym wariancie
 * wypełnieniem, więc kafelek bez koloru byłby dziurą w siatce, nie
 * neutralnością.
 *
 * OSTRZEŻENIE OPERACYJNE (§5a, defekt B1): kategoria ustawiona przez admina
 * wraca dziś do wartości z seeda przy każdym wdrożeniu, więc kafelek potrafi
 * zmienić akcent po deployu bez żadnej zmiany tutaj. Przyczyna siedzi w
 * `seed-system-config.mjs`, nie w tym pliku.
 */
export function accentFor(category: TileCategoryFunctional | null): Accent {
  if (!category) return 1
  let hash = 0
  for (let i = 0; i < category.length; i++) {
    hash = (hash + category.charCodeAt(i)) % 3
  }
  return (hash + 1) as Accent
}
