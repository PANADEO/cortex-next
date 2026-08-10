---
name: code-theme
description: Wygląd w cortex-frontend — presety (Neutral/Customs/Domino) jako nazwane wiązki trzech warstw: tokeny CSS, warianty CVA, layout huba. Użyj przy zmianie kolorów/skinu, dodawaniu presetu albo layoutu huba, pytaniu "czemu ten kolor nie działa" / "gdzie się to stylizuje" / "czemu skin zniknął po buildzie". NIE dla konwencji komponentów, list i nagłówków (→ code-ui).
---

# code-theme

## Trzy warstwy (D3) — zawsze najpierw ustal, o której mówisz

```
warstwa 1  TOKENY          packages/@cortex/styles/globals.css
           tylko WARTOŚCI     :root  /  .skin-customs  /  .skin-domino  (+ warianty .dark)
           ─ zero selektorów komponentów, zero klas narzędziowych

warstwa 2  WARIANTY (CVA)  komponent obok swojego użycia
           tylko KSZTAŁT      hub/tile-card.tsx     — 8 slotów (root, fav, icon, glyph…)
                              hub/category-tabs.tsx — 6 slotów (nav, list, button…)
           ─ `variant: "card" | "chiclet"`, `"underline" | "folder"` — unie literałowe, nie string

warstwa 3  LAYOUT HUBA     app/idp/components/shell/hub/registry.ts
           tylko UKŁAD        HUB_LAYOUTS = { classic, masthead }
           ─ rejestr, nie `if` — dopisanie layoutu to jedna linia + katalog w layouts/
```

Zmiana trafia **do jednej warstwy**. Kolor → warstwa 1. Zaokrąglenie/odstęp/obramowanie kafelka → warstwa 2. Inne rozmieszczenie sekcji huba → warstwa 3. Zmiana wymagająca dwóch warstw naraz jest sygnałem, że warstwy są źle dobrane, a nie że reguła nie pasuje.

**Trzy miejsca, w których kolor NIE jest tokenem — znaj je, zanim zaczniesz szukać w `globals.css`:**

| Gdzie | Co | Dlaczego to nie defekt |
|---|---|---|
| `app/idp/features/system-config/colors.ts` | 11-kolorowa paleta admina, literalne klasy Tailwinda (`bg-rose-200 dark:bg-rose-900/40`…) | To DANA INSTANCJI wybierana w panelu, nie decyzja projektowa wyglądu. Pod wariantem `card` kolor ikony kafelka pochodzi stąd, nie z warstwy 1 |
| `lib/presets/registry.ts` — pole `swatch` | 12 literałów hex, próbki do podglądu w przełączniku | Próbka musi się wyrenderować, zanim skin zostanie nałożony. Trzy z nich (`#d9a441`/`#1f6e6b`/`#b85c38`) są jednak DRUGĄ KOPIĄ `--chart-1..3` Domina i rozjadą się w ciszy — dług, nie wzór |
| `hub/tile-card.tsx` — gwiazdka ulubionego, wariant `card` | `fill-amber-500 text-amber-500` | Wariant `card` odtwarza hub sprzed redesignu bajt w bajt (patrz komentarz w pliku). Bliźniak `chiclet` obok używa tokenów |

## Preset = nazwana wiązka, nie czwarta warstwa

`app/idp/lib/presets/registry.ts`:

```ts
domino: { skin: "skin-domino", hubLayout: "masthead",
          variants: { tabs: "folder", tile: "chiclet" } }
```

Wartość jest w tym, że wiązka ma **jedno imię**: „Domino" znaczy jednocześnie papier, chiclety i masthead, więc nie da się wybrać kombinacji, której nikt nigdy nie widział. Nie dorabiaj przełączników per-warstwa.

`customs` jest w rejestrze mimo że projekt wymienia tylko `neutral` i `domino` — `.skin-customs` to komplet żywych tokenów (38 w jasnym, 33 w ciemnym), a rejestr bez tego wpisu przemalowałby aplikację każdemu, kto go dziś używa.

## Pierwszeństwo: użytkownik → instancja → `DEFAULT_PRESET`

`resolvePresetId({ instance, user })` — czysta funkcja, testowalna bez montowania Reacta. Typy źródeł to `string`, nie `PresetId`, celowo: wartości idą **z bazy** i nikt ich po drodze nie waliduje, a preset skasowany z rejestru zostawia w tabelach martwe identyfikatory. Nieznany identyfikator = jak brak ustawienia, po obu stronach (serwer i klient) tak samo — rozjazd znaczyłby klasę skinu w HTML-u bez pokrycia w tym, co renderuje React.

- **Instancja**: `system_config.instance_settings.appearance_preset`, UI w `/system-config/appearance`.
- **Użytkownik**: dziś store lokalny (`preset-store.ts`). Trwały wybór per-user jest otwarty i ma **dwie sprzeczne wersje** — komentarz w `preset-store.ts` wskazuje szew na `user_preferences` w `idp-app` (poza tym repo, tam gdzie proxy `/user/preferences`), a backlog w Obsidianie notuje tańszą alternatywę we własnej bazie. Rozstrzygnij to, zanim zaczniesz implementować; nie zakładaj żadnej z nich po lekturze jednego źródła.
- **`DEFAULT_PRESET = "neutral"`** — zmiana tej stałej przemalowuje aplikację każdemu, kto niczego nie wybrał. To decyzja właściciela instancji, nie efekt uboczny zmiany kodu.

## Preset instancji czyta się NA SERWERZE, w korzeniu dokumentu

`app/idp/lib/presets/instance-preset.server.ts`, importowane wyłącznie przez `app/idp/app/layout.tsx` (`.server.ts` w nazwie jest ostrzeżeniem dla człowieka — `@cortex/service` wciąga drizzle i sterownik Postgresa). Klasa `.skin-*` ląduje w `<html>` od razu, więc preset **instancji** nie miga ani nie przeskakuje układem. Nie dotyczy to lokalnego wyboru użytkownika — tam pierwsze malowanie wyprzedza klasę o ~70 ms (ok. 1,2 s przy spowolnieniu procesora ×20), co odnotowuje `theme-provider.tsx`.

Dwie rzeczy, których nie wolno tu ruszyć bez zrozumienia:

1. **Odczyt ma twardy deadline 500 ms** (`Promise.race`). Nie `connect_timeout` w kliencie: ten ogranicza wyłącznie nawiązanie połączenia, a `postgres.js` nie ma domyślnego limitu **zapytania** — baza połykająca pakiety zawiesiłaby korzeń dokumentu, czyli całą aplikację, na 30 s.
2. **Przegrany wyścig musi mieć `query.catch(() => {})`.** Bez tego pochłaniacza późne odrzucenie jest nieobsłużone, czyli w Node wywraca proces serwera — awaria dużo gorsza od tej, którą leczymy.

Awaria bazy nie może wywrócić dokumentu. Cena to wygląd domyślny zamiast narzuconego, i tylko tyle.

## Pułapka, która kosztuje najwięcej czasu: safelist

`.skin-*` to **surowy CSS z `globals.css`, nie wygenerowane narzędzie Tailwinda**, a nakłada je w runtime `applyPreset()` w `theme-provider.tsx`. Bez wpisu w `safelist` purge warstwy `base` je zjada.

```ts
// tailwind.config.ts (korzeń repo — nie ma drugiego configu w app/idp)
safelist: ["skin-customs", "skin-domino"],
```

**Objaw jest mylący i to jest jedyny powód, dla którego ta sekcja istnieje.** Pominięcie safelisty NIE daje „skin zniknął". Purge wycina `.skin-domino`, ale **zostawia `.skin-domino.dark`** — więc skin działa wyłącznie w ciemnym motywie, a w jasnym znika. Nikt nie diagnozuje tego od safelisty; diagnozuje się od zera.

**`{ pattern: /^skin-/ }` NIE DZIAŁA i jest gorsze niż brak wpisu.** Wzorce rozwijają się po *wygenerowanych narzędziach*, a `.skin-*` to surowy CSS z `globals.css` — Tailwind ostrzega „doesn't match any Tailwind CSS classes" i wycina **oba skiny naraz**. Sprawdzone empirycznie, nie wydedukowane. Wciągnięcie `globals.css` do `content` też odrzucone: skiny przeżywają, ale skaner tokenizuje komentarze tego pliku i produkuje narzędzia-widma.

**Nowy skin = nowy wpis stringowy w `safelist`, w tym samym commicie co blok w `globals.css`.**

## Akcenty Domino (D6) a paleta admina

Domino ma **trzy** akcenty i ani jednego więcej: `--chart-1` (amber), `--chart-2` (teal), `--chart-3` (terrakota), każdy z parą `-foreground` o zmierzonym kontraście. Kafelek w wariancie `chiclet` bierze akcent z **kategorii funkcjonalnej** przez `accentFor()` w `hub/accent.ts` — to jedyne miejsce, które o tym rozstrzyga.

Wariant `card` (Neutral, Customs) bierze kolor z **11-kolorowej palety admina** (`applications.color`). Pod Dominem ta kolumna **nie jest czytana** — nie ginie, zostaje w bazie i zadziała, gdy wróci wygląd czytający paletę.

`Accent` jest numerem tokena (`1 | 2 | 3`), nie nazwą koloru. Wersja pierwotna zwracała `amber`/`teal`/`terracotta`, przez co nazwa koloru siedziała w trzech miejscach naraz i żaden inny skin nie mógł tych akcentów przemalować.

> **Reguła ogólniejsza, warta zapamiętania poza Dominem:** jeśli aktywny wygląd nie czyta jakiegoś pola, kontrolka zapisująca to pole **nie może milczeć**. Suwak, który zapisuje wartość i niczego nie zmienia, jest defektem panelu, nie wyglądu — i zamyka się w panelu, przez predykat pytający o wariant (a nie przez listę identyfikatorów presetów, bo ta byłaby ręcznie utrzymywaną kopią decyzji z komponentu). Wywracanie D6 i wpuszczanie 11 kolorów na Domino jest złą odpowiedzią na ten objaw.

## Reguły

1. Zero inline hex, zero magicznych wartości koloru poza tokenami — dotyczy też CSS-a w `globals.css` poza blokami skinów.
2. Nowy skin → blok w `globals.css` **+** wpis w `safelist` **+** wpis w `PRESETS`, jeden commit.
3. Nowy layout huba → katalog w `layouts/` + jedna linia w `HUB_LAYOUTS`. Rejestr jest bramką: `__tests__/layout-contract.test.tsx` parametryzuje się po tym obiekcie, więc wpis albo przechodzi cały zestaw kontraktowy, albo nie wchodzi.
4. Nie dotykaj `authed-home.tsx` przy dodawaniu layoutu — o tym właśnie jest warstwa 3.
5. Warianty to unie literałowe w `registry.ts`, konsumowane przez `cva()`. Nie `string`, nie druga lista literałów obok tej.
6. Preset instancji: odczyt serwerowy z deadlinem. Nie przenoś go do `useQuery` — hook z ładowaniem przywraca mignięcie/przeskok układu, przed którym broni cały ten mechanizm.
7. `--chart-4`/`--chart-5` **nie są** czwartym i piątym akcentem. Są zdefiniowane i podpięte w `tailwind.config.ts`, ale dziś nie ma ani jednego konsumenta poza `globals.css` — traktuj je jako zarezerwowane pod wykresy, nie jako działającą paletę.
8. `accentFor()` rozstrzyga o akcencie KAFELKA. Poza nim `--chart-1`/`--chart-2` bywają użyte wprost jako kolory stałe (aktywna teczka w `category-tabs.tsx`, pasek w `masthead.tsx`) — zmiana tokena rusza także je.
