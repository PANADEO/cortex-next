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
 * Kategoria funkcjonalna → akcent, ROZPISANE RĘCZNIE. Pięć kategorii w trzy
 * akcenty nie wchodzi, więc dwie kolizje są nieuniknione; jedyne, co da się
 * wybrać, to KTÓRE — i to jest decyzja, nie wynik.
 *
 * DLACZEGO NIE HASH. Do 08.08.2026 akcent liczyła suma kodów znaków kategorii
 * modulo trzy. Zmierzone na tym kodzie: `agents`→1, `content-generation`→2,
 * `admin-system`→2, `research`→3, `misc`→3 — czyli hash sparował
 * `content-generation` z `admin-system`, DWIE NAJWIĘKSZE kategorie po
 * `misc`. Na instancji, która ma dziś włączone 7 kafelków (4×
 * `content-generation`, 2× `admin-system`, 1× `research`), dawało to SZEŚĆ
 * KAFELKÓW NA SIEDEM w tym samym tealu — siatka wyglądała na jednokolorową,
 * mimo że test pilnował, że wszystkie trzy akcenty są w użyciu (były, na
 * pełnym katalogu). Hash z innym ziarnem tego nie naprawia: rozstrzyga
 * o kolizji przypadkiem, więc następna instancja trafia na inną parę.
 *
 * REGUŁA, WEDŁUG KTÓREJ ROZPISANO MAPĘ: kategorie niosące NAJWIĘCEJ kafelków
 * dostają różne akcenty, a kolizje spadają na najmniejsze. Rozkład zliczony
 * z manifestów w tym repo — czyli z katalogu, od którego zaczyna KAŻDA
 * instancja, nie z jednej bazy:
 *
 *   grep -rho 'categoryFunctional: *"[a-z-]*"' --include='*manifest.ts' app/idp \
 *     | sort | uniq -c | sort -rn
 *
 * `content-generation` 9, `misc` 6, `admin-system` 3, `agents` 2,
 * `research` 1. Ta sama kolejność wychodzi z rejestru `applications` na
 * żywej bazie (10/6/3/2/1). Trzy największe idą więc na trzy różne akcenty,
 * a dwie najmniejsze dosiadają się do większych.
 *
 * Glob to `*manifest.ts`, nie `*.manifest.ts`, i ta jedna kropka zmienia
 * wynik: manifesty żyją w DWÓCH konwencjach nazewniczych — `manifest.ts` obok
 * strony kafelka (12 plików) i `<id>.manifest.ts` w `lib/ai-tools/manifests/`
 * (9 plików + `ai-tools` samo). Węższy glob widzi wyłącznie tę drugą rodzinę
 * i daje 7/1/1, czyli ranking, z którego wyszłaby INNA mapa.
 *
 * Uboczna własność, warta odnotowania przy wdrożeniu: wobec hasha zmieniają
 * kolor WYŁĄCZNIE `content-generation` (2→1) i `agents` (1→2). Pozostałe trzy
 * kategorie zostają tam, gdzie były, więc katalog nie przemalowuje się cały.
 *
 * ODRZUCONE: przeczytać pod Dominem `applications.color` (11-kolorowa paleta
 * admina) zamiast akcentu. To jest wywrócenie D6, nie poprawka — Domino ma
 * trzy kolory i ani jednego więcej, a paleta admina wróciłaby wtedy na hub
 * jako jedenaście wypełnień kwadratu ikony. Kłamiący suwak koloru w panelu
 * zamyka się tam, gdzie powstał: w panelu (patrz `presetUsesApplicationColor`
 * w `lib/presets/registry.ts`).
 *
 * `Record<TileCategoryFunctional, Accent>` jest tu ZAMIAST mapy z opcjonalnym
 * kluczem celowo: szósta kategoria dopisana do unii nie skompiluje się,
 * dopóki ktoś nie rozstrzygnie, z kim ma dzielić akcent.
 */
const CATEGORY_ACCENT: Readonly<Record<TileCategoryFunctional, Accent>> = {
  "content-generation": 1,
  agents: 2,
  "admin-system": 2,
  misc: 3,
  research: 3,
}

/**
 * Akcent kafelka. Ta sama kategoria zawsze dostaje ten sam kolor, więc siatka
 * czyta się jak pogrupowana.
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
 * neutralnością. Który to numer, nie ma znaczenia porządkowego — kafelek bez
 * kategorii i tak wygląda jak członek JAKIEJŚ kategorii, bo czwartego akcentu
 * nie ma; zostaje 1, bo tak było przed rozpisaniem mapy.
 *
 * Historycznie (defekt B1) kategoria ustawiona przez admina wracała do wartości
 * z seeda przy każdym wdrożeniu, więc kafelek zmieniał akcent po deployu bez
 * żadnej zmiany tutaj. NAPRAWIONE w K3 (`df5d171`) usunięciem statycznej listy
 * `APPLICATIONS` — to ona nadpisywała pięć kolumn hub-renderu bezwarunkowo.
 * Zostawiam wzmiankę, bo to jedyny sposób, w jaki ten plik może dać wynik
 * wyglądający na losowy, i warto wiedzieć, gdzie NIE szukać.
 */
export function accentFor(category: TileCategoryFunctional | null): Accent {
  if (!category) return 1
  return CATEGORY_ACCENT[category]
}
