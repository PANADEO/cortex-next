import type { HubLayoutId } from "@/components/shell/hub/registry"

/**
 * Preset to NAZWANA WIĄZKA trzech warstw z D3 — skinu (tokeny), wariantów
 * (CVA) i layoutu huba (rejestr) — a nie czwarta warstwa nad nimi. Wartość
 * jest w tym, że wiązka ma jedno imię: „Domino" znaczy jednocześnie papier,
 * chiclety i masthead, więc nie da się wybrać kombinacji, której nikt nigdy
 * nie widział.
 */
export type PresetId = "neutral" | "customs" | "domino"

/** Zakładki kategorii — podkreślenie albo teczki wtapiające się w krawędź
 *  panelu (Domino). Konsument: `hub/category-tabs.tsx`. */
export type TabsVariant = "underline" | "folder"

/** Kafelek — karta z paletą admina albo chiclet z akcentem rozpisanym po
 *  kategorii funkcjonalnej (Domino, D6). Konsument: `hub/tile-card.tsx`. */
export type TileVariant = "card" | "chiclet"

/**
 * Powłoka — sidebar, topbar i stopka. `plain` to krawędź włosowa i zaokrąglony
 * stan aktywny; `ruled` to 2-pikselowe linie atramentem, monospace'owe
 * etykiety sekcji i stan aktywny jako wypełnienie akcentem.
 *
 * Nazwa opisuje KSZTAŁT, nie preset — tak samo jak `card`/`chiclet` i
 * `underline`/`folder`. Wariant nazwany `domino` związałby warstwę 2 z jedną
 * wiązką i zabił sens rozdzielenia: czwarty preset ma prawo chcieć `ruled` bez
 * reszty Domina. „Rule" to zresztą typograficzna nazwa tych linii.
 *
 * DLACZEGO TO JEST WARSTWA 2, MIMO ŻE NAGŁÓWEK `app-shell.tsx` TWIERDZIŁ
 * INACZEJ. Tamten komentarz wnioskował z faktu, że `ef85991` nie zmienił DOM-u
 * ani o jeden element, iż „cały chrome wyraża się samymi wartościami tokenów".
 * Wniosek był za szeroki: tamten commit zmieniał też grubość krawędzi (2px
 * zamiast 1px), krój i wersaliki etykiet, oraz twardy cień `2px 2px 0` przy
 * hoverze pola szukania — a to są decyzje o kształcie, których żadna wartość
 * tokena nie wyrazi. Kolory faktycznie zostały na warstwie 1 i ten plik ich
 * nie dotyka; dochodzi wyłącznie kształt.
 *
 * Konsumenci: `@cortex/ui` (`app-shell`, `tile-menu`), `components/topbar.tsx`.
 */
export type ShellVariant = "plain" | "ruled"

/**
 * Warianty są UNIAMI LITERAŁOWYMI, nie `string`, i E4 potwierdził, po co:
 * `cva({ variants: { variant: { card: …, chiclet: … } } })` typuje się po
 * kluczach tabeli wariantów, więc `preset.variants.tile` wchodzi tam wprost,
 * bez rzutowania i bez drugiej listy literałów obok tej. Wartość jedzie z
 * presetu do komponentu przez `HubLayoutProps.variants` — layout jej nie
 * interpretuje, tylko podaje dalej.
 */
export interface PresetVariants {
  tabs: TabsVariant
  tile: TileVariant
  shell: ShellVariant
}

export interface Preset {
  id: PresetId
  /** Nazwa własna wyglądu — NIE tłumaczona, tak samo w każdym języku. */
  label: string
  /** KLUCZ z przestrzeni `common`, nie napis: opis presetu pokazuje się
   *  w przełączniku w nagłówku i na ekranie Wygląd, więc musi iść za językiem. */
  descriptionKey: string
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
    descriptionKey: "presets.neutralDescription",
    skin: "",
    hubLayout: "classic",
    variants: { tabs: "underline", tile: "card", shell: "plain" },
    swatch: ["#0a0a0a", "#f5f5f5", "#a3a3a3"],
  },
  customs: {
    id: "customs",
    label: "Customs",
    descriptionKey: "presets.customsDescription",
    skin: "skin-customs",
    hubLayout: "classic",
    variants: { tabs: "underline", tile: "card", shell: "plain" },
    swatch: ["#f97316", "#15803d", "#fbbf24"],
  },
  domino: {
    id: "domino",
    label: "Domino",
    descriptionKey: "presets.dominoDescription",
    skin: "skin-domino",
    hubLayout: "masthead",
    variants: { tabs: "folder", tile: "chiclet", shell: "ruled" },
    swatch: ["#d9a441", "#1f6e6b", "#b85c38"],
  },
}

/**
 * Czy ten wygląd maluje ikonę kafelka 11-kolorową paletą admina
 * (`applications.color`), czy własnym akcentem. Pyta o to formularz Aplikacji
 * w Konfiguracji Systemu: pod Dominem paleta jest z założenia bezwładna (D6 —
 * trzy akcenty i ani jeden więcej), a kontrolka, która zapisuje wartość i
 * niczego nie zmienia, to defekt panelu, nie wyglądu.
 *
 * Predykat pyta o WARIANT KAFELKA, nie o `preset.id`, bo rozstrzyga o tym
 * jedna ZMIENNA DECYZYJNA w `components/shell/hub/tile-card.tsx` — `isChiclet`
 * — czytana w dwóch sąsiadujących gałęziach: tło kwadratu ikony
 * (`isChiclet ? ACCENT_BG[accent] : tile.iconBg`) i kolor samego glifu
 * (`isChiclet ? ACCENT_FG[accent] : tile.iconFg`). Obie muszą iść razem;
 * rozjazd znaczyłby glif z palety admina na akcencie Domino. Lista
 * identyfikatorów presetów byłaby kopią tamtej decyzji, trzymaną ręcznie —
 * a pierwszy preset dopisany bez dopisania do listy to znowu kontrolka,
 * która kłamie.
 */
export function presetUsesApplicationColor(preset: Preset): boolean {
  return preset.variants.tile === "card"
}

/**
 * Preset dla instancji, która nie ustawiła własnego, i dla użytkownika, który
 * nie wybrał. Zostaje `neutral` również po wypuszczeniu przełącznika w E4:
 * Domino jest teraz kompletne i wybieralne, ale zmiana wartości domyślnej
 * przemalowałaby aplikację każdemu, kto niczego nie wybrał — a to jest decyzja
 * właściciela instancji, czyli treść E5, nie skutek uboczny tego etapu.
 *
 * Oba powody, dla których E3 nie wypuścił przełącznika, są zamknięte:
 * `masthead` ma pełne stylowanie (tokeny + warianty CVA, zero klas `ch-*`), a
 * paleta Domino nadpisuje komplet tokenów, więc `--input`, `--ring` i
 * `--sidebar-*` nie spadają już na neutralne blade krawędzie.
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
  labelKey: string
  descriptionKey: string
  swatch: readonly [string, string, string]
}

/** Trzy szarości, nie próbka Neutrala: pozycja ma znaczyć „dziedziczę", a nie
 *  „wybieram konkretny wygląd", którego i tak nie da się pokazać, dopóki E5
 *  nie poda presetu instancji. */
const INSTANCE_DEFAULT_CHOICE: PresetChoice = {
  id: INSTANCE_DEFAULT_ID,
  labelKey: "presets.instanceDefault",
  descriptionKey: "presets.instanceDefaultHint",
  swatch: ["#a3a3a3", "#a3a3a3", "#a3a3a3"],
}

/**
 * Lista dla przełącznika presetów z E4 — pozycja „dziedzicz" na początku,
 * potem presety w kolejności z rejestru.
 *
 * FUNKCJA, NIE STAŁA, bo etykiety muszą iść za językiem. Stała policzona przy
 * imporcie zamroziłaby napisy z języka, który akurat był aktywny w chwili
 * załadowania modułu — czyli przełącznik pokazywałby polskie opisy po
 * przełączeniu na angielski, i to tylko czasem, zależnie od kolejności
 * importów. `t` podaje wołający, więc lista nie musi nic wiedzieć o i18n.
 */
export function presetChoices(t: (key: string) => string): readonly {
  id: PresetChoiceId
  label: string
  description: string
  swatch: readonly [string, string, string]
}[] {
  return [
    {
      id: INSTANCE_DEFAULT_CHOICE.id,
      label: t(INSTANCE_DEFAULT_CHOICE.labelKey),
      description: t(INSTANCE_DEFAULT_CHOICE.descriptionKey),
      swatch: INSTANCE_DEFAULT_CHOICE.swatch,
    },
    ...Object.values(PRESETS).map(({ id, label, descriptionKey, swatch }) => ({
      id: id as PresetChoiceId,
      label,
      description: t(descriptionKey),
      swatch,
    })),
  ]
}

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
  /** Domyślny preset instancji — czytany z `system_config.instance_settings`
   *  po stronie serwera i wstrzykiwany przez `InstancePresetProvider` (E5). */
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
