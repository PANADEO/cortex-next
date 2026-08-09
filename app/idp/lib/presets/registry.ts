import type { HubLayoutId } from "@/components/shell/hub/registry"

/**
 * Preset to NAZWANA WIĄZKA trzech warstw z D3 — skinu (tokeny), wariantów
 * (CVA) i layoutu huba (rejestr) — a nie czwarta warstwa nad nimi. Wartość
 * jest w tym, że wiązka ma jedno imię: „Domino" znaczy jednocześnie papier,
 * chiclety i masthead, więc nie da się wybrać kombinacji, której nikt nigdy
 * nie widział.
 */
export type PresetId = "neutral" | "customs" | "domino"

/** Zakładki kategorii — podkreślenie (dziś) albo teczki wtapiające się w
 *  krawędź panelu (Domino). Konsument: CVA w E4. */
export type TabsVariant = "underline" | "folder"

/** Kafelek — karta z paletą admina (dziś) albo chiclet z akcentem z hasha
 *  kategorii (Domino, D6). Konsument: CVA w E4. */
export type TileVariant = "card" | "chiclet"

/**
 * Warianty są UNIAMI LITERAŁOWYMI, nie `string`, i to jest warunek konieczny
 * dla E4: `cva({ variants: { tile: { card: …, chiclet: … } } })` typuje się
 * po kluczach obiektu wariantów, więc `preset.variants.tile` musi być
 * przypisywalne do `VariantProps<typeof tileCard>["variant"]`. Przy `string`
 * E4 musiałby rzutować przy każdym użyciu albo trzymać drugą listę literałów
 * obok tej — czyli dokładnie ten rozjazd, którego preset ma nie dopuścić.
 */
export interface PresetVariants {
  tabs: TabsVariant
  tile: TileVariant
}

export interface Preset {
  id: PresetId
  label: string
  description: string
  /** Klasa nakładana na `<html>`; `""` znaczy „tokeny bazowe z `:root`",
   *  bo skin domyślny nie ma i nie ma mieć własnej klasy. */
  skin: string
  /** Klucz w `HUB_LAYOUTS`. Typ z rejestru, nie `string`: nowy preset nie
   *  skompiluje się, dopóki jego layout nie przejdzie kontraktu i nie wejdzie
   *  do rejestru (D3, warstwa 3). */
  hubLayout: HubLayoutId
  variants: PresetVariants
  /** Trzy kolory do podglądu w przełączniku — kolejność bez znaczenia
   *  semantycznego, to próbka, nie mapowanie na `--chart-1..3`. */
  swatch: readonly [string, string, string]
}

/**
 * `customs` jest w tym rejestrze mimo że §4 wymienia tylko `neutral` i
 * `domino`. Powód jest konkretny, nie porządkowy: `.skin-customs` +
 * `.skin-customs.dark` to komplet 30 tokenów żywy w `globals.css` i wybieralny
 * dziś z nagłówka, a §5b odnotowuje, że po wycofaniu `ef85991` znowu realnie
 * przemalowuje hub i powłokę. Rejestr bez tego wpisu znaczyłby, że E3 kasuje
 * działający skin — każdy, kto ma w przeglądarce `cortex.skin: customs`,
 * dostałby przemalowanie aplikacji przy wdrożeniu kroku opisanego jako
 * niewidoczny. Preset opisuje go bez jednej linii nowego CSS: skin `customs`,
 * layout `classic`, warianty domyślne.
 *
 * Odrzucone: zostawić `skin-store.ts` obok presetów wyłącznie dla Customs.
 * Dwa równoległe źródła klasy `.skin-*` na tym samym `documentElement` to
 * wyścig o ostatni `classList.toggle()`, a preset przestaje być wiązką, skoro
 * skin można ustawić poza nim.
 */
export const PRESETS: Readonly<Record<PresetId, Preset>> = {
  neutral: {
    id: "neutral",
    label: "Neutral",
    description: "Monochrome shadcn defaults.",
    skin: "",
    hubLayout: "classic",
    variants: { tabs: "underline", tile: "card" },
    swatch: ["#0a0a0a", "#f5f5f5", "#a3a3a3"],
  },
  customs: {
    id: "customs",
    label: "Customs",
    description: "Hi-vis orange + duty-green.",
    skin: "skin-customs",
    hubLayout: "classic",
    variants: { tabs: "underline", tile: "card" },
    swatch: ["#f97316", "#15803d", "#fbbf24"],
  },
  domino: {
    id: "domino",
    label: "Domino",
    description: "Papier i atrament, twarde krawędzie.",
    skin: "skin-domino",
    hubLayout: "masthead",
    variants: { tabs: "folder", tile: "chiclet" },
    swatch: ["#d9a441", "#1f6e6b", "#b85c38"],
  },
}

/**
 * Preset wybierany, gdy nikt nie wybrał innego — i JEDYNY sposób, w jaki
 * `domino` jest dziś osiągalne. To jest świadomie stan przejściowy: §6 stawia
 * w E3 „SkinToggle → PresetToggle", ale dwa zmierzone fakty sprawiają, że
 * Domino wybieralne z UI byłoby dziś regresją, a nie funkcją.
 *
 * 1. `masthead` NIE MA CSS. Cherry-pick E0 wziął sześć plików `.tsx` i zero
 *    arkusza, więc `.ch-mast`, `.ch-tile`, `.ch-tab` i ~60 reguł siostrzanych
 *    nie istnieją na tej gałęzi (§5c). Preset `domino` renderowałby hub bez
 *    obramowań, pól ikon i chromu zakładek.
 * 2. Domino na `classic` jest widocznie w połowie nałożone. Skin nadpisuje
 *    `--radius-sm/md/lg`, a klasyczny kafelek stoi na `rounded-xl`; do tego
 *    `--border-width` grubieje globalnie, a nadpisanych jest 8 z 30 tokenów
 *    palety, więc `--input`, `--ring` i wszystkie `--sidebar-*` dają
 *    podwojone blade ramki na kremowej stronie (§5d).
 *
 * Dlatego przełącznika NIE MA i nie należy go „dokończyć" osobno: E4 dopisuje
 * CSS Domino i wypuszcza przełącznik jednym ruchem. Do tego czasu mechanizm
 * jest kompletny i sprawdzalny przez podmianę tej jednej stałej.
 */
export const DEFAULT_PRESET: PresetId = "neutral"

/** `Object.hasOwn`, nie `in`: `"toString" in PRESETS` jest prawdą przez
 *  prototyp, więc `in` przepuściłby wartość z serwera, która presetem nie
 *  jest, i `PRESETS[id]` dałoby `undefined` w miejscu typowanym na `Preset`. */
export function isPresetId(value: unknown): value is PresetId {
  return typeof value === "string" && Object.hasOwn(PRESETS, value)
}

/**
 * Pozycja „użyj domyślnej instancji" — NIE preset, tylko wybór BRAKU wyboru.
 * Store potrafi trzymać `null` („user nic nie wybrał", żeby preset instancji
 * z E5 miał jak wygrać), ale sama możliwość reprezentowania tego stanu jest
 * bezużyteczna, jeśli z UI nie da się do niego WRÓCIĆ: pierwsze kliknięcie w
 * przełączniku byłoby wtedy drzwiami w jedną stronę i wartość instancji nigdy
 * już nie dosięgłaby tego użytkownika. Dlatego pozycja stoi w kontrakcie
 * teraz, razem z typem — dopisana po fakcie znaczyłaby migrację danych.
 *
 * Identyfikator jest stringiem, a nie `null`, bo `SkinToggle` z `@cortex/ui`
 * ma `T extends string`; `PRESET_CHOICES` jest przez to strukturalnie
 * `SkinOption<PresetChoiceId>[]` i E4 podaje ją do przełącznika bez adaptera.
 */
export const INSTANCE_DEFAULT_ID = "instance-default"

export type PresetChoiceId = PresetId | typeof INSTANCE_DEFAULT_ID

export interface PresetChoice {
  id: PresetChoiceId
  label: string
  description: string
  swatch: readonly [string, string, string]
}

/** Trzy szarości, nie próbka Neutrala: pozycja ma znaczyć „dziedziczę", a nie
 *  „wybieram konkretny wygląd", którego i tak nie da się pokazać, dopóki E5
 *  nie poda presetu instancji. */
const INSTANCE_DEFAULT_CHOICE: PresetChoice = {
  id: INSTANCE_DEFAULT_ID,
  label: "Domyślny instancji",
  description: "Wygląd ustawiony dla tej instancji.",
  swatch: ["#a3a3a3", "#a3a3a3", "#a3a3a3"],
}

/** Lista dla przełącznika presetów z E4 — pozycja „dziedzicz" na początku,
 *  potem presety w kolejności z rejestru. */
export const PRESET_CHOICES: readonly PresetChoice[] = [
  INSTANCE_DEFAULT_CHOICE,
  ...Object.values(PRESETS).map(({ id, label, description, swatch }) => ({
    id,
    label,
    description,
    swatch,
  })),
]

/** Wybór z przełącznika → wartość dla `setPreset()`. */
export function presetChoiceToStored(choice: PresetChoiceId): PresetId | null {
  return isPresetId(choice) ? choice : null
}

/** Wartość ze store'a → pozycja zaznaczona w przełączniku. */
export function storedToPresetChoice(preset: PresetId | null): PresetChoiceId {
  return preset ?? INSTANCE_DEFAULT_ID
}

/**
 * Źródła presetu w kolejności z §4. Typy są `string`, a nie `PresetId`, celowo
 * — E5 podaje tu wartości Z BAZY (`system-config` i `user_preferences`),
 * których nikt nie waliduje po drodze, a preset skasowany z rejestru zostawia
 * w tabelach martwe identyfikatory.
 */
export interface PresetSources {
  /** Domyślny preset instancji. E5: `system-config`. Dziś zawsze brak. */
  instance?: string | null | undefined
  /** Wybór użytkownika. Dziś: store lokalny. E5: `user_preferences`. */
  user?: string | null | undefined
}

/**
 * Instancja ustawia domyślny, użytkownik może nadpisać, a gdy nie ma ani
 * jednego — `DEFAULT_PRESET`. Funkcja jest czysta i to jest cała jej wartość:
 * E5 wymienia to, CO wpada do argumentów, nie sposób rozstrzygania, i może
 * przetestować pierwszeństwo bez montowania Reacta.
 *
 * Otwarte w projekcie (§Otwarte) i celowo NIEROZSTRZYGNIĘTE tutaj: wariant
 * „instancja ustawia i user nie może zmienić". Wymaga trzeciego źródła
 * (blokady), nie zmiany tej kolejności — dopisanie go E5 kosztuje jedno pole
 * w `PresetSources` i jeden `if` na górze.
 */
export function resolvePresetId({ instance, user }: PresetSources): PresetId {
  if (isPresetId(user)) return user
  if (isPresetId(instance)) return instance
  return DEFAULT_PRESET
}
